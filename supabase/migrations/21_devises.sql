-- 21_devises.sql
create table public.devises (
  code varchar(10) primary key,        -- ISO 4217 : XOF, MRU, MAD, GNF...
  nom varchar(100) not null,
  symbole varchar(10) not null
);

insert into public.devises (code, nom, symbole) values
  ('XOF', 'Franc CFA (UEMOA)', 'FCFA'),
  ('MRU', 'Ouguiya mauritanien', 'MRU'),
  ('MAD', 'Dirham marocain', 'DH'),
  ('GNF', 'Franc guinéen', 'GNF');

alter table public.entreprises
  add constraint entreprises_devise_fkey foreign key (devise) references public.devises(code);
