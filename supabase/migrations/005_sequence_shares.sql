-- Shareable links for sequences.
-- Each share has a short random token used in the URL: ori-bio.app/s/[token]
-- Anyone with the link can view the sequence without an account.

CREATE TABLE IF NOT EXISTS public.sequence_shares (
    id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    token      TEXT    UNIQUE NOT NULL,             -- short URL-safe string, e.g. "xK7mPq2n"
    sequence_id UUID   NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
    created_by UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    view_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS sequence_shares_token_idx      ON public.sequence_shares (token);
CREATE INDEX IF NOT EXISTS sequence_shares_sequence_idx   ON public.sequence_shares (sequence_id);
CREATE INDEX IF NOT EXISTS sequence_shares_created_by_idx ON public.sequence_shares (created_by);

-- RLS: anyone can read shares (enables public share links)
--      only the owner can create/delete their own shares
ALTER TABLE public.sequence_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shares"
    ON public.sequence_shares FOR SELECT
    USING (true);

CREATE POLICY "Users can create shares for their own sequences"
    ON public.sequence_shares FOR INSERT
    WITH CHECK (
        auth.uid() = created_by AND
        EXISTS (
            SELECT 1 FROM public.sequences
            WHERE id = sequence_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own shares"
    ON public.sequence_shares FOR DELETE
    USING (auth.uid() = created_by);
