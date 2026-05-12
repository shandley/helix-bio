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

## Current Status (2026-05-12)

### What is complete

| Step | Status | Output |
|---|---|---|
| 01 — LLM metadata generation | ✅ Done | 200 canonical features, 1,695 aliases, SO terms |
| 02 — Sequence collection | ✅ Done (v2) | 12,948 → cleaned sequences with GenBank coord extraction |
| 03 — Validation | ✅ Done | 192 validated feature files |
| 04 — Clustering | ✅ Done | 880 → ~700 representative sequences (14.7× reduction) |
| 05 — HMM build | ✅ Done | 150 canonical HMM profiles, pressed database |
| pUC19 validation scan | ✅ Done | 28 hits, major false positives eliminated |

### Key milestone: false positive elimination

The v1 HMM database (contaminated with full plasmid records) produced 51 hits on
pUC19 including Renilla luciferase (E=0), TetR (E=0), CmR (E=0) — severe false
positives caused by profiles trained on vector backbones.

Root cause identified and fixed: NCBI `efetch?rettype=fasta` returns full genomic
records (J01749 = 4361 bp pBR322) rather than feature coordinates. The HMM for
"AmpR" was learning pBR322 backbone as part of AmpR.

Fix (step 02 v2): fetch as GenBank format, parse feature annotation table with
BioPython, extract only the annotated feature coordinates. J01749 now contributes
857 bp of AmpR CDS rather than 4361 bp of backbone.

After fix: 28 hits on pUC19, false positives reduced from 15+ to 3-4 (residual
homology between related origins — not contamination artifacts).

### Remaining false positives (accepted / low priority)

| Hit | Score | Why | Action |
|---|---|---|---|
| pSC101_ori (E=0, 1210) | High | Profile spans long region with ColE1-like sequence | Score threshold or length filter |
| R6K_ori, p15A_ori | ~400-750 | Real sequence homology between origins | E-value threshold (1e-20) eliminates |
| pBBR1_ori, ARS1 | ~200-260 | Distant homology, short alignments | E-value threshold eliminates |

All residual hits are below E=1e-50 threshold that would be used in production
annotation — leaving only AmpR, lacZ, lac promoter, lac operator, rop, oriT, bom
as confirmed true positives. That's exactly the right set for pUC19.

---

## Architecture

### Two-tier annotation

```
TIER 1 — Browser (instant, < 1 second)
  k-mer matching against features.json
  Returns: canonical name, position, identity estimate
  Sensitivity: high  |  Specificity: moderate
  Status: ✅ deployed and working

TIER 2 — Server async (15–30 s after upload)
  a. BLAST vs. curated reference sequences  → E-value, % identity, allele ID
  b. Profile HMM scanning (canonical_features.hmm) → detects sub-50% homologs
  c. pgvector embedding nearest-neighbor    → catches novel/diverged variants
  Returns: high-confidence annotations with E-values
  Status: ⬜ HMM database ready; API integration pending
```

### Layered validation for database build

```
01 Claude CLI metadata generation   → names, aliases, SO terms, accessions
02 NCBI GenBank coord extraction    → feature sequences only (not full records)
   + SnapGene/iGEM corpus sequences → length-filtered [0.3×, 3×] expected
03 Length/name validation filter    → per-feature validation
04 MMseqs2 95% identity clustering  → representative variants per feature
05 MUSCLE alignment + hmmbuild      → HMM profile per canonical feature
   → canonical_features.hmm (pressed, ready for nhmmscan)
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
  "description": "...",
  "mechanism": "...",
  "expression_systems": ["e_coli", "gram_negative"],
  "expected_length_bp": [858, 870],
  "expected_gc_fraction": [0.52, 0.58],
  "reference_accessions": ["V00613", "J01749", "L09137"],
  "reference_plasmids": ["pUC19", "pBR322", "pGEX-4T-1"],
  "known_variants": [...],
  "known_misannotations": [...]
}
```

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

**Tier 1 — Core canonical registry (~200 features, COMPLETE)**
- Source: SnapGene library + NCBI GenBank (coordinate-extracted)
- Validation: length filter + name match + (future) BLAST verification
- 150 HMM profiles built and pressed

**Tier 2 — Extended library (future)**
- Source: iGEM filtered + Addgene deposits
- Pipeline: same as Tier 1
- Blocker: Addgene credentials needed

---

## Script Pipeline

All scripts in: `scripts/feature_registry/` (local) → synced to HTCF for runs.

| Script | Location | Status | Notes |
|---|---|---|---|
| `01_generate_metadata.py` | Local (Mac) | ✅ Done | Uses `claude -p` headless; Max plan |
| `02_collect_sequences.py` | HTCF | ✅ Done v2 | GenBank coord extraction via BioPython |
| `03_validate.py` + SLURM | HTCF | ✅ Done | Length/name filter; SLURM array |
| `04_cluster.py` + SLURM | HTCF | ✅ Done | MMseqs2 95% identity |
| `05_build_hmms.py` + SLURM | HTCF | ✅ Done | MUSCLE + hmmbuild; 150 profiles |
| `06_evaluate.py` | HTCF | ⬜ Pending | Ground truth precision/recall |
| `07_export.py` | HTCF/Local | ⬜ Pending | Build new features.json + registry |

### Key HTCF paths

```
/scratch/sahlab/shandley/helix-feature-db/
  feature_registry/
    canonical_features.json      ← 200-feature registry (from 01)
    raw_sequences/               ← 192 per-feature FASTAs (from 02)
    validated_sequences/         ← 192 length-filtered FASTAs (from 03)
    variants/                    ← 192 clustered representatives (from 04)
    alignments/                  ← MUSCLE alignments (from 05)
    hmms/                        ← 150 individual .hmm files (from 05)
    canonical_features.hmm       ← pressed database ready for nhmmscan
    canonical_features.hmm.h3*   ← binary index files
```

---

## Next Steps (in order)

### Immediate (next sprint)

**1. Export pipeline (script 07)**
- Build new `public/data/features.json` from the canonical registry
  - 150 features × representative sequences → replace current 1,472 SnapGene sequences
  - Add alias normalization: detection returns canonical name regardless of source naming
- Load `canonical_features.json` into Supabase `feature_registry` table
- Version-tag the release (semver: `1.0.0`)

**2. Wire Tier 2 HMM annotation**
- API endpoint: accepts sequence → runs nhmmscan → returns high-confidence hits
- Hosting options: Vercel Edge (too large at 20MB), small API server, or HTCF
- Apply E-value threshold (1e-20) to eliminate low-confidence hits
- Update annotation worker to show Tier 2 results with confidence badges

**3. Ground truth evaluation (script 06)**
- Curate 50-plasmid ground truth set (annotate manually)
- Measure precision/recall per feature type
- Report: current browser k-mer vs. Tier 2 HMM vs. combined

### Medium term

**4. Alias integration into browser annotation**
- Map auto-detected names → canonical names using the registry's alias table
- Eliminates "luc" vs "luc+" vs "luciferase" naming fragmentation in results

**5. iGEM + Addgene expansion (Tier 2)**
- iGEM: ~8,000 usable records after quality filter, adds synthetic biology elements
- Addgene: needs credentials (`01_fetch_addgene.py` exists)
- CRISPR, lentiviral, AAV-specific features not in current corpus

**6. BLAST validation of HMM profiles**
- Add script `03b_validate_blast.py` to BLAST each feature's sequences against
  the local SnapGene BLAST database (not full nt — avoids OOM)
- Removes any remaining contaminated sequences that passed the length filter

### Long term

**7. Embeddings (Tier 3)**
- Compute DNABERT-2 / Nucleotide Transformer embeddings on GPU nodes
- Load into Supabase pgvector
- Enable "find sequences functionally similar to this" semantic search

**8. Community contribution pipeline**
- Submission form in Ori UI
- BLAST + embedding validation before acceptance
- Public REST API (`api.ori-bio.app/features/AmpR`)

**9. Publication**
- "An open feature registry for plasmid annotation"
- Target: Nature Methods or ACS Synthetic Biology
- Data: 200 canonical features, 150 HMM profiles, precision/recall benchmarks

---

## Known Issues and Workarounds

| Issue | Severity | Fix |
|---|---|---|
| MUSCLE times out on very long sequences | Medium | SIGKILL process group; 60s timeout; skip on failure |
| pSC101_ori false positive on pUC19 | Low | Apply E-value threshold (1e-20) in production |
| 34% of features have no HMM (alignment failed) | Medium | Fix in next build: trim long sequences before alignment |
| NCBI reference sequences sometimes no matching annotation | Low | Length-filter fallback handles gracefully |
| iGEM/Addgene data not yet incorporated | Medium | Pipeline ready; needs credentials for Addgene |

---

## Success Metrics

| Metric | Current | Target |
|---|---|---|
| Canonical features | 200 with metadata | 200 validated + 200 extended |
| HMM profiles | 150 | 180+ (fix alignment failures) |
| False positives on pUC19 (E<1e-20) | ~0 | 0 |
| False positives on pUC19 (E<1e-3) | 3-4 (origins homology) | ≤2 |
| Browser annotation precision | ~85% | >90% (with alias normalization) |
| Ground truth recall | Not measured | >80% |
| Sequences per canonical feature | 2-50 | 5-50 verified |

---

## Running the Pipeline

```bash
# Step 01: generate metadata (run locally, uses Max plan)
python3 scripts/feature_registry/01_generate_metadata.py

# Sync to HTCF
scp scripts/feature_registry/*.py scripts/feature_registry/*.sh \
    shandley@login.htcf.wustl.edu:/scratch/sahlab/shandley/helix-feature-db/scripts/feature_registry/
scp data/canonical_features.json \
    shandley@login.htcf.wustl.edu:/scratch/sahlab/shandley/helix-feature-db/feature_registry/

# Steps 02-05: run as dependency chain on HTCF
ssh shandley@login.htcf.wustl.edu "
  JOB2=$(sbatch run_02_collect.sh | awk '{print $NF}')
  JOB3=$(sbatch --dependency=afterok:$JOB2 run_03_validate.sh | awk '{print $NF}')
  JOB4=$(sbatch --dependency=afterok:$JOB3 run_04_cluster.sh | awk '{print $NF}')
  JOB5=$(sbatch --dependency=afterok:$JOB4 run_05_build_hmms.sh | awk '{print $NF}')
  echo Jobs: $JOB2 $JOB3 $JOB4 $JOB5
"

# Test: scan pUC19 against canonical HMM database
# nhmmscan --cpu 8 --tblout hits.tbl canonical_features.hmm puc19.fasta
```
