-- Feature registry: canonical molecular biology feature definitions.
-- Populated by the HTCF pipeline (scripts/feature_registry/07_export.py)
-- and the local loader (scripts/load-feature-registry.mjs).

CREATE TABLE IF NOT EXISTS public.feature_registry (
    id                  TEXT PRIMARY KEY,      -- canonical_name used as stable key
    canonical_name      TEXT NOT NULL,
    aliases             TEXT[] DEFAULT '{}',
    so_term             TEXT,
    so_label            TEXT,
    category            TEXT,
    description         TEXT,
    mechanism           TEXT,
    expression_systems  TEXT[] DEFAULT '{}',
    expected_length_min INTEGER,
    expected_length_max INTEGER,
    expected_gc_min     REAL,
    expected_gc_max     REAL,
    reference_accessions TEXT[] DEFAULT '{}',
    reference_plasmids  TEXT[] DEFAULT '{}',
    known_variants      TEXT[] DEFAULT '{}',
    known_misannotations TEXT[] DEFAULT '{}',
    notes               TEXT,
    seq_count           INTEGER DEFAULT 0,     -- number of representative sequences
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Index for alias search (used by annotation dedup normalization)
CREATE INDEX IF NOT EXISTS feature_registry_canonical_name_idx
    ON public.feature_registry (canonical_name);

CREATE INDEX IF NOT EXISTS feature_registry_category_idx
    ON public.feature_registry (category);

-- Public read access (feature registry is open data)
ALTER TABLE public.feature_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feature registry is publicly readable"
    ON public.feature_registry FOR SELECT
    USING (true);
