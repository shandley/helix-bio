-- Soft delete support for sequences
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- Index for fast trash queries per user
CREATE INDEX IF NOT EXISTS sequences_user_deleted_at_idx ON public.sequences (user_id, deleted_at);
