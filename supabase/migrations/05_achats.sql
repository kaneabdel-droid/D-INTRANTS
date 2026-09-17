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
