-- Schéma initial D-QUINCA : tenancy à deux niveaux (entreprises -> magasins).
-- Voir implementation plan §2. gen_random_uuid() est fourni nativement par les
-- projets Supabase (extension pgcrypto activée par défaut) : pas besoin de uuid-ossp.

create table public.entreprises (
  id uuid default gen_random_uuid() primary key,
  nom varchar(255) not null,
  adresse text,
  telephone varchar(30),
  devise varchar(10) default 'XOF',
  statut varchar(20) default 'actif' check (statut in ('actif', 'suspendu')),
  created_at timestamptz default now()
);

create table public.magasins (
  id uuid default gen_random_uuid() primary key,
  entreprise_id uuid references public.entreprises(id) on delete cascade not null,
  nom varchar(150) not null,
  adresse text,
  telephone varchar(30),
  statut varchar(20) default 'actif' check (statut in ('actif', 'archive')),
  created_at timestamptz default now()
);

create index idx_magasins_entreprise on public.magasins(entreprise_id);

-- Liée à auth.users de Supabase, comme dans SIGGIE. magasin_id est nullable :
-- un admin_entreprise n'est rattaché à aucun magasin (vue consolidée), un gérant
-- est obligatoirement rattaché à exactement un magasin.
create table public.utilisateurs (
  id uuid references auth.users not null primary key,
  entreprise_id uuid references public.entreprises(id) on delete cascade not null,
  magasin_id uuid references public.magasins(id) on delete set null,
  role varchar(20) not null check (role in ('admin_entreprise', 'gerant')),
  nom varchar(100),
  prenom varchar(100),
  telephone varchar(30),
  created_at timestamptz default now(),
  constraint role_magasin_coherence check (
    (role = 'gerant' and magasin_id is not null) or
    (role = 'admin_entreprise' and magasin_id is null)
  )
);

create index idx_utilisateurs_entreprise on public.utilisateurs(entreprise_id);
create index idx_utilisateurs_magasin on public.utilisateurs(magasin_id);

-- Hypothèse par défaut : un seul admin_entreprise par entreprise (facile à
-- assouplir plus tard si besoin — cf. plan §2 et récapitulatif des écarts).
create unique index one_admin_entreprise_par_entreprise
  on public.utilisateurs (entreprise_id) where role = 'admin_entreprise';


-- Catalogue partagé à l'échelle de l'entreprise : même référentiel d'articles
-- pour tous les magasins d'une entreprise, le stock (table `stocks`, migration
-- suivante) étant lui propre à chaque magasin.

create table public.categories (
  id uuid default gen_random_uuid() primary key,
  entreprise_id uuid references public.entreprises(id) on delete cascade not null,
  nom varchar(150) not null,
  description text,
  unique (entreprise_id, nom)
);

create index idx_categories_entreprise on public.categories(entreprise_id);

create table public.articles (
  id uuid default gen_random_uuid() primary key,
  entreprise_id uuid references public.entreprises(id) on delete cascade not null,
  categorie_id uuid references public.categories(id) on delete set null,
  reference varchar(60),
  designation varchar(255) not null,
  unite varchar(30) default 'unite',
  prix_vente numeric not null default 0,
  seuil_alerte numeric default 0,
  actif boolean default true,
  unique (entreprise_id, reference)
);

create index idx_articles_entreprise on public.articles(entreprise_id);
create index idx_articles_categorie on public.articles(categorie_id);

create table public.fournisseurs (
  id uuid default gen_random_uuid() primary key,
  entreprise_id uuid references public.entreprises(id) on delete cascade not null,
  nom varchar(200) not null,
  telephone varchar(30),
  adresse text
);

create index idx_fournisseurs_entreprise on public.fournisseurs(entreprise_id);


-- Stock = grand livre (mouvements_stock, append-only, source de vérité) + cache
-- (stocks, quantité courante par magasin+article), synchronisés par trigger.
-- C'est ce mécanisme qui rend le stock "automatique" : toute écriture applicative
-- passe par un insert dans mouvements_stock, jamais par un update direct de stocks.

create table public.stocks (
  id uuid default gen_random_uuid() primary key,
  magasin_id uuid references public.magasins(id) on delete cascade not null,
  article_id uuid references public.articles(id) on delete cascade not null,
  quantite numeric not null default 0,
  updated_at timestamptz default now(),
  unique (magasin_id, article_id)
);

create index idx_stocks_magasin on public.stocks(magasin_id);

create table public.mouvements_stock (
  id uuid default gen_random_uuid() primary key,
  magasin_id uuid references public.magasins(id) on delete cascade not null,
  article_id uuid references public.articles(id) on delete cascade not null,
  type_mouvement varchar(30) not null check (type_mouvement in (
    'entree_achat', 'sortie_vente', 'ajustement_positif', 'ajustement_negatif',
    'transfert_entree', 'transfert_sortie'
  )),
  quantite numeric not null check (quantite > 0),
  reference_id uuid,
  reference_type varchar(30),
  motif text,
  utilisateur_id uuid references public.utilisateurs(id),
  created_at timestamptz default now()
);

create index idx_mouvements_stock_magasin on public.mouvements_stock(magasin_id);
create index idx_mouvements_stock_article on public.mouvements_stock(article_id);

create or replace function public.sync_stock_apres_mouvement()
returns trigger language plpgsql as $$
declare
  v_delta numeric;
  v_nouveau numeric;
begin
  v_delta := case when new.type_mouvement in ('entree_achat', 'ajustement_positif', 'transfert_entree')
    then new.quantite else -new.quantite end;

  insert into public.stocks (magasin_id, article_id, quantite, updated_at)
  values (new.magasin_id, new.article_id, v_delta, now())
  on conflict (magasin_id, article_id)
  do update set quantite = public.stocks.quantite + v_delta, updated_at = now()
  returning quantite into v_nouveau;

  if v_nouveau < 0 then
    raise exception 'Stock insuffisant (résultat négatif : %)', v_nouveau;
  end if;

  return new;
end;
$$;

create trigger trg_sync_stock
  after insert on public.mouvements_stock
  for each row execute procedure public.sync_stock_apres_mouvement();


-- Clients : propres à un magasin (contrairement aux fournisseurs, partagés à
-- l'échelle de l'entreprise dans 01_catalogue.sql — un fournisseur livre
-- potentiellement plusieurs magasins, un client achète dans un magasin donné).

create table public.clients (
  id uuid default gen_random_uuid() primary key,
  entreprise_id uuid references public.entreprises(id) on delete cascade not null,
  magasin_id uuid references public.magasins(id) on delete cascade not null,
  nom varchar(200) not null,
  telephone varchar(30),
  adresse text
);

create index idx_clients_magasin on public.clients(magasin_id);


create table public.ventes (
  id uuid default gen_random_uuid() primary key,
  magasin_id uuid references public.magasins(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete set null,
  numero varchar(40),
  date_vente timestamptz default now(),
  mode_paiement varchar(20) check (mode_paiement in ('comptant', 'credit', 'mixte')),
  montant_total numeric not null default 0,
  montant_paye numeric not null default 0,
  statut varchar(20) default 'validee' check (statut in ('brouillon', 'validee', 'annulee')),
  utilisateur_id uuid references public.utilisateurs(id)
);

create index idx_ventes_magasin on public.ventes(magasin_id);
create index idx_ventes_client on public.ventes(client_id);

create table public.lignes_vente (
  id uuid default gen_random_uuid() primary key,
  vente_id uuid references public.ventes(id) on delete cascade not null,
  magasin_id uuid references public.magasins(id) not null, -- dénormalisé pour RLS (§3)
  article_id uuid references public.articles(id) not null,
  quantite numeric not null check (quantite > 0),
  prix_unitaire numeric not null,
  cout_unitaire numeric not null, -- snapshot du coût au moment de la vente -> base de la marge
  montant_ligne numeric generated always as (quantite * prix_unitaire) stored
);

create index idx_lignes_vente_vente on public.lignes_vente(vente_id);
create index idx_lignes_vente_magasin on public.lignes_vente(magasin_id);
create index idx_lignes_vente_article on public.lignes_vente(article_id);


-- Symétrique de 04_ventes.sql : achats/lignes_achat côté fournisseur
-- (prix_unitaire_achat au lieu de cout_unitaire — cf. plan §2).

create table public.achats (
  id uuid default gen_random_uuid() primary key,
  magasin_id uuid references public.magasins(id) on delete cascade not null,
  fournisseur_id uuid references public.fournisseurs(id) on delete set null,
  numero varchar(40),
  date_achat timestamptz default now(),
  mode_paiement varchar(20) check (mode_paiement in ('comptant', 'credit', 'mixte')),
  montant_total numeric not null default 0,
  montant_paye numeric not null default 0,
  statut varchar(20) default 'validee' check (statut in ('brouillon', 'validee', 'annulee')),
  utilisateur_id uuid references public.utilisateurs(id)
);

create index idx_achats_magasin on public.achats(magasin_id);
create index idx_achats_fournisseur on public.achats(fournisseur_id);

create table public.lignes_achat (
  id uuid default gen_random_uuid() primary key,
  achat_id uuid references public.achats(id) on delete cascade not null,
  magasin_id uuid references public.magasins(id) not null, -- dénormalisé pour RLS (§3)
  article_id uuid references public.articles(id) not null,
  quantite numeric not null check (quantite > 0),
  prix_unitaire_achat numeric not null,
  montant_ligne numeric generated always as (quantite * prix_unitaire_achat) stored
);

create index idx_lignes_achat_achat on public.lignes_achat(achat_id);
create index idx_lignes_achat_magasin on public.lignes_achat(magasin_id);
create index idx_lignes_achat_article on public.lignes_achat(article_id);


create table public.creances (
  id uuid default gen_random_uuid() primary key,
  magasin_id uuid references public.magasins(id) on delete cascade not null,
  client_id uuid references public.clients(id) not null,
  vente_id uuid references public.ventes(id) on delete set null,
  montant_initial numeric not null,
  montant_restant numeric not null,
  date_echeance date,
  statut varchar(20) default 'en_cours' check (statut in ('en_cours', 'soldee', 'en_retard'))
);

create index idx_creances_magasin on public.creances(magasin_id);
create index idx_creances_client on public.creances(client_id);

-- Symétrique de creances, côté fournisseur.
create table public.dettes (
  id uuid default gen_random_uuid() primary key,
  magasin_id uuid references public.magasins(id) on delete cascade not null,
  fournisseur_id uuid references public.fournisseurs(id) not null,
  achat_id uuid references public.achats(id) on delete set null,
  montant_initial numeric not null,
  montant_restant numeric not null,
  date_echeance date,
  statut varchar(20) default 'en_cours' check (statut in ('en_cours', 'soldee', 'en_retard'))
);

create index idx_dettes_magasin on public.dettes(magasin_id);
create index idx_dettes_fournisseur on public.dettes(fournisseur_id);


create table public.comptes_tresorerie (
  id uuid default gen_random_uuid() primary key,
  magasin_id uuid references public.magasins(id) on delete cascade not null,
  nom varchar(150) not null,
  type_compte varchar(20) not null default 'caisse' check (type_compte in ('caisse', 'banque', 'mobile_money')),
  solde_initial numeric default 0
);

create index idx_comptes_tresorerie_magasin on public.comptes_tresorerie(magasin_id);

create table public.journal_tresorerie (
  id uuid default gen_random_uuid() primary key,
  magasin_id uuid references public.magasins(id) not null, -- dénormalisé pour RLS (§3)
  compte_tresorerie_id uuid references public.comptes_tresorerie(id) on delete restrict not null,
  type_mouvement varchar(10) not null check (type_mouvement in ('entree', 'sortie')),
  montant numeric not null check (montant > 0),
  categorie varchar(30), -- vente | reglement_creance | reglement_dette | achat | charge | virement | autre
  reference_id uuid,
  reference_type varchar(30),
  motif text,
  date_mouvement timestamptz default now(),
  utilisateur_id uuid references public.utilisateurs(id)
);

create index idx_journal_tresorerie_magasin on public.journal_tresorerie(magasin_id);
create index idx_journal_tresorerie_compte on public.journal_tresorerie(compte_tresorerie_id);

-- Nouveau vs SIGGIE — nécessaire pour calculer un résultat net (marge brute - charges),
-- pas seulement une marge brute (cf. plan §2/§6).
create table public.charges (
  id uuid default gen_random_uuid() primary key,
  magasin_id uuid references public.magasins(id) on delete cascade not null,
  compte_tresorerie_id uuid references public.comptes_tresorerie(id),
  categorie varchar(50), -- loyer, salaires, electricite, transport, autre
  libelle varchar(200),
  montant numeric not null,
  date_charge date not null,
  recurrente boolean default false,
  utilisateur_id uuid references public.utilisateurs(id)
);

create index idx_charges_magasin on public.charges(magasin_id);


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


-- RPC plpgsql pour les écritures multi-tables atomiques (plan §7 phase 5) :
-- une vente touche ventes + lignes_vente + mouvements_stock (+ creances +
-- journal_tresorerie selon le mode de paiement) — un enchaînement de .insert()
-- séquentiels côté client laisserait des écritures partielles en cas d'échec
-- à mi-chemin (ex: stock insuffisant détecté après la ligne 3 sur 5). Le corps
-- d'une fonction plpgsql s'exécute dans une seule transaction implicite : toute
-- exception (dont celle levée par le trigger sync_stock_apres_mouvement en cas
-- de stock insuffisant) annule l'ensemble.
--
-- security invoker (par défaut) : la fonction s'exécute avec les droits de
-- l'appelant, donc les policies RLS s'appliquent normalement à chaque insert
-- (can_write_magasin) — la vérification explicite en tête de fonction est une
-- défense en profondeur qui produit un message d'erreur clair avant d'aller
-- plus loin, plutôt que de laisser échouer sur la première policy venue.

create or replace function public.creer_vente(
  p_magasin_id uuid,
  p_client_id uuid,
  p_mode_paiement varchar,
  p_montant_paye numeric,
  p_lignes jsonb -- [{ "article_id": uuid, "quantite": numeric, "prix_unitaire": numeric }, ...]
) returns uuid
language plpgsql as $$
declare
  v_vente_id uuid;
  v_montant_total numeric := 0;
  v_montant_restant numeric;
  v_ligne jsonb;
  v_cout_unitaire numeric;
  v_utilisateur_id uuid := auth.uid();
begin
  if not public.can_write_magasin(p_magasin_id) then
    raise exception 'Non autorisé pour ce magasin';
  end if;

  if jsonb_array_length(p_lignes) = 0 then
    raise exception 'Une vente doit comporter au moins une ligne';
  end if;

  select coalesce(sum((l->>'quantite')::numeric * (l->>'prix_unitaire')::numeric), 0)
  into v_montant_total
  from jsonb_array_elements(p_lignes) l;

  insert into public.ventes (magasin_id, client_id, mode_paiement, montant_total, montant_paye, statut, utilisateur_id)
  values (p_magasin_id, p_client_id, p_mode_paiement, v_montant_total, coalesce(p_montant_paye, 0), 'validee', v_utilisateur_id)
  returning id into v_vente_id;

  for v_ligne in select * from jsonb_array_elements(p_lignes) loop
    -- Coût moyen pondéré : moyenne des prix d'achat historiques de cet article
    -- dans ce magasin (aucun champ "coût" dédié sur `articles` dans ce schéma,
    -- cf. plan §2 — la marge se calcule à partir de cet historique d'achats).
    select coalesce(avg(la.prix_unitaire_achat), 0) into v_cout_unitaire
    from public.lignes_achat la
    where la.article_id = (v_ligne->>'article_id')::uuid
      and la.magasin_id = p_magasin_id;

    insert into public.lignes_vente (vente_id, magasin_id, article_id, quantite, prix_unitaire, cout_unitaire)
    values (
      v_vente_id, p_magasin_id, (v_ligne->>'article_id')::uuid,
      (v_ligne->>'quantite')::numeric, (v_ligne->>'prix_unitaire')::numeric, v_cout_unitaire
    );

    -- Lève une exception (et annule toute la transaction) si le stock devient négatif.
    insert into public.mouvements_stock (magasin_id, article_id, type_mouvement, quantite, reference_id, reference_type, utilisateur_id)
    values (p_magasin_id, (v_ligne->>'article_id')::uuid, 'sortie_vente', (v_ligne->>'quantite')::numeric, v_vente_id, 'vente', v_utilisateur_id);
  end loop;

  v_montant_restant := v_montant_total - coalesce(p_montant_paye, 0);

  if p_mode_paiement in ('credit', 'mixte') and v_montant_restant > 0 then
    insert into public.creances (magasin_id, client_id, vente_id, montant_initial, montant_restant, statut)
    values (p_magasin_id, p_client_id, v_vente_id, v_montant_restant, v_montant_restant, 'en_cours');
  end if;

  if coalesce(p_montant_paye, 0) > 0 then
    -- Encaisse sur le premier compte "caisse" du magasin par défaut (choix du
    -- compte précis laissé à une évolution ultérieure du formulaire de vente).
    insert into public.journal_tresorerie (magasin_id, compte_tresorerie_id, type_mouvement, montant, categorie, reference_id, reference_type, motif, utilisateur_id)
    select p_magasin_id, ct.id, 'entree', p_montant_paye, 'vente', v_vente_id, 'vente', 'Encaissement vente', v_utilisateur_id
    from public.comptes_tresorerie ct
    where ct.magasin_id = p_magasin_id
    order by (ct.type_compte = 'caisse') desc, ct.id
    limit 1;
  end if;

  return v_vente_id;
end;
$$;

-- Symétrique de creer_vente, côté achats fournisseur.
create or replace function public.creer_achat(
  p_magasin_id uuid,
  p_fournisseur_id uuid,
  p_mode_paiement varchar,
  p_montant_paye numeric,
  p_lignes jsonb -- [{ "article_id": uuid, "quantite": numeric, "prix_unitaire_achat": numeric }, ...]
) returns uuid
language plpgsql as $$
declare
  v_achat_id uuid;
  v_montant_total numeric := 0;
  v_montant_restant numeric;
  v_ligne jsonb;
  v_utilisateur_id uuid := auth.uid();
begin
  if not public.can_write_magasin(p_magasin_id) then
    raise exception 'Non autorisé pour ce magasin';
  end if;

  if jsonb_array_length(p_lignes) = 0 then
    raise exception 'Un achat doit comporter au moins une ligne';
  end if;

  select coalesce(sum((l->>'quantite')::numeric * (l->>'prix_unitaire_achat')::numeric), 0)
  into v_montant_total
  from jsonb_array_elements(p_lignes) l;

  insert into public.achats (magasin_id, fournisseur_id, mode_paiement, montant_total, montant_paye, statut, utilisateur_id)
  values (p_magasin_id, p_fournisseur_id, p_mode_paiement, v_montant_total, coalesce(p_montant_paye, 0), 'validee', v_utilisateur_id)
  returning id into v_achat_id;

  for v_ligne in select * from jsonb_array_elements(p_lignes) loop
    insert into public.lignes_achat (achat_id, magasin_id, article_id, quantite, prix_unitaire_achat)
    values (
      v_achat_id, p_magasin_id, (v_ligne->>'article_id')::uuid,
      (v_ligne->>'quantite')::numeric, (v_ligne->>'prix_unitaire_achat')::numeric
    );

    insert into public.mouvements_stock (magasin_id, article_id, type_mouvement, quantite, reference_id, reference_type, utilisateur_id)
    values (p_magasin_id, (v_ligne->>'article_id')::uuid, 'entree_achat', (v_ligne->>'quantite')::numeric, v_achat_id, 'achat', v_utilisateur_id);
  end loop;

  v_montant_restant := v_montant_total - coalesce(p_montant_paye, 0);

  if p_mode_paiement in ('credit', 'mixte') and v_montant_restant > 0 then
    insert into public.dettes (magasin_id, fournisseur_id, achat_id, montant_initial, montant_restant, statut)
    values (p_magasin_id, p_fournisseur_id, v_achat_id, v_montant_restant, v_montant_restant, 'en_cours');
  end if;

  if coalesce(p_montant_paye, 0) > 0 then
    insert into public.journal_tresorerie (magasin_id, compte_tresorerie_id, type_mouvement, montant, categorie, reference_id, reference_type, motif, utilisateur_id)
    select p_magasin_id, ct.id, 'sortie', p_montant_paye, 'achat', v_achat_id, 'achat', 'Paiement achat', v_utilisateur_id
    from public.comptes_tresorerie ct
    where ct.magasin_id = p_magasin_id
    order by (ct.type_compte = 'caisse') desc, ct.id
    limit 1;
  end if;

  return v_achat_id;
end;
$$;


-- RPC pour les règlements de créances/dettes : même logique d'atomicité que
-- creer_vente/creer_achat (migration 10) — la mise à jour du solde et
-- l'écriture de trésorerie doivent réussir ou échouer ensemble, jamais l'une
-- sans l'autre (sinon un solde soldé sans encaissement, ou l'inverse).
-- `for update` verrouille la ligne créance/dette le temps de la transaction
-- pour éviter un double règlement concurrent qui ferait passer le solde en
-- négatif (deux caissiers réglant la même créance au même instant).

create or replace function public.regler_creance(
  p_creance_id uuid,
  p_montant numeric,
  p_compte_tresorerie_id uuid
) returns void
language plpgsql as $$
declare
  v_magasin_id uuid;
  v_restant numeric;
  v_utilisateur_id uuid := auth.uid();
begin
  select magasin_id, montant_restant into v_magasin_id, v_restant
  from public.creances where id = p_creance_id
  for update;

  if v_magasin_id is null then
    raise exception 'Créance introuvable';
  end if;

  if not public.can_write_magasin(v_magasin_id) then
    raise exception 'Non autorisé pour ce magasin';
  end if;

  if p_montant <= 0 or p_montant > v_restant then
    raise exception 'Montant de règlement invalide (reste dû : %)', v_restant;
  end if;

  update public.creances
  set montant_restant = v_restant - p_montant,
      statut = case when v_restant - p_montant <= 0 then 'soldee' else 'en_cours' end
  where id = p_creance_id;

  insert into public.journal_tresorerie (magasin_id, compte_tresorerie_id, type_mouvement, montant, categorie, reference_id, reference_type, motif, utilisateur_id)
  values (v_magasin_id, p_compte_tresorerie_id, 'entree', p_montant, 'reglement_creance', p_creance_id, 'creance', 'Règlement créance', v_utilisateur_id);
end;
$$;

create or replace function public.regler_dette(
  p_dette_id uuid,
  p_montant numeric,
  p_compte_tresorerie_id uuid
) returns void
language plpgsql as $$
declare
  v_magasin_id uuid;
  v_restant numeric;
  v_utilisateur_id uuid := auth.uid();
begin
  select magasin_id, montant_restant into v_magasin_id, v_restant
  from public.dettes where id = p_dette_id
  for update;

  if v_magasin_id is null then
    raise exception 'Dette introuvable';
  end if;

  if not public.can_write_magasin(v_magasin_id) then
    raise exception 'Non autorisé pour ce magasin';
  end if;

  if p_montant <= 0 or p_montant > v_restant then
    raise exception 'Montant de règlement invalide (reste dû : %)', v_restant;
  end if;

  update public.dettes
  set montant_restant = v_restant - p_montant,
      statut = case when v_restant - p_montant <= 0 then 'soldee' else 'en_cours' end
  where id = p_dette_id;

  insert into public.journal_tresorerie (magasin_id, compte_tresorerie_id, type_mouvement, montant, categorie, reference_id, reference_type, motif, utilisateur_id)
  values (v_magasin_id, p_compte_tresorerie_id, 'sortie', p_montant, 'reglement_dette', p_dette_id, 'dette', 'Règlement dette', v_utilisateur_id);
end;
$$;


-- Fonctions d'agrégation pour le dashboard et les pages Comparatif/Rentabilité
-- (plan §6/phase 7). `language sql` sans `security definer` : ces fonctions
-- s'exécutent avec les droits de l'appelant, donc les policies RLS de
-- can_read_magasin s'appliquent normalement — un gérant n'agrège que son
-- magasin, un admin_entreprise peut agréger tous les magasins de son
-- entreprise (comparatif_magasins), jamais ceux d'une autre entreprise.

-- Évolution des ventes sur une période, avec les jours/semaines/mois sans
-- vente à zéro (generate_series en left join) pour ne pas laisser de trou
-- dans le graphique.
create or replace function public.ventes_par_periode(
  p_magasin_id uuid,
  p_date_debut date,
  p_date_fin date,
  p_granularite text default 'jour' -- 'jour' | 'semaine' | 'mois'
) returns table (periode date, total numeric)
language sql stable as $$
  with bornes as (
    select
      (case p_granularite when 'mois' then '1 month' when 'semaine' then '1 week' else '1 day' end)::interval as pas,
      (case p_granularite when 'mois' then date_trunc('month', p_date_debut) when 'semaine' then date_trunc('week', p_date_debut) else p_date_debut::timestamptz end) as debut,
      (case p_granularite when 'mois' then date_trunc('month', p_date_fin) when 'semaine' then date_trunc('week', p_date_fin) else p_date_fin::timestamptz end) as fin
  ),
  series as (
    select generate_series(b.debut, b.fin, b.pas)::date as periode
    from bornes b
  ),
  ventes_aggregees as (
    select
      (case p_granularite
        when 'mois' then date_trunc('month', v.date_vente)
        when 'semaine' then date_trunc('week', v.date_vente)
        else date_trunc('day', v.date_vente)
      end)::date as periode,
      sum(v.montant_total) as total
    from public.ventes v
    where v.magasin_id = p_magasin_id
      and v.statut = 'validee'
      and v.date_vente >= p_date_debut
      and v.date_vente < (p_date_fin + interval '1 day')
    group by 1
  )
  select s.periode, coalesce(va.total, 0) as total
  from series s
  left join ventes_aggregees va on va.periode = s.periode
  order by s.periode
$$;

-- Rentabilité globale d'un magasin sur une période : marge_brute = ca - coût
-- (cout_unitaire snapshotté à la vente, cf. migration 04/10), resultat_net =
-- marge_brute - charges de la période.
create or replace function public.rentabilite_periode(
  p_magasin_id uuid,
  p_date_debut date,
  p_date_fin date
) returns table (ca numeric, cout numeric, marge_brute numeric, charges numeric, resultat_net numeric)
language sql stable as $$
  with ventes_periode as (
    select lv.quantite, lv.prix_unitaire, lv.cout_unitaire
    from public.lignes_vente lv
    join public.ventes v on v.id = lv.vente_id
    where lv.magasin_id = p_magasin_id
      and v.statut = 'validee'
      and v.date_vente >= p_date_debut
      and v.date_vente < (p_date_fin + interval '1 day')
  ),
  agg as (
    select
      coalesce(sum(quantite * prix_unitaire), 0) as ca,
      coalesce(sum(quantite * cout_unitaire), 0) as cout
    from ventes_periode
  ),
  charges_periode as (
    select coalesce(sum(montant), 0) as total
    from public.charges
    where magasin_id = p_magasin_id
      and date_charge >= p_date_debut
      and date_charge <= p_date_fin
  )
  select agg.ca, agg.cout, (agg.ca - agg.cout) as marge_brute, cp.total as charges,
    (agg.ca - agg.cout - cp.total) as resultat_net
  from agg, charges_periode cp
$$;

-- Marge par article sur une période (paramétrable par magasin) — permet de
-- répondre à "quels articles rapportent le plus" plutôt qu'un seul chiffre global.
create or replace function public.rentabilite_par_article(
  p_magasin_id uuid,
  p_date_debut date,
  p_date_fin date
) returns table (article_id uuid, designation text, quantite numeric, ca numeric, cout numeric, marge numeric)
language sql stable as $$
  select
    a.id as article_id,
    a.designation,
    sum(lv.quantite) as quantite,
    sum(lv.quantite * lv.prix_unitaire) as ca,
    sum(lv.quantite * lv.cout_unitaire) as cout,
    sum(lv.quantite * (lv.prix_unitaire - lv.cout_unitaire)) as marge
  from public.lignes_vente lv
  join public.ventes v on v.id = lv.vente_id
  join public.articles a on a.id = lv.article_id
  where lv.magasin_id = p_magasin_id
    and v.statut = 'validee'
    and v.date_vente >= p_date_debut
    and v.date_vente < (p_date_fin + interval '1 day')
  group by a.id, a.designation
  order by marge desc
$$;

-- Comparatif entre magasins d'une même entreprise — réservé à l'usage
-- admin_entreprise côté app, mais la RLS (can_read_magasin) l'autoriserait
-- aussi pour un gérant qui n'obtiendrait que sa propre ligne.
create or replace function public.comparatif_magasins(
  p_entreprise_id uuid,
  p_date_debut date,
  p_date_fin date
) returns table (magasin_id uuid, magasin_nom text, ca numeric, marge_brute numeric)
language sql stable as $$
  select
    m.id as magasin_id,
    m.nom as magasin_nom,
    coalesce(sum(lv.quantite * lv.prix_unitaire), 0) as ca,
    coalesce(sum(lv.quantite * (lv.prix_unitaire - lv.cout_unitaire)), 0) as marge_brute
  from public.magasins m
  left join public.ventes v on v.magasin_id = m.id
    and v.statut = 'validee'
    and v.date_vente >= p_date_debut
    and v.date_vente < (p_date_fin + interval '1 day')
  left join public.lignes_vente lv on lv.vente_id = v.id
  where m.entreprise_id = p_entreprise_id
  group by m.id, m.nom
  order by m.nom
$$;


-- Facturation de la plateforme D-QUINCA elle-même (paiement des abonnements
-- clients), PAS un modèle BYOK/marketplace : un seul compte Chariow / Moneroo /
-- Bictorys pour toute la plateforme, clé API en variable d'environnement
-- (voir lib/abonnements/providers/*.ts) — inutile de chiffrer des identifiants
-- par entreprise ici.

-- Palier d'abonnement de chaque entreprise + date d'expiration de la période
-- payée en cours. `palier` détermine `magasins_max` via paliers_abonnement ;
-- l'entreprise démarre en 'standard' non payé (abonnement_expire_le null) —
-- creerMagasin() applique déjà la limite du palier standard (1 magasin) dès
-- la création, cf. entreprises/actions.ts.
alter table public.entreprises
  add column palier varchar(20) not null default 'standard'
    check (palier in ('standard', 'medium', 'premium')),
  add column abonnement_expire_le timestamptz;

-- Table de référence (magasins_max, prix) plutôt qu'une constante dupliquée
-- en dur en base ET dans le code : lib/abonnements/paliers.ts reste la seule
-- source de vérité côté application, cette table sert de garde-fou lisible
-- en SQL (support, debug) et pourrait un jour piloter l'UI d'admin.
create table public.paliers_abonnement (
  code varchar(20) primary key,
  nom varchar(50) not null,
  magasins_max integer not null,
  prix_mensuel_fcfa integer not null
);

insert into public.paliers_abonnement (code, nom, magasins_max, prix_mensuel_fcfa) values
  ('standard', 'Standard', 1, 5000),
  ('medium', 'Médium', 2, 7500),
  ('premium', 'Premium', 3, 10000);

-- Historique des paiements d'abonnement, tous providers confondus. Une ligne
-- par tentative de paiement (pas par mois couvert) : periode_debut/periode_fin
-- décrivent la période créditée une fois `statut = 'paye'`.
create table public.abonnements (
  id uuid default gen_random_uuid() primary key,
  entreprise_id uuid references public.entreprises(id) on delete cascade not null,
  palier varchar(20) not null references public.paliers_abonnement(code),
  duree_mois integer not null check (duree_mois in (1, 6, 12)),
  montant_fcfa integer not null,
  provider varchar(20) not null check (provider in ('chariow', 'moneroo', 'bictorys')),
  provider_reference varchar(255),
  statut varchar(20) not null default 'en_attente' check (statut in ('en_attente', 'paye', 'echoue')),
  periode_debut timestamptz,
  periode_fin timestamptz,
  metadata jsonb,
  created_at timestamptz default now(),
  paye_at timestamptz
);

create index idx_abonnements_entreprise on public.abonnements(entreprise_id);
create index idx_abonnements_statut on public.abonnements(statut);

-- Idempotence au niveau base : un même paiement provider ne peut créditer
-- qu'une seule ligne (protège contre une course cron ↔ webhook ↔ retour
-- utilisateur qui réconcilieraient la même vente en parallèle).
create unique index uq_abonnements_provider_reference
  on public.abonnements(provider, provider_reference) where provider_reference is not null;

-- RLS : lecture seule dans son périmètre entreprise, comme entreprises/magasins/
-- utilisateurs (09_rls_policies.sql). Toute écriture (démarrage de paiement,
-- webhook, cron de réconciliation) passe par le client service-role — jamais
-- par le client authentifié.
alter table public.abonnements enable row level security;
create policy "select_abonnements" on public.abonnements for select
  using (entreprise_id = public.current_entreprise_id());

alter table public.paliers_abonnement enable row level security;
create policy "select_paliers_abonnement" on public.paliers_abonnement for select using (true);


-- Paiement public avant création de compte (page /tarifs, visiteur anonyme) :
-- réutilise la table abonnements existante plutôt qu'une table parallèle avec
-- ses propres webhooks/reconciliation. Une ligne à entreprise_id null qui passe
-- à statut='paye' est une "demande" à traiter par l'admin système — cf.
-- app/tarifs/actions.ts et app/admin/(protected)/demandes/. Le nom d'entreprise
-- demandé et les coordonnées de contact vont dans `metadata` (déjà un sac JSON
-- libre pour cette table, cf. 13_abonnements.sql), pas de nouvelle colonne.
alter table public.abonnements
  alter column entreprise_id drop not null;

-- La policy RLS existante (entreprise_id = current_entreprise_id()) exclut déjà
-- naturellement les lignes à entreprise_id null pour tout utilisateur
-- authentifié (comparaison à NULL = NULL, jamais vraie) : aucune demande en
-- attente n'est visible depuis un compte entreprise, seul le client
-- service-role (admin) peut les lire.


-- Miroir de la table du même nom côté SIGGIE (chariow_produits), mais keyée par
-- palier×durée plutôt que par montant : D-QUINCA a 3 paliers × 3 durées (9
-- produits Chariow possibles) plutôt qu'un tarif unique par montant. Permet à
-- l'admin système de faire pointer un palier/durée vers un autre product_id
-- Chariow sans redéploiement (cf. lib/abonnements/providers/chariow.ts, qui lit
-- cette table en priorité et retombe sur les variables d'env CHARIOW_PRODUCT_*
-- si la ligne est absente).
create table public.chariow_produits (
  palier varchar(20) not null check (palier in ('standard', 'medium', 'premium')),
  duree_mois integer not null check (duree_mois in (1, 6, 12)),
  product_id varchar(255) not null,
  updated_at timestamptz default now(),
  primary key (palier, duree_mois)
);

-- Écriture réservée au service-role (admin), comme entreprises/utilisateurs :
-- aucune policy insert/update/delete exposée à authenticated. Lecture publique
-- inutile ici (jamais consultée depuis un client authentifié), donc RLS activée
-- sans aucune policy select non plus.
alter table public.chariow_produits enable row level security;


-- Fiche d'information entreprise : dénomination et devise existent déjà
-- (nom, devise), adresse/telephone aussi — il ne manque que le contact e-mail,
-- l'identification fiscale (NINEA/RCCM ou équivalent selon le pays) et le logo.
alter table public.entreprises
  add column if not exists email varchar(255),
  add column if not exists identification varchar(100),
  add column if not exists logo_url text;

-- Écriture via RPC dédiée plutôt qu'une policy RLS UPDATE sur entreprises :
-- une policy RLS ne peut restreindre QUE les lignes visibles, pas les colonnes
-- modifiables — un admin_entreprise ne doit jamais pouvoir toucher `palier`,
-- `abonnement_expire_le` ou `statut` (réservés à l'admin système, cf. RLS
-- existante qui n'expose aucune policy insert/update/delete sur cette table).
-- La liste de paramètres de cette fonction EST la liste blanche des champs
-- modifiables, même garantie que creer_vente/regler_dette déjà en place.
create or replace function public.update_entreprise_infos(
  p_nom varchar,
  p_adresse text,
  p_telephone varchar,
  p_email varchar,
  p_identification varchar,
  p_devise varchar
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'admin_entreprise' then
    raise exception 'Non autorisé';
  end if;

  if p_nom is null or length(trim(p_nom)) = 0 then
    raise exception 'Le nom est requis';
  end if;

  update public.entreprises
  set nom = trim(p_nom),
      adresse = nullif(trim(coalesce(p_adresse, '')), ''),
      telephone = nullif(trim(coalesce(p_telephone, '')), ''),
      email = nullif(trim(coalesce(p_email, '')), ''),
      identification = nullif(trim(coalesce(p_identification, '')), ''),
      devise = coalesce(p_devise, devise)
  where id = public.current_entreprise_id();
end;
$$;

-- Distincte de update_entreprise_infos : le logo se remplace seul (aperçu +
-- bouton "Changer" dans /parametres) sans repasser par tout le formulaire, une
-- fonction séparée évite d'avoir à ré-envoyer les autres champs sous peine de
-- les écraser à null.
create or replace function public.update_entreprise_logo(
  p_logo_url text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'admin_entreprise' then
    raise exception 'Non autorisé';
  end if;

  update public.entreprises
  set logo_url = p_logo_url
  where id = public.current_entreprise_id();
end;
$$;

-- Bucket public en lecture (le logo doit s'afficher sur des PDF et pages sans
-- session), écriture restreinte à son propre dossier <entreprise_id>/ pour
-- qu'une entreprise ne puisse jamais écraser le logo d'une autre.
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy "logos_public_select" on storage.objects
  for select using (bucket_id = 'logos');

create policy "logos_own_folder_insert" on storage.objects
  for insert with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_entreprise_id()::text
  );

create policy "logos_own_folder_update" on storage.objects
  for update using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_entreprise_id()::text
  );

create policy "logos_own_folder_delete" on storage.objects
  for delete using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_entreprise_id()::text
  );


-- Interdit qu'un compte de trésorerie qui n'est pas de type "banque" (caisse,
-- mobile_money) passe en solde négatif — un point d'application unique en
-- BEFORE INSERT couvre tous les chemins d'écriture existants (addEcritureTresorerie,
-- addCharge, et les RPC creer_achat/regler_dette qui insèrent directement en
-- SQL) sans avoir à dupliquer le contrôle dans chacun, même principe que le
-- trigger sync_stock_apres_mouvement (02_stock.sql) qui bloque déjà un stock
-- négatif. Un compte "banque" peut légitimement aller à découvert — aucune
-- limite n'est imposée dans ce cas.
create or replace function public.verifier_solde_compte()
returns trigger language plpgsql as $$
declare
  v_type_compte varchar(20);
  v_solde numeric;
begin
  select type_compte, solde_initial into v_type_compte, v_solde
  from public.comptes_tresorerie
  where id = new.compte_tresorerie_id;

  if v_type_compte is distinct from 'banque' then
    select v_solde + coalesce(sum(case when type_mouvement = 'entree' then montant else -montant end), 0)
    into v_solde
    from public.journal_tresorerie
    where compte_tresorerie_id = new.compte_tresorerie_id;

    if new.type_mouvement = 'sortie' and (v_solde - new.montant) < 0 then
      raise exception 'Solde insuffisant sur ce compte (solde actuel : %, montant demandé : %)', v_solde, new.montant;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_verifier_solde_compte
  before insert on public.journal_tresorerie
  for each row execute procedure public.verifier_solde_compte();


-- Annulation de vente/achat, avec répercussion correcte sur le stock, les
-- créances/dettes et la trésorerie — la version précédente d'annulerVente
-- (app/(dashboard)/ventes/actions.ts) se contentait de changer `statut` sans
-- rien réconcilier, ce qui aurait laissé le stock, les créances/dettes et la
-- trésorerie faussés en permanence. Ce fichier corrige aussi un vrai bug
-- connexe : le coût moyen pondéré (cout_unitaire) utilisé par creer_vente
-- incluait les lignes d'achats déjà annulés.

-- 1) Le trigger de solde plancher (migration 17) ne couvrait que les INSERT ;
-- l'étendre à UPDATE pour qu'aucune modification directe d'une écriture ne
-- puisse contourner la règle "un compte non-banque ne passe jamais au négatif".
-- Le code applicatif privilégie delete+réinsertion plutôt qu'un UPDATE direct
-- (cf. updateEcritureTresorerie), mais le trigger reste la garantie ultime.
create or replace function public.verifier_solde_compte()
returns trigger language plpgsql as $$
declare
  v_type_compte varchar(20);
  v_solde numeric;
begin
  select type_compte, solde_initial into v_type_compte, v_solde
  from public.comptes_tresorerie
  where id = new.compte_tresorerie_id;

  if v_type_compte is distinct from 'banque' then
    select v_solde + coalesce(sum(case when type_mouvement = 'entree' then montant else -montant end), 0)
    into v_solde
    from public.journal_tresorerie
    where compte_tresorerie_id = new.compte_tresorerie_id
      and id is distinct from new.id;

    if new.type_mouvement = 'sortie' and (v_solde - new.montant) < 0 then
      raise exception 'Solde insuffisant sur ce compte (solde actuel : %, montant demandé : %)', v_solde, new.montant;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_verifier_solde_compte on public.journal_tresorerie;
create trigger trg_verifier_solde_compte
  before insert or update on public.journal_tresorerie
  for each row execute procedure public.verifier_solde_compte();

-- 2) Corrige creer_vente : le coût moyen pondéré doit ignorer les lignes
-- d'achats annulés, sinon le coût d'un achat annulé continue de peser sur la
-- marge des ventes futures alors que ces unités n'ont jamais été réellement
-- acquises. Reste identique par ailleurs à la version de la migration 10.
create or replace function public.creer_vente(
  p_magasin_id uuid,
  p_client_id uuid,
  p_mode_paiement varchar,
  p_montant_paye numeric,
  p_lignes jsonb
) returns uuid
language plpgsql as $$
declare
  v_vente_id uuid;
  v_montant_total numeric := 0;
  v_montant_restant numeric;
  v_ligne jsonb;
  v_cout_unitaire numeric;
  v_utilisateur_id uuid := auth.uid();
begin
  if not public.can_write_magasin(p_magasin_id) then
    raise exception 'Non autorisé pour ce magasin';
  end if;

  if jsonb_array_length(p_lignes) = 0 then
    raise exception 'Une vente doit comporter au moins une ligne';
  end if;

  select coalesce(sum((l->>'quantite')::numeric * (l->>'prix_unitaire')::numeric), 0)
  into v_montant_total
  from jsonb_array_elements(p_lignes) l;

  insert into public.ventes (magasin_id, client_id, mode_paiement, montant_total, montant_paye, statut, utilisateur_id)
  values (p_magasin_id, p_client_id, p_mode_paiement, v_montant_total, coalesce(p_montant_paye, 0), 'validee', v_utilisateur_id)
  returning id into v_vente_id;

  for v_ligne in select * from jsonb_array_elements(p_lignes) loop
    select coalesce(avg(la.prix_unitaire_achat), 0) into v_cout_unitaire
    from public.lignes_achat la
    join public.achats a on a.id = la.achat_id
    where la.article_id = (v_ligne->>'article_id')::uuid
      and la.magasin_id = p_magasin_id
      and a.statut = 'validee';

    insert into public.lignes_vente (vente_id, magasin_id, article_id, quantite, prix_unitaire, cout_unitaire)
    values (
      v_vente_id, p_magasin_id, (v_ligne->>'article_id')::uuid,
      (v_ligne->>'quantite')::numeric, (v_ligne->>'prix_unitaire')::numeric, v_cout_unitaire
    );

    insert into public.mouvements_stock (magasin_id, article_id, type_mouvement, quantite, reference_id, reference_type, utilisateur_id)
    values (p_magasin_id, (v_ligne->>'article_id')::uuid, 'sortie_vente', (v_ligne->>'quantite')::numeric, v_vente_id, 'vente', v_utilisateur_id);
  end loop;

  v_montant_restant := v_montant_total - coalesce(p_montant_paye, 0);

  if p_mode_paiement in ('credit', 'mixte') and v_montant_restant > 0 then
    insert into public.creances (magasin_id, client_id, vente_id, montant_initial, montant_restant, statut)
    values (p_magasin_id, p_client_id, v_vente_id, v_montant_restant, v_montant_restant, 'en_cours');
  end if;

  if coalesce(p_montant_paye, 0) > 0 then
    insert into public.journal_tresorerie (magasin_id, compte_tresorerie_id, type_mouvement, montant, categorie, reference_id, reference_type, motif, utilisateur_id)
    select p_magasin_id, ct.id, 'entree', p_montant_paye, 'vente', v_vente_id, 'vente', 'Encaissement vente', v_utilisateur_id
    from public.comptes_tresorerie ct
    where ct.magasin_id = p_magasin_id
    order by (ct.type_compte = 'caisse') desc, ct.id
    limit 1;
  end if;

  return v_vente_id;
end;
$$;

-- 3) annuler_vente : restaure le stock (mouvement compensatoire — jamais de
-- suppression physique de mouvements_stock, pour que le trigger
-- sync_stock_apres_mouvement recalcule stocks.quantite et que l'historique
-- reste complet), retire la créance liée et l'écriture de trésorerie liée,
-- puis marque la vente annulée. Bloque si la créance a déjà été réglée (même
-- partiellement) : annuler effacerait un règlement bien réel du client.
create or replace function public.annuler_vente(p_vente_id uuid)
returns void
language plpgsql as $$
declare
  v_magasin_id uuid;
  v_statut varchar;
  v_ligne record;
  v_creance_id uuid;
  v_creance_initial numeric;
  v_creance_restant numeric;
  v_utilisateur_id uuid := auth.uid();
begin
  select magasin_id, statut into v_magasin_id, v_statut
  from public.ventes where id = p_vente_id;

  if v_magasin_id is null then
    raise exception 'Vente introuvable';
  end if;
  if not public.can_write_magasin(v_magasin_id) then
    raise exception 'Non autorisé pour ce magasin';
  end if;
  if v_statut = 'annulee' then
    raise exception 'Cette vente est déjà annulée';
  end if;

  select id, montant_initial, montant_restant into v_creance_id, v_creance_initial, v_creance_restant
  from public.creances where vente_id = p_vente_id;

  if v_creance_id is not null and v_creance_restant <> v_creance_initial then
    raise exception 'Cette créance a déjà fait l''objet d''un règlement partiel ou total — annulation impossible';
  end if;

  for v_ligne in select article_id, quantite from public.lignes_vente where vente_id = p_vente_id loop
    insert into public.mouvements_stock (magasin_id, article_id, type_mouvement, quantite, reference_id, reference_type, utilisateur_id)
    values (v_magasin_id, v_ligne.article_id, 'ajustement_positif', v_ligne.quantite, p_vente_id, 'annulation_vente', v_utilisateur_id);
  end loop;

  if v_creance_id is not null then
    delete from public.creances where id = v_creance_id;
  end if;

  -- Retrait direct de l'écriture (pas de contre-écriture) : le solde de
  -- trésorerie est toujours recalculé à la volée par somme des lignes,
  -- contrairement au stock il n'y a ici aucun trigger dont on dépend pour
  -- maintenir un solde en cache — retirer l'écriture erronée est plus simple
  -- et plus sûr qu'une contre-écriture qui doublerait l'historique sans
  -- bénéfice de recalcul.
  delete from public.journal_tresorerie where reference_id = p_vente_id and reference_type = 'vente';

  update public.ventes set statut = 'annulee' where id = p_vente_id;
end;
$$;

-- 4) annuler_achat : symétrique. Si une partie du stock entré par cet achat a
-- déjà été revendue, le trigger sync_stock_apres_mouvement lève "Stock
-- insuffisant" sur le mouvement compensatoire et bloque l'annulation — c'est
-- le comportement voulu, on ne peut pas reprendre un stock déjà sorti.
create or replace function public.annuler_achat(p_achat_id uuid)
returns void
language plpgsql as $$
declare
  v_magasin_id uuid;
  v_statut varchar;
  v_ligne record;
  v_dette_id uuid;
  v_dette_initial numeric;
  v_dette_restant numeric;
  v_utilisateur_id uuid := auth.uid();
begin
  select magasin_id, statut into v_magasin_id, v_statut
  from public.achats where id = p_achat_id;

  if v_magasin_id is null then
    raise exception 'Achat introuvable';
  end if;
  if not public.can_write_magasin(v_magasin_id) then
    raise exception 'Non autorisé pour ce magasin';
  end if;
  if v_statut = 'annulee' then
    raise exception 'Cet achat est déjà annulé';
  end if;

  select id, montant_initial, montant_restant into v_dette_id, v_dette_initial, v_dette_restant
  from public.dettes where achat_id = p_achat_id;

  if v_dette_id is not null and v_dette_restant <> v_dette_initial then
    raise exception 'Cette dette a déjà fait l''objet d''un règlement partiel ou total — annulation impossible';
  end if;

  for v_ligne in select article_id, quantite from public.lignes_achat where achat_id = p_achat_id loop
    insert into public.mouvements_stock (magasin_id, article_id, type_mouvement, quantite, reference_id, reference_type, utilisateur_id)
    values (v_magasin_id, v_ligne.article_id, 'ajustement_negatif', v_ligne.quantite, p_achat_id, 'annulation_achat', v_utilisateur_id);
  end loop;

  if v_dette_id is not null then
    delete from public.dettes where id = v_dette_id;
  end if;

  delete from public.journal_tresorerie where reference_id = p_achat_id and reference_type = 'achat';

  update public.achats set statut = 'annulee' where id = p_achat_id;
end;
$$;


-- Ferme l'écart trouvé en audit : les policies RLS UPDATE/DELETE sur
-- journal_tresorerie/creances/dettes/mouvements_stock ne vérifient que le
-- tenant/rôle (can_write_magasin), pas si la ligne est liée à une
-- vente/achat/règlement — et aucune RPC (creer_vente, annuler_vente,
-- annuler_achat, regler_creance, regler_dette...) n'est security definer,
-- donc elles n'ont pas plus de droits qu'un appel direct du client Supabase.
-- Un gérant pouvait donc, en appelant directement le SDK (hors app), modifier
-- ou supprimer une ligne liée sans passer par annuler_vente/annuler_achat/
-- regler_creance/regler_dette, désynchronisant silencieusement stock/
-- trésorerie/créances/dettes de la vente/achat/règlement qui les a produites.
--
-- Ces triggers verrouillent ces tables au niveau base. Les RPC légitimes qui
-- doivent transgresser (regler_creance, regler_dette, annuler_vente,
-- annuler_achat) posent un drapeau de session avant leur UPDATE/DELETE, via
-- set_config(..., is_local => true) : limité à la transaction en cours, donc
-- automatiquement réinitialisé à la fin de l'appel RPC (chaque appel RPC
-- s'exécute comme sa propre transaction côté PostgREST/Supabase) — aucune
-- fuite possible vers une requête ultérieure sur la même connexion poolée.

-- Second correctif de l'audit, sans rapport avec les triggers ci-dessus :
-- annuler_vente/annuler_achat suppriment une ligne de journal_tresorerie par
-- (reference_id, reference_type) sans index dédié — balayage complet de la
-- table (tous magasins/entreprises confondus) à chaque annulation. Négligeable
-- au volume actuel, mais se dégrade avec la table ; index partiel peu coûteux
-- à maintenir puisqu'il ne couvre que les lignes réellement liées.
create index if not exists idx_journal_tresorerie_reference
  on public.journal_tresorerie(reference_id, reference_type)
  where reference_id is not null;

create or replace function public.verifier_pas_modif_directe_tresorerie()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.bypass_lignes_liees', true), '') = 'on' then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' then
    if old.reference_type is not null then
      raise exception 'Cette écriture est liée à une vente, un achat, une charge ou un règlement — modifiez-la depuis son origine.';
    end if;
    return new;
  end if;

  -- DELETE : seules les écritures manuelles (reference_type null) ou liées à
  -- une charge (reference_type = 'charge', gérée directement par
  -- charges/actions.ts qui fait son propre delete+réinsertion) sont
  -- supprimables hors RPC. Vente/achat/créance/dette ne le sont jamais
  -- directement : uniquement via annuler_vente/annuler_achat.
  if old.reference_type is not null and old.reference_type <> 'charge' then
    raise exception 'Cette écriture est liée à une vente, un achat ou un règlement — supprimez-la depuis son origine.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_proteger_journal_tresorerie on public.journal_tresorerie;
create trigger trg_proteger_journal_tresorerie
  before update or delete on public.journal_tresorerie
  for each row execute procedure public.verifier_pas_modif_directe_tresorerie();

create or replace function public.verifier_pas_modif_directe_creance_dette()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.bypass_lignes_liees', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  raise exception 'Cette opération doit passer par le règlement ou l''annulation de la vente/achat d''origine.';
end;
$$;

drop trigger if exists trg_proteger_creances on public.creances;
create trigger trg_proteger_creances
  before update or delete on public.creances
  for each row execute procedure public.verifier_pas_modif_directe_creance_dette();

drop trigger if exists trg_proteger_dettes on public.dettes;
create trigger trg_proteger_dettes
  before update or delete on public.dettes
  for each row execute procedure public.verifier_pas_modif_directe_creance_dette();

-- mouvements_stock : grand livre append-only, aucun code applicatif ni aucune
-- RPC ne modifie/supprime une ligne existante — toute correction passe par un
-- nouveau mouvement compensatoire (cf. annuler_vente/annuler_achat, migration
-- 18). Verrou inconditionnel, sans drapeau de contournement puisqu'aucun
-- chemin légitime n'en a besoin.
create or replace function public.interdire_modif_mouvements_stock()
returns trigger language plpgsql as $$
begin
  raise exception 'Un mouvement de stock ne peut être ni modifié ni supprimé — utilisez un mouvement compensatoire.';
end;
$$;

drop trigger if exists trg_interdire_modif_mouvements_stock on public.mouvements_stock;
create trigger trg_interdire_modif_mouvements_stock
  before update or delete on public.mouvements_stock
  for each row execute procedure public.interdire_modif_mouvements_stock();

-- Les quatre RPC qui transgressent légitimement : identiques à leur dernière
-- version (migrations 11 et 18), avec l'ajout du set_config juste avant leur
-- premier UPDATE/DELETE sur une table protégée ci-dessus.

create or replace function public.regler_creance(
  p_creance_id uuid,
  p_montant numeric,
  p_compte_tresorerie_id uuid
) returns void
language plpgsql as $$
declare
  v_magasin_id uuid;
  v_restant numeric;
  v_utilisateur_id uuid := auth.uid();
begin
  select magasin_id, montant_restant into v_magasin_id, v_restant
  from public.creances where id = p_creance_id
  for update;

  if v_magasin_id is null then
    raise exception 'Créance introuvable';
  end if;

  if not public.can_write_magasin(v_magasin_id) then
    raise exception 'Non autorisé pour ce magasin';
  end if;

  if p_montant <= 0 or p_montant > v_restant then
    raise exception 'Montant de règlement invalide (reste dû : %)', v_restant;
  end if;

  perform set_config('app.bypass_lignes_liees', 'on', true);

  update public.creances
  set montant_restant = v_restant - p_montant,
      statut = case when v_restant - p_montant <= 0 then 'soldee' else 'en_cours' end
  where id = p_creance_id;

  insert into public.journal_tresorerie (magasin_id, compte_tresorerie_id, type_mouvement, montant, categorie, reference_id, reference_type, motif, utilisateur_id)
  values (v_magasin_id, p_compte_tresorerie_id, 'entree', p_montant, 'reglement_creance', p_creance_id, 'creance', 'Règlement créance', v_utilisateur_id);
end;
$$;

create or replace function public.regler_dette(
  p_dette_id uuid,
  p_montant numeric,
  p_compte_tresorerie_id uuid
) returns void
language plpgsql as $$
declare
  v_magasin_id uuid;
  v_restant numeric;
  v_utilisateur_id uuid := auth.uid();
begin
  select magasin_id, montant_restant into v_magasin_id, v_restant
  from public.dettes where id = p_dette_id
  for update;

  if v_magasin_id is null then
    raise exception 'Dette introuvable';
  end if;

  if not public.can_write_magasin(v_magasin_id) then
    raise exception 'Non autorisé pour ce magasin';
  end if;

  if p_montant <= 0 or p_montant > v_restant then
    raise exception 'Montant de règlement invalide (reste dû : %)', v_restant;
  end if;

  perform set_config('app.bypass_lignes_liees', 'on', true);

  update public.dettes
  set montant_restant = v_restant - p_montant,
      statut = case when v_restant - p_montant <= 0 then 'soldee' else 'en_cours' end
  where id = p_dette_id;

  insert into public.journal_tresorerie (magasin_id, compte_tresorerie_id, type_mouvement, montant, categorie, reference_id, reference_type, motif, utilisateur_id)
  values (v_magasin_id, p_compte_tresorerie_id, 'sortie', p_montant, 'reglement_dette', p_dette_id, 'dette', 'Règlement dette', v_utilisateur_id);
end;
$$;

create or replace function public.annuler_vente(p_vente_id uuid)
returns void
language plpgsql as $$
declare
  v_magasin_id uuid;
  v_statut varchar;
  v_ligne record;
  v_creance_id uuid;
  v_creance_initial numeric;
  v_creance_restant numeric;
  v_utilisateur_id uuid := auth.uid();
begin
  select magasin_id, statut into v_magasin_id, v_statut
  from public.ventes where id = p_vente_id;

  if v_magasin_id is null then
    raise exception 'Vente introuvable';
  end if;
  if not public.can_write_magasin(v_magasin_id) then
    raise exception 'Non autorisé pour ce magasin';
  end if;
  if v_statut = 'annulee' then
    raise exception 'Cette vente est déjà annulée';
  end if;

  select id, montant_initial, montant_restant into v_creance_id, v_creance_initial, v_creance_restant
  from public.creances where vente_id = p_vente_id;

  if v_creance_id is not null and v_creance_restant <> v_creance_initial then
    raise exception 'Cette créance a déjà fait l''objet d''un règlement partiel ou total — annulation impossible';
  end if;

  for v_ligne in select article_id, quantite from public.lignes_vente where vente_id = p_vente_id loop
    insert into public.mouvements_stock (magasin_id, article_id, type_mouvement, quantite, reference_id, reference_type, utilisateur_id)
    values (v_magasin_id, v_ligne.article_id, 'ajustement_positif', v_ligne.quantite, p_vente_id, 'annulation_vente', v_utilisateur_id);
  end loop;

  perform set_config('app.bypass_lignes_liees', 'on', true);

  if v_creance_id is not null then
    delete from public.creances where id = v_creance_id;
  end if;

  delete from public.journal_tresorerie where reference_id = p_vente_id and reference_type = 'vente';

  update public.ventes set statut = 'annulee' where id = p_vente_id;
end;
$$;

create or replace function public.annuler_achat(p_achat_id uuid)
returns void
language plpgsql as $$
declare
  v_magasin_id uuid;
  v_statut varchar;
  v_ligne record;
  v_dette_id uuid;
  v_dette_initial numeric;
  v_dette_restant numeric;
  v_utilisateur_id uuid := auth.uid();
begin
  select magasin_id, statut into v_magasin_id, v_statut
  from public.achats where id = p_achat_id;

  if v_magasin_id is null then
    raise exception 'Achat introuvable';
  end if;
  if not public.can_write_magasin(v_magasin_id) then
    raise exception 'Non autorisé pour ce magasin';
  end if;
  if v_statut = 'annulee' then
    raise exception 'Cet achat est déjà annulé';
  end if;

  select id, montant_initial, montant_restant into v_dette_id, v_dette_initial, v_dette_restant
  from public.dettes where achat_id = p_achat_id;

  if v_dette_id is not null and v_dette_restant <> v_dette_initial then
    raise exception 'Cette dette a déjà fait l''objet d''un règlement partiel ou total — annulation impossible';
  end if;

  for v_ligne in select article_id, quantite from public.lignes_achat where achat_id = p_achat_id loop
    insert into public.mouvements_stock (magasin_id, article_id, type_mouvement, quantite, reference_id, reference_type, utilisateur_id)
    values (v_magasin_id, v_ligne.article_id, 'ajustement_negatif', v_ligne.quantite, p_achat_id, 'annulation_achat', v_utilisateur_id);
  end loop;

  perform set_config('app.bypass_lignes_liees', 'on', true);

  if v_dette_id is not null then
    delete from public.dettes where id = v_dette_id;
  end if;

  delete from public.journal_tresorerie where reference_id = p_achat_id and reference_type = 'achat';

  update public.achats set statut = 'annulee' where id = p_achat_id;
end;
$$;


GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
