import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../supabase/supabase.module';
import {
  canTransition,
  type ContentRow,
  type ContentStatus,
  type ContentVisibility,
} from './content.types';
import type { CreateContentDto } from './dto/create-content.dto';
import type { PublicQueryDto } from './dto/queries.dto';
import type { UpdateContentDto } from './dto/update-content.dto';

/**
 * Colonnes exposées au public : volontairement SANS author_id, status,
 * visibility ni created_at. Si une colonne n'est pas dans cette liste,
 * elle ne peut pas sortir de l'API publique.
 */
const PUBLIC_LIST_COLUMNS =
  'id, title, slug, summary, category, tags, published_at';
const PUBLIC_DETAIL_COLUMNS = `${PUBLIC_LIST_COLUMNS}, body, updated_at`;

/** Neutralise les jokers SQL LIKE (% et _) saisis par le visiteur. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class ContentsService {
  private readonly logger = new Logger(ContentsService.name);

  constructor(@Inject(SUPABASE) private readonly supabase: SupabaseClient) {}

  // ------------------------------------------------------------------
  // API PUBLIQUE : la clé service_role contourne la RLS, donc le filtre
  // status + visibility ci-dessous est LA règle de sécurité.
  // ------------------------------------------------------------------

  /** Liste publique : uniquement PUBLISHED + PUBLIC. */
  async listPublic(query: PublicQueryDto) {
    let request = this.supabase
      .from('contents')
      .select(PUBLIC_LIST_COLUMNS)
      .eq('status', 'PUBLISHED')
      .eq('visibility', 'PUBLIC')
      .order('published_at', { ascending: false })
      .limit(query.limit ?? 20);

    if (query.category) request = request.eq('category', query.category);
    if (query.q) request = request.ilike('title', `%${escapeLike(query.q)}%`);

    const { data, error } = await request;
    if (error) this.fail(error);
    return data;
  }

  /**
   * Détail public par slug : PUBLIC, ou UNLISTED_QR (accessible seulement
   * si on connaît le lien exact, jamais listé).
   */
  async findPublicBySlug(slug: string) {
    const { data, error } = await this.supabase
      .from('contents')
      .select(PUBLIC_DETAIL_COLUMNS)
      .eq('slug', slug)
      .eq('status', 'PUBLISHED')
      .in('visibility', ['PUBLIC', 'UNLISTED_QR'])
      .maybeSingle();

    if (error) this.fail(error);
    if (!data) throw new NotFoundException('Contenu introuvable');
    return data;
  }

  // ------------------------------------------------------------------
  // ADMIN (réservé aux EDITOR / ADMIN par StaffGuard)
  // ------------------------------------------------------------------

  async listForStaff(status?: ContentStatus) {
    let request = this.supabase
      .from('contents')
      .select('*')
      .order('updated_at', { ascending: false });
    if (status) request = request.eq('status', status);

    const { data, error } = await request;
    if (error) this.fail(error);
    return data as ContentRow[];
  }

  async findOne(id: string): Promise<ContentRow> {
    const { data, error } = await this.supabase
      .from('contents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) this.fail(error);
    if (!data) throw new NotFoundException('Contenu introuvable');
    return data as ContentRow;
  }

  /** Un nouveau contenu est toujours DRAFT + PRIVATE : le client ne choisit pas. */
  async create(dto: CreateContentDto, authorId: string): Promise<ContentRow> {
    const { data, error } = await this.supabase
      .from('contents')
      .insert({
        ...dto,
        author_id: authorId,
        status: 'DRAFT',
        visibility: 'PRIVATE',
      })
      .select()
      .single();

    if (error) this.fail(error);
    return data as ContentRow;
  }

  async update(id: string, dto: UpdateContentDto): Promise<ContentRow> {
    const changes = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(changes).length === 0) {
      throw new BadRequestException('Aucun champ à modifier');
    }

    const { data, error } = await this.supabase
      .from('contents')
      .update(changes)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) this.fail(error);
    if (!data) throw new NotFoundException('Contenu introuvable');
    return data as ContentRow;
  }

  /** Change le statut en respectant le workflow DRAFT → REVIEW → PUBLISHED → ARCHIVED. */
  async changeStatus(id: string, to: ContentStatus): Promise<ContentRow> {
    const current = await this.findOne(id);
    if (!canTransition(current.status, to)) {
      throw new BadRequestException(
        `Transition interdite : ${current.status} → ${to}`,
      );
    }

    const { data, error } = await this.supabase
      .from('contents')
      .update({ status: to })
      .eq('id', id)
      .select()
      .single();

    if (error) this.fail(error);
    return data as ContentRow;
  }

  async changeVisibility(
    id: string,
    visibility: ContentVisibility,
  ): Promise<ContentRow> {
    const { data, error } = await this.supabase
      .from('contents')
      .update({ visibility })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) this.fail(error);
    if (!data) throw new NotFoundException('Contenu introuvable');
    return data as ContentRow;
  }

  /** Traduit une erreur Postgres en erreur HTTP propre, sans fuite de détails internes. */
  private fail(error: PostgrestError): never {
    if (error.code === '23505') {
      throw new ConflictException('Ce slug est déjà utilisé');
    }
    this.logger.error(`${error.code} ${error.message}`);
    throw new InternalServerErrorException('Erreur base de données');
  }
}
