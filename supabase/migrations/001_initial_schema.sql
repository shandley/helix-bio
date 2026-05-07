-- Sequences table: core entity for all DNA/RNA/protein sequences
CREATE TABLE sequences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  topology TEXT CHECK (topology IN ('circular', 'linear')) NOT NULL DEFAULT 'circular',
  length INTEGER,
  gc_content NUMERIC(5,2),
  file_path TEXT,
  file_format TEXT CHECK (file_format IN ('genbank', 'fasta', 'dna', 'embl')) NOT NULL DEFAULT 'genbank',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sequences"
  ON sequences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sequences"
  ON sequences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sequences"
  ON sequences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sequences"
  ON sequences FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sequences_updated_at
  BEFORE UPDATE ON sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket for raw sequence files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sequences',
  'sequences',
  false,
  52428800, -- 50MB
  ARRAY['text/plain', 'application/octet-stream', 'chemical/seq-na-genbank', 'text/x-fasta']
);

CREATE POLICY "Users can upload sequences"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'sequences' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read own sequences"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sequences' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own sequences"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'sequences' AND auth.uid()::text = (storage.foldername(name))[1]);
