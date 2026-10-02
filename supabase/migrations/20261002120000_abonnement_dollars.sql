-- Abonnement payé en dollars US par les clients d'un pays dont la devise n'est pas gérée (« Autre pays », lib/pays.ts).
-- montant_fcfa garde l'équivalent FCFA (statistiques, anti double paiement) ; devise et montant_devise portent le
-- montant réellement demandé au prestataire, contrôlé à la réconciliation (lib/abonnements/reconcile.ts).
alter table public.abonnements
  add column if not exists devise varchar(3) not null default 'XOF',
  add column if not exists montant_devise numeric(12, 2);
