-- 20_fiche_entreprise.sql
alter table public.entreprises
  add column email varchar(255),
  add column identifiant_fiscal varchar(100),   -- NINEA, ou équivalent pays
  add column logo_url text;
