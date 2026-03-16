-- 1. Create logs_tache table
CREATE TABLE IF NOT EXISTS public.logs_tache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tache_id UUID NOT NULL REFERENCES public.taches(id) ON DELETE CASCADE,
    utilisateur_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('fait', 'probleme', 'prevu')),
    contenu TEXT NOT NULL,
    cree_le TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Turn on RLS
ALTER TABLE public.logs_tache ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Select (Read) logs if you are the creator of the task or an accepted member
CREATE POLICY "Users can view logs of tasks they are involved in"
ON public.logs_tache FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.taches t
        LEFT JOIN public.membres_tache mt ON t.id = mt.tache_id AND mt.utilisateur_id = auth.uid() AND mt.statut = 'accepte'
        WHERE t.id = logs_tache.tache_id
        AND (t.createur_id = auth.uid() OR mt.utilisateur_id IS NOT NULL)
    )
);

-- 4. Policy: Insert logs if you are the creator or an accepted member
CREATE POLICY "Users can insert logs for tasks they are involved in"
ON public.logs_tache FOR INSERT
WITH CHECK (
    auth.uid() = utilisateur_id AND
    EXISTS (
        SELECT 1 FROM public.taches t
        LEFT JOIN public.membres_tache mt ON t.id = mt.tache_id AND mt.utilisateur_id = auth.uid() AND mt.statut = 'accepte'
        WHERE t.id = tache_id
        AND (t.createur_id = auth.uid() OR mt.utilisateur_id IS NOT NULL)
    )
);

-- 5. RESTRICT SOUS-TACHES
-- Drop the existing insert policy for sous_taches to replace it with a strict one
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.sous_taches;

-- Create new restrictive policy: ONLY the task creator can insert subtasks
CREATE POLICY "Only task creator can insert subtasks"
ON public.sous_taches FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.taches t
        WHERE t.id = tache_id
        AND t.createur_id = auth.uid()
    )
);
