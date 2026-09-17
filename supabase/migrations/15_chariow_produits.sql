-- Miroir de la table du même nom côté SIGGIE (chariow_produits), mais keyée par
-- palier×durée plutôt que par montant : d-intrants a 3 paliers × 3 durées (9
-- produits Chariow possibles) plutôt qu'un tarif unique par montant. Permet à
-- l'admin système de faire pointer un palier/durée vers un autre product_id
-- Chariow sans redéploiement (cf. lib/abonnements/providers/chariow.ts, qui lit
-- cette table en priorité et retombe sur les variables d'env CHARIOW_PRODUCT_*
-- si la ligne est absente).
create table public.chariow_produits (
  palier varchar(20) not null check (palier in ('standard', 'medium', 'premium')),
  duree_mois integer not null check (duree_mois in (1, 6, 12)),
  product_id varchar(255) not null,
  updated_at timestamptz default now(),
  primary key (palier, duree_mois)
);

-- Écriture réservée au service-role (admin), comme entreprises/utilisateurs :
-- aucune policy insert/update/delete exposée à authenticated. Lecture publique
-- inutile ici (jamais consultée depuis un client authentifié), donc RLS activée
-- sans aucune policy select non plus.
alter table public.chariow_produits enable row level security;
