-- =====================================================================
-- StudentHub : données de démonstration
-- Lancé automatiquement par `supabase db reset` (après les migrations).
-- Les textes ci-dessous sont des textes de démonstration, pas des règles officielles.
-- =====================================================================

-- 4 contenus couvrant tous les cas du scénario de démo :
--   PUBLIC visible par tous / PRIVATE en brouillon / MEMBERS / en relecture
insert into public.contents (title, slug, summary, body, category, tags, status, visibility) values
(
  'Guide des aides financières',
  'guide-aides-financieres',
  'Les étapes principales pour demander une aide financière pendant ses études.',
  E'## Introduction\nTexte de démonstration.\n\n## Démarches\n1. Vérifier les conditions.\n2. Rassembler les documents.\n3. Déposer la demande à temps.',
  'Aides',
  '{bourse,aide,finances}',
  'PUBLISHED',
  'PUBLIC'
),
(
  'Brouillon : calendrier de rentrée',
  'calendrier-rentree',
  'Calendrier provisoire de la rentrée, pas encore validé.',
  E'## Calendrier\nTexte de démonstration, contenu non validé.',
  'Rentrée',
  '{calendrier}',
  'DRAFT',
  'PRIVATE'
),
(
  'Règlement interne des examens',
  'reglement-examens',
  'Contenu réservé aux étudiants connectés.',
  E'## Règlement\nTexte de démonstration réservé aux membres.',
  'Examens',
  '{examens,reglement}',
  'PUBLISHED',
  'MEMBERS'
),
(
  'Semaine d''accueil B1',
  'semaine-accueil-b1',
  'Programme de la semaine d''accueil, en attente de relecture.',
  E'## Programme\nTexte de démonstration en cours de relecture.',
  'Vie étudiante',
  '{accueil,b1}',
  'REVIEW',
  'PRIVATE'
);

-- 1 guide public avec 4 sections ordonnées
insert into public.guides (title, slug, summary, status, visibility) values
(
  'Bienvenue en B1 Info',
  'bienvenue-b1',
  'Tout ce qu''il faut savoir pour bien démarrer en première année.',
  'PUBLISHED',
  'PUBLIC'
);

insert into public.guide_sections (guide_id, sort_order, title, body)
select g.id, s.sort_order, s.title, s.body
from public.guides g
cross join (values
  (1, 'Avant la rentrée',   'Compte, horaires, matériel, accès.'),
  (2, 'Première semaine',   'Où aller, qui contacter, demander de l''aide.'),
  (3, 'Ressources utiles',  'Documents, liens officiels, contacts.'),
  (4, 'Questions fréquentes', 'FAQ reprise par l''assistant IA.')
) as s(sort_order, title, body)
where g.slug = 'bienvenue-b1';

-- ---------------------------------------------------------------------
-- Compte administrateur de démo (à faire UNE FOIS, à la main) :
--   1. Studio Supabase (http://127.0.0.1:54323) > Authentication > Add user
--   2. Puis, dans le SQL editor :
--        update public.profiles set role = 'ADMIN' where email = 'ton-email@exemple.be';
-- Le profil est créé automatiquement par le trigger on_auth_user_created.
-- ---------------------------------------------------------------------
