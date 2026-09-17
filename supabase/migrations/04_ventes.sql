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
