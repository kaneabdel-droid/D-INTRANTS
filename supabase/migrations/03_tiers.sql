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
