-- Correction de la récursion infinie RLS sur la table utilisateurs
-- L'ancienne policy interrogeait directement utilisateurs dans sa sous-requête,
-- provoquant une récursion infinie (code erreur Postgres 42P17) lors de la lecture du profil après connexion.

DROP POLICY IF EXISTS "admin_select_utilisateurs_entreprise" ON public.utilisateurs;

CREATE POLICY "admin_select_utilisateurs_entreprise"
ON public.utilisateurs FOR SELECT
USING (
  entreprise_id = public.current_entreprise_id()
);
