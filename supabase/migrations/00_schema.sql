-- Schéma initial d-intrants : tenancy à deux niveaux (entreprises -> magasins).
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
