-- Enable RLS on contests table
ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;

-- Policy 1: Public Read Access
-- Allow anyone (authenticated or anonymous) to view contest data
CREATE POLICY "Enable read access for all users" ON public.contests
FOR SELECT
USING (true);

-- Policy 2: Authenticated Insert
-- Only logged-in users can create contests
CREATE POLICY "Enable insert for authenticated users only" ON public.contests
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Policy 3: Owner Update
-- Only the owner can update their contest
CREATE POLICY "Enable update for owners only" ON public.contests
FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Policy 4: Owner Delete
-- Only the owner can delete their contest
CREATE POLICY "Enable delete for owners only" ON public.contests
FOR DELETE
USING (auth.uid() = owner_id);
