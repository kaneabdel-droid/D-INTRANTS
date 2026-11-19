-- Migration 33 : Ajout de doit_changer_mot_de_passe, policies magasins et mise à jour quotas utilisateurs

-- 1. Colonne complémentaire sur public.utilisateurs
alter table public.utilisateurs
  add column if not exists doit_changer_mot_de_passe boolean not null default false;

-- 2. RLS magasins : Permettre aux administrateurs d'entreprise de créer et modifier leurs magasins
drop policy if exists "admin_insert_magasins" on public.magasins;
create policy "admin_insert_magasins"
on public.magasins for insert
with check (
  entreprise_id = public.current_entreprise_id() and
  public.current_role() = 'admin_entreprise'
);

drop policy if exists "admin_update_magasins" on public.magasins;
create policy "admin_update_magasins"
on public.magasins for update
using (
  entreprise_id = public.current_entreprise_id() and
  public.current_role() = 'admin_entreprise'
);

-- 3. Mise à jour explicite des quotas d'utilisateurs par formule d'abonnement
alter table public.paliers_abonnement
  add column if not exists utilisateurs_max integer;

update public.paliers_abonnement set utilisateurs_max = 2 where code = 'standard';
update public.paliers_abonnement set utilisateurs_max = 5 where code = 'medium';
update public.paliers_abonnement set utilisateurs_max = 10 where code = 'premium';
update public.paliers_abonnement set utilisateurs_max = null, magasins_max = 5 where code = 'premium_plus';

