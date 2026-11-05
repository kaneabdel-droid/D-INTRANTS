-- Migration 30 : Abonnement Premium Plus, Comptabilité Complète & États Financiers SYSCOHADA

-- 1. Ajout du palier Premium Plus dans paliers_abonnement
insert into public.paliers_abonnement (code, nom, magasins_max, prix_mensuel_fcfa)
values ('premium_plus', 'Premium Plus', 5, 15000)
on conflict (code) do update set
  nom = excluded.nom,
  magasins_max = excluded.magasins_max,
  prix_mensuel_fcfa = excluded.prix_mensuel_fcfa;

-- 2. Mise à jour de la contrainte CHECK sur le palier d'entreprise
alter table public.entreprises drop constraint if exists entreprises_palier_check;
alter table public.entreprises add constraint entreprises_palier_check check (palier in ('standard', 'medium', 'premium', 'premium_plus'));

-- 3. Table du Plan Comptable SYSCOHADA (partagé + personnalisable par entreprise)
create table if not exists public.plan_comptable (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid references public.entreprises(id) on delete cascade,
  compte varchar(10) not null,
  libelle varchar(200) not null,
  classe smallint not null,
  type varchar(30) not null default 'autre',
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_plan_comptable_entreprise on public.plan_comptable(entreprise_id, compte);
create index if not exists idx_plan_comptable_classe on public.plan_comptable(classe);

-- 4. Table des Exercices Comptables
create table if not exists public.exercices_comptables (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid references public.entreprises(id) on delete cascade not null,
  libelle varchar(100) not null,
  date_debut date not null,
  date_fin date not null,
  cloture boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_exercices_entreprise on public.exercices_comptables(entreprise_id, date_debut);

-- 5. Table des Écritures Comptables (En-têtes de pièces)
create table if not exists public.ecritures_comptables (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid references public.entreprises(id) on delete cascade not null,
  exercice_id uuid references public.exercices_comptables(id) on delete set null,
  journal varchar(20) not null check (journal in ('ventes', 'achats', 'caisse', 'banque', 'mobile', 'od')),
  date_ecriture date not null default current_date,
  numero_piece varchar(60),
  libelle varchar(255) not null,
  source_module varchar(30), -- 'ventes', 'achats', 'tresorerie', 'manuel'
  source_id uuid,
  validee boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_ecritures_entreprise_date on public.ecritures_comptables(entreprise_id, date_ecriture desc);
create index if not exists idx_ecritures_journal on public.ecritures_comptables(entreprise_id, journal);
create index if not exists idx_ecritures_source on public.ecritures_comptables(entreprise_id, source_module, source_id);

-- 6. Table des Lignes d'Écritures Comptables (Partie double)
create table if not exists public.lignes_ecritures_comptables (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid references public.entreprises(id) on delete cascade not null,
  ecriture_id uuid references public.ecritures_comptables(id) on delete cascade not null,
  compte varchar(10) not null,
  libelle varchar(255),
  debit numeric(18, 2) not null default 0 check (debit >= 0),
  credit numeric(18, 2) not null default 0 check (credit >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_lignes_ecriture on public.lignes_ecritures_comptables(ecriture_id);
create index if not exists idx_lignes_compte on public.lignes_ecritures_comptables(entreprise_id, compte);

-- 7. Vue synthétique Balance Générale SYSCOHADA
create or replace view public.v_balance with (security_invoker = true) as
select
  l.entreprise_id,
  e.exercice_id,
  l.compte as numero,
  coalesce(max(p.libelle), 'Compte ' || l.compte) as libelle,
  left(l.compte, 1)::smallint as classe,
  sum(l.debit) as total_debit,
  sum(l.credit) as total_credit,
  sum(l.debit) - sum(l.credit) as solde
from public.lignes_ecritures_comptables l
join public.ecritures_comptables e on e.id = l.ecriture_id
left join public.plan_comptable p on p.compte = l.compte and (p.entreprise_id = l.entreprise_id or p.entreprise_id is null)
group by l.entreprise_id, e.exercice_id, l.compte;

-- 8. Activation de la Sécurité RLS
alter table public.plan_comptable enable row level security;
alter table public.exercices_comptables enable row level security;
alter table public.ecritures_comptables enable row level security;
alter table public.lignes_ecritures_comptables enable row level security;

drop policy if exists "select_plan_comptable" on public.plan_comptable;
create policy "select_plan_comptable" on public.plan_comptable for select
  using (entreprise_id is null or entreprise_id = public.current_entreprise_id());

drop policy if exists "all_plan_comptable_entreprise" on public.plan_comptable;
create policy "all_plan_comptable_entreprise" on public.plan_comptable for all
  using (entreprise_id = public.current_entreprise_id());

drop policy if exists "all_exercices_entreprise" on public.exercices_comptables;
create policy "all_exercices_entreprise" on public.exercices_comptables for all
  using (entreprise_id = public.current_entreprise_id());

drop policy if exists "all_ecritures_entreprise" on public.ecritures_comptables;
create policy "all_ecritures_entreprise" on public.ecritures_comptables for all
  using (entreprise_id = public.current_entreprise_id());

drop policy if exists "all_lignes_ecritures_entreprise" on public.lignes_ecritures_comptables;
create policy "all_lignes_ecritures_entreprise" on public.lignes_ecritures_comptables for all
  using (entreprise_id = public.current_entreprise_id());

-- 9. Insertion des comptes clés du Plan Comptable SYSCOHADA Révisé (modèle de référence partagé)
insert into public.plan_comptable (entreprise_id, compte, libelle, classe, type)
values
  -- Classe 1 : Capitaux
  (null, '101', 'Capital social', 1, 'passif'),
  (null, '111', 'Report à nouveau créditeur', 1, 'passif'),
  (null, '112', 'Report à nouveau débiteur', 1, 'passif'),
  (null, '121', 'Résultat net de l''exercice (bénéfice)', 1, 'passif'),
  (null, '129', 'Résultat net de l''exercice (perte)', 1, 'passif'),
  (null, '162', 'Emprunts auprès des établissements de crédit', 1, 'passif'),
  -- Classe 2 : Immobilisations
  (null, '211', 'Terrains', 2, 'actif'),
  (null, '213', 'Bâtiments et installations', 2, 'actif'),
  (null, '215', 'Matériel et outillage', 2, 'actif'),
  (null, '218', 'Matériel de transport et logistique', 2, 'actif'),
  (null, '241', 'Matériel et mobilier de bureau', 2, 'actif'),
  (null, '281', 'Amortissements des immobilisations corporelles', 2, 'actif'),
  -- Classe 3 : Stocks
  (null, '311', 'Stocks de marchandises / intrants', 3, 'actif'),
  (null, '321', 'Matières premières et fournitures liées', 3, 'actif'),
  (null, '391', 'Dépréciations des stocks de marchandises', 3, 'actif'),
  -- Classe 4 : Tiers
  (null, '401', 'Fournisseurs d''exploitation', 4, 'passif'),
  (null, '408', 'Fournisseurs - Factures non parvenues', 4, 'passif'),
  (null, '411', 'Clients', 4, 'actif'),
  (null, '416', 'Créances clients douteuses ou litigieuses', 4, 'actif'),
  (null, '421', 'Personnel - Rémunérations dues', 4, 'passif'),
  (null, '431', 'Sécurité sociale et caisses de prévoyance (IPRES, CSS)', 4, 'passif'),
  (null, '441', 'État - Impôts, taxes et versements assimilés', 4, 'passif'),
  (null, '443', 'État - TVA facturée', 4, 'passif'),
  (null, '445', 'État - TVA récupérable', 4, 'actif'),
  (null, '467', 'Autres comptes débiteurs ou créditeurs', 4, 'autre'),
  -- Classe 5 : Trésorerie
  (null, '521', 'Banques locales', 5, 'tresorerie'),
  (null, '531', 'Caisse principale', 5, 'tresorerie'),
  (null, '571', 'Comptes Mobile Money (Wave, Orange Money)', 5, 'tresorerie'),
  (null, '585', 'Virements internes de fonds', 5, 'tresorerie'),
  -- Classe 6 : Charges
  (null, '601', 'Achats de marchandises / intrants', 6, 'charge'),
  (null, '602', 'Achats de matières et fournitures consommables', 6, 'charge'),
  (null, '604', 'Achats d''études et prestations de services', 6, 'charge'),
  (null, '605', 'Autres achats', 6, 'charge'),
  (null, '608', 'Achats d''emballages', 6, 'charge'),
  (null, '611', 'Transports sur achats', 6, 'charge'),
  (null, '622', 'Locations et charges locatives', 6, 'charge'),
  (null, '624', 'Entretien et réparations', 6, 'charge'),
  (null, '625', 'Primes d''assurance', 6, 'charge'),
  (null, '627', 'Publicité, publications, relations publiques', 6, 'charge'),
  (null, '628', 'Frais de télécommunications et internet', 6, 'charge'),
  (null, '631', 'Frais bancaires et commissions', 6, 'charge'),
  (null, '641', 'Impôts et taxes directs', 6, 'charge'),
  (null, '661', 'Rémunérations directes versées au personnel', 6, 'charge'),
  (null, '664', 'Charges sociales (IPRES, CSS)', 6, 'charge'),
  (null, '671', 'Intérêts des emprunts et dettes financières', 6, 'charge'),
  (null, '681', 'Dotations aux amortissements d''exploitation', 6, 'charge'),
  -- Classe 7 : Produits
  (null, '701', 'Ventes de marchandises / intrants', 7, 'produit'),
  (null, '706', 'Services vendus et prestations', 7, 'produit'),
  (null, '707', 'Produits accessoires', 7, 'produit'),
  (null, '754', 'Ristournes et rabais obtenus', 7, 'produit'),
  (null, '771', 'Intérêts de prêts et revenus assimilés', 7, 'produit'),
  (null, '781', 'Reprises d''amortissements et de provisions', 7, 'produit'),
  -- Classe 8 : Hors Activités Ordinaires (HAO)
  (null, '831', 'Charges exceptionnelles sur opérations de gestion', 8, 'charge'),
  (null, '841', 'Produits exceptionnels sur opérations de gestion', 8, 'produit'),
  (null, '851', 'Dotations exceptionnelles aux amortissements', 8, 'charge'),
  (null, '891', 'Impôts sur les bénéfices de l''exercice', 8, 'charge')
on conflict do nothing;
