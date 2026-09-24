-- Matrice de permissions du gérant, configurable par l'admin d'entreprise.
--
-- Restriction ADDITIVE uniquement : le plafond technique de chaque rôle reste celui déjà imposé par
-- can_write_magasin()/can_read_magasin() (schéma de base) — admin_entreprise ne peut jamais écrire,
-- quoi que dise la matrice, et un gérant reste borné à son propre magasin. La matrice ne peut que retirer,
-- au gérant, la lecture/l'écriture/la modification d'un module donné (categories, articles, stock, clients,
-- fournisseurs, ventes, achats, creances, dettes, tresorerie, charges). Une entreprise sans ligne (ou un
-- module absent de la matrice) garde le comportement actuel : tout autorisé pour le gérant.
--
-- matrice : { "<module>": { "lire": bool, "ecrire": bool, "modifier": bool } } — une valeur absente vaut
-- « autorisé » (true). Un seul rôle est restreignable (gérant) : pas de sous-clé de rôle, contrairement à
-- une entreprise qui aurait plusieurs profils différents.

create table parametres_permissions (
  entreprise_id uuid primary key references entreprises(id) on delete cascade,
  matrice jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_par uuid
);

alter table parametres_permissions enable row level security;

create policy perm_select on parametres_permissions for select
  using (entreprise_id = public.current_entreprise_id());

create policy perm_write on parametres_permissions for all
  using (entreprise_id = public.current_entreprise_id() and public.current_role() = 'admin_entreprise')
  with check (entreprise_id = public.current_entreprise_id());
