-- Migration: Ajout de l'identifiant, nom complet et gestion des collaborateurs par l'administrateur entreprise
-- Conforme au standard DEMBA_GLOBAL_SECURITY_AND_PERFORMANCE_ARCHITECTURE.md

ALTER TABLE public.utilisateurs
  ADD COLUMN IF NOT EXISTS identifiant varchar(100),
  ADD COLUMN IF NOT EXISTS nom_complet varchar(200);

-- Unicité de l'identifiant (insensible à la casse)
CREATE UNIQUE INDEX IF NOT EXISTS idx_utilisateurs_identifiant_unique
  ON public.utilisateurs (lower(identifiant))
  WHERE identifiant IS NOT NULL;

-- Index sur le téléphone pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_utilisateurs_telephone_search
  ON public.utilisateurs (telephone)
  WHERE telephone IS NOT NULL;

-- Assouplissement du check de rôle pour supporter les rôles opérationnels du magasin
ALTER TABLE public.utilisateurs DROP CONSTRAINT IF EXISTS utilisateurs_role_check;
ALTER TABLE public.utilisateurs ADD CONSTRAINT utilisateurs_role_check
  CHECK (role IN ('admin_entreprise', 'gerant', 'tresorier', 'caissier', 'magasinier', 'collaborateur'));

-- Cohérence magasin : un admin_entreprise n'a pas de magasin spécifique,
-- les collaborateurs de terrain peuvent être rattachés à un magasin ou à l'entreprise
ALTER TABLE public.utilisateurs DROP CONSTRAINT IF EXISTS role_magasin_coherence;
ALTER TABLE public.utilisateurs ADD CONSTRAINT role_magasin_coherence CHECK (
  (role = 'admin_entreprise' AND magasin_id IS NULL) OR
  (role <> 'admin_entreprise')
);

-- RLS : Permettre aux administrateurs de l'entreprise de consulter tous les collaborateurs de leur entreprise
DROP POLICY IF EXISTS "admin_select_utilisateurs_entreprise" ON public.utilisateurs;
CREATE POLICY "admin_select_utilisateurs_entreprise"
ON public.utilisateurs FOR SELECT
USING (
  entreprise_id IN (
    SELECT u.entreprise_id FROM public.utilisateurs u WHERE u.id = auth.uid() AND u.role = 'admin_entreprise'
  )
);
