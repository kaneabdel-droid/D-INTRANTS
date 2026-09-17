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
