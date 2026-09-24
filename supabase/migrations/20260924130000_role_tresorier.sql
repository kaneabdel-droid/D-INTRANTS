-- Ajoute le rôle « trésorier » : rattaché à un magasin comme le gérant (même
-- lecture, via can_read_magasin()), mais dont l'écriture est limitée par la
-- nouvelle can_write_tresorerie() aux 5 tables de trésorerie (creances,
-- dettes, comptes_tresorerie, journal_tresorerie, charges) — le catalogue, le
-- stock, les ventes et les achats restent réservés au gérant.
--
-- La matrice de permissions (parametres_permissions, cf.
-- 20260924120000_permissions_matrice.sql) n'est pas modifiée : elle continue
-- de s'appliquer telle quelle aux 4 modules concernés (/creances, /dettes,
-- /tresorerie, /charges), désormais partagés entre gérant et trésorier —
-- restreindre un module s'applique alors aux deux rôles à la fois, ce qui est
-- le comportement voulu (règle par module, pas par rôle).

alter table public.utilisateurs drop constraint utilisateurs_role_check;
alter table public.utilisateurs add constraint utilisateurs_role_check
  check (role in ('admin_entreprise', 'gerant', 'tresorier'));

alter table public.utilisateurs drop constraint role_magasin_coherence;
alter table public.utilisateurs add constraint role_magasin_coherence check (
  (role in ('gerant', 'tresorier') and magasin_id is not null) or
  (role = 'admin_entreprise' and magasin_id is null)
);

create or replace function public.can_read_magasin(p_magasin_id uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select case public.current_role()
    when 'admin_entreprise' then exists (
      select 1 from public.magasins m
      where m.id = p_magasin_id and m.entreprise_id = public.current_entreprise_id())
    when 'gerant' then p_magasin_id = public.current_magasin_id()
    when 'tresorier' then p_magasin_id = public.current_magasin_id()
    else false
  end
$$;

create or replace function public.can_write_tresorerie(p_magasin_id uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select public.current_role() in ('gerant', 'tresorier') and p_magasin_id = public.current_magasin_id()
$$;

do $$
declare
  t text;
  tables text[] := array['creances', 'dettes', 'comptes_tresorerie', 'journal_tresorerie', 'charges'];
begin
  foreach t in array tables loop
    execute format('alter policy %I on public.%I with check (public.can_write_tresorerie(magasin_id))', 'insert_' || t, t);
    execute format('alter policy %I on public.%I using (public.can_write_tresorerie(magasin_id)) with check (public.can_write_tresorerie(magasin_id))', 'update_' || t, t);
    execute format('alter policy %I on public.%I using (public.can_write_tresorerie(magasin_id))', 'delete_' || t, t);
  end loop;
end;
$$;
