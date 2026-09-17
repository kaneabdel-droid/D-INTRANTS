-- Facturation de la plateforme d-intrants elle-même (paiement des abonnements
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
