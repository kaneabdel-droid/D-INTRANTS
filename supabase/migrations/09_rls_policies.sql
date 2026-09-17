-- Policies RLS. Gabarit à 4 policies (select/insert/update/delete) pour chaque
-- table opérationnelle rattachée à un magasin, catalogue partagé à l'échelle de
-- l'entreprise, et lecture seule sur entreprises/magasins/utilisateurs — aucune
-- policy d'écriture n'y est exposée à `authenticated` : toute écriture sur ces
-- 3 tables passe exclusivement par le client service-role de /admin (voir
-- utils/supabase/admin.ts), ce qui garantit au niveau base de données, et pas
-- seulement par masquage d'interface, que seul l'admin système crée/supprime
-- des comptes ou des entreprises (cf. plan §3/§4).

-- entreprises / magasins / utilisateurs : lecture seule, dans leur propre périmètre.
alter table public.entreprises enable row level security;
alter table public.magasins enable row level security;
alter table public.utilisateurs enable row level security;

create policy "select_entreprises" on public.entreprises for select
  using (id = public.current_entreprise_id());

create policy "select_magasins" on public.magasins for select
  using (entreprise_id = public.current_entreprise_id());

create policy "select_utilisateurs" on public.utilisateurs for select
  using (id = auth.uid());

-- Catalogue partagé à l'échelle entreprise : lecture par les deux rôles,
-- écriture par n'importe quel gérant de l'entreprise (le catalogue n'est pas
-- propre à un magasin, contrairement au stock).
alter table public.categories enable row level security;
alter table public.articles enable row level security;
alter table public.fournisseurs enable row level security;

create policy "select_categories" on public.categories for select
  using (entreprise_id = public.current_entreprise_id());
create policy "write_categories_insert" on public.categories for insert
  with check (entreprise_id = public.current_entreprise_id() and public.current_role() = 'gerant');
create policy "write_categories_update" on public.categories for update
  using (entreprise_id = public.current_entreprise_id() and public.current_role() = 'gerant')
  with check (entreprise_id = public.current_entreprise_id() and public.current_role() = 'gerant');
create policy "write_categories_delete" on public.categories for delete
  using (entreprise_id = public.current_entreprise_id() and public.current_role() = 'gerant');

create policy "select_articles" on public.articles for select
  using (entreprise_id = public.current_entreprise_id());
create policy "write_articles_insert" on public.articles for insert
  with check (entreprise_id = public.current_entreprise_id() and public.current_role() = 'gerant');
create policy "write_articles_update" on public.articles for update
  using (entreprise_id = public.current_entreprise_id() and public.current_role() = 'gerant')
  with check (entreprise_id = public.current_entreprise_id() and public.current_role() = 'gerant');
create policy "write_articles_delete" on public.articles for delete
  using (entreprise_id = public.current_entreprise_id() and public.current_role() = 'gerant');

create policy "select_fournisseurs" on public.fournisseurs for select
  using (entreprise_id = public.current_entreprise_id());
create policy "write_fournisseurs_insert" on public.fournisseurs for insert
  with check (entreprise_id = public.current_entreprise_id() and public.current_role() = 'gerant');
create policy "write_fournisseurs_update" on public.fournisseurs for update
  using (entreprise_id = public.current_entreprise_id() and public.current_role() = 'gerant')
  with check (entreprise_id = public.current_entreprise_id() and public.current_role() = 'gerant');
create policy "write_fournisseurs_delete" on public.fournisseurs for delete
  using (entreprise_id = public.current_entreprise_id() and public.current_role() = 'gerant');

-- Tables opérationnelles rattachées à un magasin : gabarit identique pour
-- chacune (select via can_read_magasin, écriture via can_write_magasin).
do $$
declare
  t text;
  tables text[] := array[
    'clients', 'stocks', 'mouvements_stock',
    'ventes', 'lignes_vente', 'achats', 'lignes_achat',
    'creances', 'dettes',
    'comptes_tresorerie', 'journal_tresorerie', 'charges'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy %I on public.%I for select using (public.can_read_magasin(magasin_id))',
      'select_' || t, t
    );
    execute format(
      'create policy %I on public.%I for insert with check (public.can_write_magasin(magasin_id))',
      'insert_' || t, t
    );
    execute format(
      'create policy %I on public.%I for update using (public.can_write_magasin(magasin_id)) with check (public.can_write_magasin(magasin_id))',
      'update_' || t, t
    );
    execute format(
      'create policy %I on public.%I for delete using (public.can_write_magasin(magasin_id))',
      'delete_' || t, t
    );
  end loop;
end;
$$;
