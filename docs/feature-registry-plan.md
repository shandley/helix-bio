# Ori Feature Registry — Build Plan

## Vision

Build the first open, consistently annotated molecular biology feature database —
a structured registry of canonical genetic elements used in plasmid engineering.
This replaces ad-hoc k-mer matching against inconsistently named sequences with
a principled, versioned, schema-anchored reference corpus.

**Strategic moat**: SnapGene's feature library is proprietary and closed. NCBI
GenBank is exhaustive but inconsistently annotated. No open, programmatic,
community-extensible feature registry exists. Ori builds and publishes it.

---

## Architecture

### Two-tier annotation

```
TIER 1 — Browser (instant, < 1 second)
  k-mer matching against features.json
  Returns: canonical name, position, identity estimate
  Sensitivity: high  |  Specificity: moderate

TIER 2 — Server async (15–30 s after upload)
  a. BLAST vs. curated reference sequences  → E-value, % identity, allele ID
  b. Profile HMM scoring (existing HTCF DB) → detects sub-50% identity homologs
  c. pgvector embedding nearest-neighbor    → catches novel/diverged variants
  Returns: confidence score, variant ID, novelty flag
  Sensitivity: high  |  Specificity: high
```

Tier 1 renders immediately in SeqViz. Tier 2 updates annotations asynchronously
after upload, adding confidence metadata and catching variants k-mer matching misses.

### Layered validation for database build

```
Claude CLI metadata generation   → names, aliases, SO terms, accessions
         ↓
NCBI efetch + HTCF corpus        → raw sequences per canonical feature
         ↓
BLAST filter (E < 1e-20)         → validated sequences (real, correct function)
         ↓
MMseqs2 95% identity clustering  → representative variants per feature
         ↓
MAFFT + hmmbuild                 → HMM profile per canonical feature
         ↓
DNABERT-2 / Nucleotide Transformer embeddings (GPU) → 768-dim vectors
         ↓
Export:
  features.json          (k-mer targets for browser)
  feature_registry.json  (full metadata for Supabase)
  embeddings.float32     (for pgvector)
  feature_hmms.pressed   (for Tier 2 HMM annotation)
```

---

## Feature Registry Schema

### CanonicalFeature record

```json
{
  "id": "ORI:F0042",
  "canonical_name": "AmpR",
  "display_name": "AmpR (β-lactamase)",
  "aliases": ["bla", "ampicillin resistance", "beta-lactamase", "TEM-1 beta-lactamase"],
  "so_term": "SO:0001950",
  "so_label": "antibiotic_resistance_gene",
  "category": "resistance_marker",
  "description": "Encodes TEM-1 β-lactamase, hydrolyzing the β-lactam ring of ampicillin and related penicillins. Confers resistance in E. coli at ~100 μg/mL ampicillin. One of the most common selection markers in molecular cloning.",
  "mechanism": "Serine β-lactamase; cleaves the β-lactam ring by acyl-enzyme mechanism. Secreted to periplasm via N-terminal signal peptide.",
  "expression_systems": ["e_coli", "gram_negative"],
  "expected_length_bp": [858, 870],
  "expected_gc_range": [0.52, 0.58],
  "reference_accessions": ["V00613", "J01749", "L09137"],
  "reference_plasmids": ["pUC19", "pBR322", "pGEX-4T-1"],
  "known_variants": [
    "TEM-1 (original, Tn3)",
    "TEM-2 (Q39K substitution)",
    "codon-optimized for human expression"
  ],
  "known_misannotations": [
    "Sometimes labeled 'bla' without allele specification",
    "TEM-1 and TEM-2 both called 'AmpR' — differ at position 39"
  ],
  "sequences": [
    {
      "id": "ORI:F0042:S001",
      "seq": "ATGAGTATTCAACATTTCCGT...",
      "source_plasmid": "pUC19",
      "codon_opt": null,
      "identity_to_ref": 1.0,
      "verified_blast": true,
      "blast_evalue": "0.0",
      "blast_identity": 1.0
    }
  ]
}
```

### Feature categories (controlled vocabulary)

| Category | Examples |
|---|---|
| resistance_marker | AmpR, KanR, CmR, HygR, PuroR, BleoR |
| origin_of_replication | ColE1, p15A, pSC101, f1, 2μ, SV40 ori |
| promoter_bacterial | T7, tac, lac, araBAD, rrnB, EM7 |
| promoter_mammalian | CMV, EF-1α, PGK, CAG, SV40 |
| terminator | T7 term, rrnB T1/T2, bGH polyA, SV40 polyA |
| reporter | EGFP, mCherry, luc+, Rluc, β-gal, NanoLuc |
| epitope_tag | 6xHis, FLAG, HA, Myc, V5, Strep-II |
| recombination_site | loxP, FRT, attB/P/L/R |
| crispr_element | SpCas9, SaCas9, sgRNA scaffold, U6 promoter |
| regulatory | lac operator, IRES, WPRE, Kozak, T2A/P2A |
| viral_element | LTR, ITR, psi packaging, CMV enhancer |
| selection_marker | NeoR, hygromycin R (mammalian context) |
| purification_tag | GST, MBP, SUMO, PreScission site |

---

## Data Sources

### Quality hierarchy

```
SnapGene library     ████████████  Curated, consistent, rich labels     2,550 plasmids
NCBI RefSeq          ███████████   Reviewed, stable, ontology-linked     public
Addgene deposits     ████████      Journal-linked, PI-verified           ~200,000 deposits
iGEM Registry        ████          High volume, inconsistent quality     ~110,000 parts
```

### Coverage tiers

**Tier 1 — Core canonical registry (~500 features)**
- Source: SnapGene library + NCBI RefSeq
- Validation: BLAST + HMM + LLM metadata curation
- Quality bar: every entry manually verified
- Status: buildable now from existing HTCF corpus

**Tier 2 — Extended library (~5,000–15,000 features)**
- Source: iGEM filtered (sequences + annotations) + Addgene deposits
- Validation: BLAST against Tier 1; novel sequences → LLM candidate metadata → BLAST
- Quality bar: machine-curated with confidence scores
- iGEM: filter to parts with sequences + functional annotation → ~8,000 usable records
- Addgene: requires credentials (`01_fetch_addgene.py` exists)

**Tier 3 — Community contributions**
- Source: Ori user submissions
- Validation: BLAST + embedding similarity + community review
- Quality bar: candidate status until verified

---

## Script Pipeline

All scripts in: `/scratch/sahlab/shandley/helix-feature-db/scripts/feature_registry/`
Metadata generation script runs locally (requires Claude Code CLI).

### 01_generate_metadata.py (runs locally on Mac)

**Purpose**: Use Claude Code CLI in headless mode to generate structured metadata
for each canonical feature. Leverages Max plan — no API billing.

**Input**: `CANONICAL_FEATURES` list embedded in script (~500 feature names)
**Output**: `feature_registry/canonical_features.json`

**Approach**:
- Call `claude -p "prompt"` via subprocess for each feature
- Parse JSON from Claude's response
- Resume-safe: skip already-processed features
- Rate-limiting: 2-second delay between calls
- Validates JSON schema before writing

**Key prompt asks Claude for**:
- Canonical name + all known aliases
- Sequence Ontology term + label
- Category, mechanism, description
- Expected length and GC range
- 3 verified NCBI accessions
- Known variants + misannotations

### 02_collect_sequences.py (HTCF)

**Purpose**: For each canonical feature in `canonical_features.json`, collect all
matching sequences from the HTCF corpus (SnapGene + iGEM).

**Input**: `canonical_features.json`, HTCF corpus (`features/all_features.fna` + `metadata.tsv`)
**Output**: `feature_registry/raw_sequences/{feature_id}.fna` (one file per canonical feature)

**Logic**:
1. For each canonical feature, build a set of all aliases (from metadata JSON)
2. Search `metadata.tsv` for any feature whose name matches an alias (case-insensitive)
3. Also search for features within expected length range ± 30%
4. Extract matched sequences from `all_features.fna` using samtools faidx
5. Add NCBI reference sequences fetched from accession numbers in metadata

### 03_validate_blast.sh (HTCF, SLURM)

**Purpose**: BLAST each collected sequence against NCBI nr to confirm it encodes
the claimed function. Removes misannotations and off-target sequences.

**Input**: `feature_registry/raw_sequences/`
**Output**: `feature_registry/validated_sequences/` (only passing sequences)

**Filter thresholds**:
- E-value < 1e-20
- Query coverage > 60%
- Pident > 70%
- Top hit description must match the canonical feature function
  (checked via keyword matching against the feature's `description` field)

**SLURM**: Array job, one task per canonical feature, BLAST against nr with 16 CPUs

### 04_cluster_variants.sh (HTCF)

**Purpose**: Cluster validated sequences at 95% identity to find representative
variants. Each cluster = one "variant" of the canonical feature.

**Input**: `feature_registry/validated_sequences/`
**Output**: `feature_registry/variants/` (representative sequences per feature)

**Tool**: MMseqs2 `cluster` at `--min-seq-id 0.95 -c 0.80`
**Also**: Track cluster sizes — large clusters (> 50 members) are high-confidence

### 05_build_hmm_profiles.sh (HTCF)

**Purpose**: Build a profile HMM for each canonical feature from its aligned variants.
These HMM profiles power Tier 2 annotation.

**Input**: `feature_registry/variants/`
**Output**: `feature_registry/hmms/` (one .hmm per canonical feature)
           `feature_registry/canonical_features.hmm` (pressed database)

**Pipeline per feature**: MAFFT alignment → hmmbuild → hmmpress
**Note**: Existing 26,832 HMM profiles from Phase 1 remain as the extended library.
The canonical 500 get new, higher-quality profiles from curated sequences.

### 06_compute_embeddings.py (HTCF, GPU node)

**Purpose**: Compute DNA language model embeddings for all canonical feature sequences.
Embeddings enable semantic similarity search via Supabase pgvector.

**Input**: `feature_registry/variants/` (representative sequences)
**Output**: `feature_registry/embeddings.npz` (feature_id → 768-dim float32 vector)

**Model**: DNABERT-2 (117M params) or Nucleotide Transformer 500M
**Hardware**: GPU partition (A100 or V100)
**Runtime**: ~2 hours for 5,000 sequences at 512 bp average

**Note**: For long features (> 512 bp), split into overlapping windows and
mean-pool the window embeddings.

### 07_evaluate.py (HTCF)

**Purpose**: Measure precision and recall on a ground-truth plasmid set.
Used as regression test for any database update.

**Input**: `ground_truth/` (50 well-annotated plasmids with known features)
**Output**: `feature_registry/evaluation_report.json`

**Ground truth set** (to be curated):
- pUC19, pBR322, pACYC184, pGEX-4T-1, pEGFP-N1 (current demo set)
- pET-28a, pGL3-Basic (newly seeded)
- 10 Addgene CRISPR vectors with known annotations
- 10 lentiviral vectors
- 10 mammalian expression vectors
- 10 synthetic biology constructs

**Metrics per feature type**:
- Precision: detected features that are real
- Recall: real features that were detected
- Position accuracy: median coordinate error (bp)
- Variant identification accuracy

**Pass threshold**: Precision > 0.95, Recall > 0.80 for all Tier 1 features

### 08_export.py (HTCF)

**Purpose**: Export all artifacts in formats consumed by Ori and the public API.

**Outputs**:
- `features.json` — browser k-mer targets (replaces current version)
  Format: `[{name, type, seq}]` with canonical names
- `feature_registry.json` — full metadata for Supabase loading
- `embeddings.float32` — raw binary for pgvector bulk insert
- `canonical_features.hmm` — pressed HMM database for Tier 2 annotation
- `CHANGELOG.md` — what changed vs. previous version (semver: `1.0.0`)

---

## Embedding Integration (Supabase pgvector)

### Schema

```sql
CREATE TABLE feature_embeddings (
    id TEXT PRIMARY KEY,              -- "ORI:F0042:S001"
    feature_id TEXT,                  -- "ORI:F0042"
    canonical_name TEXT,
    category TEXT,
    embedding vector(768),            -- DNABERT-2 embedding
    seq_len INTEGER,
    source TEXT
);

CREATE INDEX ON feature_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
```

### Annotation query

```sql
SELECT feature_id, canonical_name, category,
       1 - (embedding <=> $query_embedding) AS similarity
FROM feature_embeddings
ORDER BY embedding <=> $query_embedding
LIMIT 5;
```

### When embeddings are used

1. K-mer matching returns no hit for a sequence window (truly novel)
2. K-mer hit identity is 82–88% (ambiguous — confirm with embedding)
3. User requests "find similar features" search

---

## Build Order (Sprints)

### Sprint 1 — Foundation (3 weeks)

1. Write and run `01_generate_metadata.py` locally
   - Target: 500 canonical features with full metadata JSON
2. Build alias normalization table from metadata JSON
   - Integrate into current `features.json` export
   - Immediate win: eliminates luc/luc+/luciferase and similar naming fragmentation
3. Run `02_collect_sequences.py` on HTCF
   - Collect sequences for all 500 canonical features from existing corpus
4. Run `03_validate_blast.sh` on HTCF
   - Filter to verified sequences

**Deliverable**: New `features.json` with 2,000–3,000 sequences and canonical names.
Browser annotation quality improves immediately.

### Sprint 2 — High-specificity annotation (4 weeks)

1. `04_cluster_variants.sh` — cluster to representative variants
2. `05_build_hmm_profiles.sh` — HMM per canonical feature
3. Design Tier 2 annotation API endpoint (Vercel Edge + HTCF via SSH/job submission)
4. `07_evaluate.py` — baseline precision/recall on ground-truth set
5. Curate ground-truth plasmid set (annotate 50 plasmids manually)

**Deliverable**: Tier 2 annotation running on uploads. Confidence scores in UI.

### Sprint 3 — Embeddings (4 weeks)

1. `06_compute_embeddings.py` — run DNABERT-2 on HTCF GPU
2. Load embeddings into Supabase pgvector
3. Build embedding query endpoint
4. Wire into Tier 2 annotation pipeline
5. "Novel variant" flag in UI for embedding-only hits

**Deliverable**: Semantic annotation — catches novel variants and diverged sequences.

### Sprint 4 — Scope expansion (6 weeks)

1. iGEM filtered dataset → add ~5,000 novel synthetic biology features
2. Addgene data collection (credentials needed)
3. CRISPR, lentiviral, AAV-specific canonical features
4. Community submission pipeline in Ori UI
5. `08_export.py` — versioned release pipeline

### Sprint 5 — Platform (ongoing)

1. Public REST API (`api.ori-bio.app/features/AmpR`)
2. Feature contribution submission form
3. Automated nightly validation
4. Paper: "An open feature registry for plasmid annotation"
   Target: Nature Methods or ACS Synthetic Biology

---

## Success Metrics

| Metric | Current | Sprint 1 target | Sprint 3 target |
|---|---|---|---|
| Canonical features | 1,472 sequences, ~815 names | 500 canonical + 2,000 seqs | 500 canonical + 5,000 seqs |
| Name consistency | Fragmented (luc/luc+/luciferase) | Alias-resolved | Fully canonical |
| Browser precision (pUC19) | ~85% | ~90% | ~95% |
| Novel variant detection | None | None | Via embeddings |
| Tier 2 annotation | None | HMM scoring | HMM + embedding |
| Sequences per feature | 1 | 2–5 verified variants | 5–20 variants |
| Ground-truth recall | Not measured | Baseline established | > 80% |

---

## Files and Locations

```
Local (Mac):
  scripts/feature_registry/01_generate_metadata.py
  data/canonical_features.json           ← output of 01_
  data/feature_registry.json             ← output of 08_
  public/data/features.json              ← browser k-mer targets (auto-built)

HTCF:
  /scratch/sahlab/shandley/helix-feature-db/
    scripts/feature_registry/
      02_collect_sequences.py
      03_validate_blast.sh
      04_cluster_variants.sh
      05_build_hmm_profiles.sh
      06_compute_embeddings.py
      07_evaluate.py
      08_export.py
    feature_registry/
      canonical_features.json            ← synced from Mac after 01_
      raw_sequences/
      validated_sequences/
      variants/
      hmms/
      embeddings.npz
      ground_truth/
      evaluation_report.json

Supabase:
  Table: feature_registry               ← canonical feature metadata
  Table: feature_sequences              ← sequences per feature
  Table: feature_embeddings             ← pgvector embeddings
```

---

## Open Questions

1. **Model for embeddings**: DNABERT-2 (faster) vs. Nucleotide Transformer 500M
   (better quality)? Run both on 100 test sequences and compare retrieval quality.

2. **Tier 2 API hosting**: HTCF job submission via SSH from Vercel is fragile.
   Better: small dedicated API server on a cloud VM, or Supabase Edge Function
   calling a pre-indexed HMM search?

3. **Addgene credentials**: Approach Addgene directly? They have an academic
   partnership program. Their deposits are the key source of cutting-edge vectors.

4. **Paper scope**: Feature registry alone, or combined with the annotation
   algorithm? ACS Synthetic Biology prefers tools papers with benchmarks.
