-- =====================================================================
-- StudentHub : schéma initial (version simple)
-- Tables : profiles, contents, guides, guide_sections, documents, audit_logs
-- Règle d'or : le statut (DRAFT/REVIEW/PUBLISHED/ARCHIVED) et la visibilité
-- (PRIVATE/MEMBERS/UNLISTED_QR/PUBLIC) sont deux colonnes séparées.
-- Un contenu n'est visible du grand public que si
--   status = 'PUBLISHED' ET visibility = 'PUBLIC'.
-- =====================================================================

-- ---------- Types ----------
create type public.user_role as enum ('STUDENT', 'EDITOR', 'ADMIN');
create type public.content_status as enum ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');
create type public.content_visibility as enum ('PRIVATE', 'MEMBERS', 'UNLISTED_QR', 'PUBLIC');

-- ---------- Tables ----------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  role        public.user_role not null default 'STUDENT',
  created_at  timestamptz not null default now()
);

create table public.contents (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 150),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  summary       text not null check (char_length(summary) between 1 and 300),
  body          text not null,
  category      text,
  tags          text[] not null default '{}',
  status        public.content_status not null default 'DRAFT',
  visibility    public.content_visibility not null default 'PRIVATE',
  author_id     uuid references public.profiles (id) on delete set null,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint contents_published_has_date
    check (status <> 'PUBLISHED' or published_at is not null)
);

create table public.guides (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 150),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  summary       text not null check (char_length(summary) between 1 and 300),
  status        public.content_status not null default 'DRAFT',
  visibility    public.content_visibility not null default 'PRIVATE',
  author_id     uuid references public.profiles (id) on delete set null,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint guides_published_has_date
    check (status <> 'PUBLISHED' or published_at is not null)
);

-- Sections ordonnées d'un guide (la visibilité est celle du guide parent)
create table public.guide_sections (
  id          uuid primary key default gen_random_uuid(),
  guide_id    uuid not null references public.guides (id) on delete cascade,
  sort_order  int not null check (sort_order > 0),
  title       text not null check (char_length(title) between 1 and 150),
  body        text not null,
  unique (guide_id, sort_order)
);

-- Métadonnées des fichiers (le fichier lui-même est dans Supabase Storage).
-- La visibilité est celle du contenu parent : pas de copie, pas d'oubli.
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  content_id    uuid not null references public.contents (id) on delete cascade,
  file_name     text not null,
  storage_path  text not null unique,
  mime_type     text not null,
  size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 10485760), -- 10 Mo
  uploaded_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

-- Traçabilité : rempli automatiquement quand statut/visibilité changent
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- Index ----------
create index contents_status_visibility_idx on public.contents (status, visibility);
create index guides_status_visibility_idx   on public.guides (status, visibility);
create index documents_content_id_idx       on public.documents (content_id);

-- ---------- Fonctions et triggers ----------

-- Rôle de l'utilisateur connecté (SECURITY DEFINER pour éviter la récursion RLS)
create function public.get_my_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Crée automatiquement un profil quand un compte Auth est créé
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Met à jour updated_at et renseigne published_at au passage en PUBLISHED
create function public.before_write_publishable()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status = 'PUBLISHED' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger contents_before_write
  before insert or update on public.contents
  for each row execute function public.before_write_publishable();

create trigger guides_before_write
  before insert or update on public.guides
  for each row execute function public.before_write_publishable();

-- Journalise tout changement de statut ou de visibilité
create function public.log_publication_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     or new.visibility is distinct from old.visibility then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (
      auth.uid(),
      'PUBLICATION_CHANGED',
      tg_table_name,
      new.id,
      jsonb_build_object(
        'status',     jsonb_build_array(old.status, new.status),
        'visibility', jsonb_build_array(old.visibility, new.visibility)
      )
    );
  end if;
  return new;
end;
$$;

create trigger contents_audit
  after update on public.contents
  for each row execute function public.log_publication_change();

create trigger guides_audit
  after update on public.guides
  for each row execute function public.log_publication_change();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_publication_change() from public, anon, authenticated;

-- ---------- Droits sur les tables (RLS filtre ensuite ligne par ligne) ----------
grant select on public.contents, public.guides, public.guide_sections, public.documents to anon;
grant select, insert, update, delete
  on public.profiles, public.contents, public.guides, public.guide_sections, public.documents
  to authenticated;
grant select on public.audit_logs to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ---------- Row Level Security ----------
alter table public.profiles       enable row level security;
alter table public.contents       enable row level security;
alter table public.guides         enable row level security;
alter table public.guide_sections enable row level security;
alter table public.documents      enable row level security;
alter table public.audit_logs     enable row level security;

-- profiles : chacun voit le sien, l'admin voit et modifie tout
create policy profiles_read_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_admin_read on public.profiles
  for select to authenticated using (public.get_my_role() = 'ADMIN');
create policy profiles_admin_update on public.profiles
  for update to authenticated
  using (public.get_my_role() = 'ADMIN') with check (public.get_my_role() = 'ADMIN');

-- contents
-- (UNLISTED_QR n'a volontairement aucune policy publique : l'API NestJS le sert
--  uniquement par slug exact, jamais dans une liste.)
create policy contents_public_read on public.contents
  for select to anon, authenticated
  using (status = 'PUBLISHED' and visibility = 'PUBLIC');
create policy contents_members_read on public.contents
  for select to authenticated
  using (status = 'PUBLISHED' and visibility = 'MEMBERS');
create policy contents_staff_read on public.contents
  for select to authenticated
  using (public.get_my_role() in ('EDITOR', 'ADMIN'));
create policy contents_staff_insert on public.contents
  for insert to authenticated
  with check (public.get_my_role() in ('EDITOR', 'ADMIN'));
create policy contents_staff_update on public.contents
  for update to authenticated
  using (public.get_my_role() in ('EDITOR', 'ADMIN'))
  with check (public.get_my_role() in ('EDITOR', 'ADMIN'));
create policy contents_admin_delete on public.contents
  for delete to authenticated
  using (public.get_my_role() = 'ADMIN');

-- guides
create policy guides_public_read on public.guides
  for select to anon, authenticated
  using (status = 'PUBLISHED' and visibility = 'PUBLIC');
create policy guides_members_read on public.guides
  for select to authenticated
  using (status = 'PUBLISHED' and visibility = 'MEMBERS');
create policy guides_staff_read on public.guides
  for select to authenticated
  using (public.get_my_role() in ('EDITOR', 'ADMIN'));
create policy guides_staff_insert on public.guides
  for insert to authenticated
  with check (public.get_my_role() in ('EDITOR', 'ADMIN'));
create policy guides_staff_update on public.guides
  for update to authenticated
  using (public.get_my_role() in ('EDITOR', 'ADMIN'))
  with check (public.get_my_role() in ('EDITOR', 'ADMIN'));
create policy guides_admin_delete on public.guides
  for delete to authenticated
  using (public.get_my_role() = 'ADMIN');

-- guide_sections : visibles si le guide parent est visible pour l'appelant
-- (la sous-requête sur guides applique elle-même les policies de guides)
create policy guide_sections_read on public.guide_sections
  for select to anon, authenticated
  using (exists (select 1 from public.guides g where g.id = guide_id));
create policy guide_sections_staff_write on public.guide_sections
  for all to authenticated
  using (public.get_my_role() in ('EDITOR', 'ADMIN'))
  with check (public.get_my_role() in ('EDITOR', 'ADMIN'));

-- documents : visibles si le contenu parent est visible pour l'appelant
create policy documents_read on public.documents
  for select to anon, authenticated
  using (exists (select 1 from public.contents c where c.id = content_id));
create policy documents_staff_write on public.documents
  for all to authenticated
  using (public.get_my_role() in ('EDITOR', 'ADMIN'))
  with check (public.get_my_role() in ('EDITOR', 'ADMIN'));

-- audit_logs : lecture admin uniquement (écriture par les triggers)
create policy audit_logs_admin_read on public.audit_logs
  for select to authenticated
  using (public.get_my_role() = 'ADMIN');

-- ---------- Storage ----------
-- Bucket privé : les fichiers sont servis par l'API (URL signée), jamais en accès libre.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
