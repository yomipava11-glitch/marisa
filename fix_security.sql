-- Copiez-collez ce SQL dans: Supabase Dashboard > SQL Editor > New Query

-- SECURITE 1: Restreindre SELECT sur membres_tache
-- (Avant: tout le monde voyait tous les membres; Maintenant: seulement les siens)
DROP POLICY IF EXISTS "Membres visibles par tous" ON public.membres_tache;

CREATE POLICY "Membres visibles par membres ou createur"
ON public.membres_tache
FOR SELECT
TO authenticated
USING (
  utilisateur_id = auth.uid()
  OR tache_id IN (
    SELECT id FROM public.taches WHERE createur_id = auth.uid()
  )
);

-- SECURITE 2: Restreindre SELECT sur flux_activite
-- (Avant: tout le monde voyait toutes les activites; Maintenant: seulement ses taches)
DROP POLICY IF EXISTS "Flux visible par tout le monde" ON public.flux_activite;

CREATE POLICY "Flux visible par membres de la tache"
ON public.flux_activite
FOR SELECT
TO authenticated
USING (
  tache_id IN (
    SELECT id FROM public.taches WHERE createur_id = auth.uid()
  )
  OR tache_id IN (
    SELECT tache_id FROM public.membres_tache WHERE utilisateur_id = auth.uid()
  )
);

-- SECURITE 3: Fixer le search_path des fonctions DB
ALTER FUNCTION public.creer_profil_utilisateur() SET search_path = public, pg_temp;
ALTER FUNCTION public.search_user_by_email(text) SET search_path = public, pg_temp;
