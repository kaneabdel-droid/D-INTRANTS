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
