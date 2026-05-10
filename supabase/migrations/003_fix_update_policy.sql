-- Add WITH CHECK to UPDATE policy so users cannot change the user_id
-- of their own sequences to point to another user's account.
ALTER POLICY "Users can update own sequences" ON public.sequences
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
