-- Fonctions SECURITY DEFINER réutilisées par toutes les policies RLS (09_rls_policies.sql).
-- Contrairement à SIGGIE, qui ne restreint les rôles que côté serveur (actions.ts),
-- "l'admin d'entreprise ne peut pas écrire" est ici une règle métier dure imposée
-- aussi en base — défense en profondeur (cf. plan §3).

create or replace function public.current_entreprise_id() returns uuid
language sql security definer stable set search_path = public as $$
  select entreprise_id from public.utilisateurs where id = auth.uid()
$$;

create or replace function public.current_magasin_id() returns uuid
language sql security definer stable set search_path = public as $$
  select magasin_id from public.utilisateurs where id = auth.uid()
$$;

create or replace function public.current_role() returns text
language sql security definer stable set search_path = public as $$
  select role from public.utilisateurs where id = auth.uid()
$$;

-- Lecture : admin_entreprise voit tous les magasins de son entreprise ; gérant
-- seulement le sien.
create or replace function public.can_read_magasin(p_magasin_id uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select case public.current_role()
    when 'admin_entreprise' then exists (
      select 1 from public.magasins m
      where m.id = p_magasin_id and m.entreprise_id = public.current_entreprise_id())
    when 'gerant' then p_magasin_id = public.current_magasin_id()
    else false
  end
$$;

-- Écriture : gérant uniquement, et seulement sur son propre magasin. admin_entreprise
-- ne passe jamais, quel que soit le magasin visé.
create or replace function public.can_write_magasin(p_magasin_id uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select public.current_role() = 'gerant' and p_magasin_id = public.current_magasin_id()
$$;
