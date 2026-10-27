import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { canTransition } from './content.types';
import { ContentsService } from './contents.service';

type Result = { data: unknown; error: unknown };

/** Faux "query builder" Supabase : enregistre les appels et renvoie un résultat fixe. */
function fakeQuery(result: Result) {
  const q: Record<string, any> = {};
  for (const method of [
    'select',
    'eq',
    'in',
    'order',
    'limit',
    'ilike',
    'update',
    'insert',
  ]) {
    q[method] = jest.fn(() => q);
  }
  q.single = jest.fn(() => Promise.resolve(result));
  q.maybeSingle = jest.fn(() => Promise.resolve(result));
  q.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return q;
}

function serviceWith(result: Result) {
  const query = fakeQuery(result);
  const supabase = { from: jest.fn(() => query) } as unknown as SupabaseClient;
  return { service: new ContentsService(supabase), query };
}

describe('Workflow éditorial', () => {
  it('autorise les transitions prévues', () => {
    expect(canTransition('DRAFT', 'REVIEW')).toBe(true);
    expect(canTransition('REVIEW', 'PUBLISHED')).toBe(true);
    expect(canTransition('PUBLISHED', 'ARCHIVED')).toBe(true);
  });

  it('interdit de sauter une étape', () => {
    expect(canTransition('DRAFT', 'PUBLISHED')).toBe(false);
    expect(canTransition('DRAFT', 'ARCHIVED')).toBe(false);
    expect(canTransition('PUBLISHED', 'DRAFT')).toBe(false);
  });
});

describe('ContentsService - API publique', () => {
  it('ne liste que les contenus PUBLISHED + PUBLIC', async () => {
    const { service, query } = serviceWith({ data: [], error: null });

    await service.listPublic({});

    expect(query.eq).toHaveBeenCalledWith('status', 'PUBLISHED');
    expect(query.eq).toHaveBeenCalledWith('visibility', 'PUBLIC');
  });

  it("n'expose jamais author_id, status ni visibility", async () => {
    const { service, query } = serviceWith({ data: [], error: null });

    await service.listPublic({});
    await service.findPublicBySlug('guide').catch(() => undefined);

    for (const [columns] of query.select.mock.calls) {
      expect(columns).not.toMatch(/author_id|status|visibility|created_at/);
    }
  });

  it('neutralise les jokers LIKE de la recherche', async () => {
    const { service, query } = serviceWith({ data: [], error: null });

    await service.listPublic({ q: '100%_x' });

    expect(query.ilike).toHaveBeenCalledWith('title', '%100\\%\\_x%');
  });

  it('le détail par slug accepte PUBLIC et UNLISTED_QR, jamais PRIVATE/MEMBERS', async () => {
    const { service, query } = serviceWith({
      data: { slug: 'guide' },
      error: null,
    });

    await service.findPublicBySlug('guide');

    expect(query.eq).toHaveBeenCalledWith('status', 'PUBLISHED');
    expect(query.in).toHaveBeenCalledWith('visibility', [
      'PUBLIC',
      'UNLISTED_QR',
    ]);
  });

  it('renvoie 404 si le contenu est absent ou non public', async () => {
    const { service } = serviceWith({ data: null, error: null });

    await expect(service.findPublicBySlug('prive')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('ContentsService - admin', () => {
  it('refuse DRAFT → PUBLISHED sans passer par REVIEW', async () => {
    const { service, query } = serviceWith({
      data: { id: 'x', status: 'DRAFT' },
      error: null,
    });

    await expect(service.changeStatus('x', 'PUBLISHED')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(query.update).not.toHaveBeenCalled();
  });

  it('accepte REVIEW → PUBLISHED', async () => {
    const { service, query } = serviceWith({
      data: { id: 'x', status: 'REVIEW' },
      error: null,
    });

    await service.changeStatus('x', 'PUBLISHED');

    expect(query.update).toHaveBeenCalledWith({ status: 'PUBLISHED' });
  });

  it('crée toujours en DRAFT + PRIVATE', async () => {
    const { service, query } = serviceWith({ data: { id: 'x' }, error: null });

    await service.create(
      { title: 'T', slug: 't', summary: 's', body: 'b' },
      'user-1',
    );

    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'DRAFT',
        visibility: 'PRIVATE',
        author_id: 'user-1',
      }),
    );
  });

  it('refuse une modification vide', async () => {
    const { service } = serviceWith({ data: null, error: null });

    await expect(service.update('x', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
