-- Paiement public avant création de compte (page /tarifs, visiteur anonyme) :
-- réutilise la table abonnements existante plutôt qu'une table parallèle avec
-- ses propres webhooks/reconciliation. Une ligne à entreprise_id null qui passe
-- à statut='paye' est une "demande" à traiter par l'admin système — cf.
-- app/tarifs/actions.ts et app/admin/(protected)/demandes/. Le nom d'entreprise
-- demandé et les coordonnées de contact vont dans `metadata` (déjà un sac JSON
-- libre pour cette table, cf. 13_abonnements.sql), pas de nouvelle colonne.
alter table public.abonnements
  alter column entreprise_id drop not null;

-- La policy RLS existante (entreprise_id = current_entreprise_id()) exclut déjà
-- naturellement les lignes à entreprise_id null pour tout utilisateur
-- authentifié (comparaison à NULL = NULL, jamais vraie) : aucune demande en
-- attente n'est visible depuis un compte entreprise, seul le client
-- service-role (admin) peut les lire.
