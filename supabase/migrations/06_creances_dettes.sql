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
