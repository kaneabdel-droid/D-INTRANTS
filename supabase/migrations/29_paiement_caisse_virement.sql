-- Autorise les paiements d'abonnement par caisse (espèces) ou virement bancaire,
-- ainsi que l'activation directe par le super-administrateur.
alter table public.abonnements drop constraint if exists abonnements_provider_check;
alter table public.abonnements add constraint abonnements_provider_check
    check (provider in ('chariow', 'moneroo', 'bictorys', 'maketou', 'caisse', 'virement', 'manuel'));

