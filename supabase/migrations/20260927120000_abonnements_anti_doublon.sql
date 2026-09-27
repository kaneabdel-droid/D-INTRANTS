-- Anti double paiement d'abonnement.
--
-- 1. checkout_url : la page de paiement du prestataire est mémorisée pour être
--    renvoyée telle quelle si le client relance le même paiement (double clic,
--    second onglet, retour arrière) au lieu d'ouvrir une seconde transaction.
-- 2. abandonne_le : une tentative en attente remplacée par une nouvelle reste
--    'en_attente' (si elle est finalement payée, l'argent n'est pas perdu : elle
--    est traitée, et marquée doublon si l'offre était déjà réglée) mais ne compte
--    plus comme « le » paiement en cours de l'entreprise. Remplace l'ancien
--    passage direct à 'echoue', qui ignorait un paiement arrivé ensuite.
-- 3. doublon : paiement encaissé alors que la même offre venait d'être réglée par
--    une autre tentative. Il ne prolonge pas l'abonnement, est exclu des
--    statistiques de vente et signalé à rembourser dans /admin/paiements.
alter table public.abonnements
  add column if not exists checkout_url text,
  add column if not exists abandonne_le timestamptz,
  add column if not exists doublon boolean not null default false;

-- Existant : ne garder que la tentative en attente la plus récente de chaque
-- entreprise, sinon l'index unique ci-dessous ne pourrait pas être créé.
update public.abonnements a
set abandonne_le = now()
where a.statut = 'en_attente'
  and a.abandonne_le is null
  and a.entreprise_id is not null
  and exists (
    select 1 from public.abonnements r
    where r.entreprise_id = a.entreprise_id
      and r.statut = 'en_attente'
      and r.abandonne_le is null
      and (r.created_at, r.id) > (a.created_at, a.id)
  );

-- Un seul paiement en cours par entreprise : protège contre deux requêtes
-- simultanées (double clic, deux onglets). Les demandes publiques (sans
-- entreprise, cf. app/tarifs/actions.ts) sont dédoublonnées côté application.
create unique index if not exists abonnements_un_en_cours_par_entreprise
  on public.abonnements (entreprise_id)
  where statut = 'en_attente' and abandonne_le is null and entreprise_id is not null;
