-- Plasmid library: public reference plasmids with consistent canonical annotations.
-- Files live in the public 'plasmid-library' Supabase storage bucket.
-- Rows are publicly readable; only service role can insert/update.

CREATE TABLE public.plasmid_library (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text UNIQUE NOT NULL,              -- URL-safe: "puc19", "lenticrispr-v2"
  name         text NOT NULL,                      -- Display name: "pUC19"
  description  text NOT NULL DEFAULT '',
  source       text NOT NULL DEFAULT 'SnapGene public library',
  accession    text,                               -- NCBI accession if known
  topology     text NOT NULL CHECK (topology IN ('circular', 'linear')),
  length       integer NOT NULL,
  gc_content   numeric(5,2),
  file_path    text NOT NULL,                     -- Storage path in plasmid-library bucket
  categories   text[] NOT NULL DEFAULT '{}',      -- ["bacterial", "expression", "viral", ...]
  key_features text[] NOT NULL DEFAULT '{}',      -- ["AmpR", "T7 promoter", "ColE1 ori", ...]
  is_featured  boolean NOT NULL DEFAULT false,
  search_vector tsvector,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Trigger to maintain search_vector on insert/update
CREATE OR REPLACE FUNCTION plasmid_library_search_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(array_to_string(NEW.categories, ' '), '') || ' ' ||
    coalesce(array_to_string(NEW.key_features, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plasmid_library_search_trigger
  BEFORE INSERT OR UPDATE ON public.plasmid_library
  FOR EACH ROW EXECUTE FUNCTION plasmid_library_search_update();

-- FTS index for search-as-you-type
CREATE INDEX plasmid_library_search_idx ON public.plasmid_library USING GIN (search_vector);

-- Feature filter index (sidebar filters like "has AmpR")
CREATE INDEX plasmid_library_features_idx ON public.plasmid_library USING GIN (key_features);

-- Category filter index
CREATE INDEX plasmid_library_categories_idx ON public.plasmid_library USING GIN (categories);

-- Public read, no auth required
ALTER TABLE public.plasmid_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plasmid_library_public_read"
  ON public.plasmid_library
  FOR SELECT
  USING (true);

-- Only service role can write (seeding scripts)
CREATE POLICY "plasmid_library_service_insert"
  ON public.plasmid_library
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "plasmid_library_service_update"
  ON public.plasmid_library
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
