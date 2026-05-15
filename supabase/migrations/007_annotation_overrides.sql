-- Persist per-sequence annotation overrides (rename, recolor, delete) in the DB
-- so edits survive across browsers and devices.
-- Keyed by sequence id; RLS scoped to the sequence owner via the sequences table.

ALTER TABLE public.sequences
  ADD COLUMN IF NOT EXISTS annotation_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;
