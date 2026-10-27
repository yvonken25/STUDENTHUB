export const CONTENT_STATUSES = [
  'DRAFT',
  'REVIEW',
  'PUBLISHED',
  'ARCHIVED',
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const CONTENT_VISIBILITIES = [
  'PRIVATE',
  'MEMBERS',
  'UNLISTED_QR',
  'PUBLIC',
] as const;
export type ContentVisibility = (typeof CONTENT_VISIBILITIES)[number];

/** Workflow éditorial : le statut ne peut pas sauter d'étape. */
export const ALLOWED_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  DRAFT: ['REVIEW'],
  REVIEW: ['DRAFT', 'PUBLISHED'],
  PUBLISHED: ['ARCHIVED'],
  ARCHIVED: ['DRAFT'],
};

export function canTransition(from: ContentStatus, to: ContentStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Une ligne de la table public.contents (telle que renvoyée à l'admin). */
export interface ContentRow {
  id: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  category: string | null;
  tags: string[];
  status: ContentStatus;
  visibility: ContentVisibility;
  author_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}
