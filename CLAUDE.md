# Ori — SnapGene Alternative

Open-source, web-based, LLM-powered molecular biology platform.

## Project structure
- `app/` — Next.js 15 App Router (TypeScript strict)
- `components/` — React UI components (shadcn/ui using @base-ui/react, NOT Radix)
- `lib/bio/` — GenBank parser, future feature-library annotation engine
- `app/actions/` — Next.js server actions (auth, sequences, seed)
- `supabase/migrations/` — Database schema

## Critical Next.js / shadcn gotchas
- **No `asChild` prop** — shadcn here uses `@base-ui/react`, not Radix UI. Never use `<Button asChild>`. Use `<Link className={buttonVariants({...})}>` instead.
- **`proxy.ts` not `middleware.ts`** — Next.js 16 renamed the file; export is `proxy` not `middleware`.
- **Supabase types**: Use `{ [_ in never]: never }` (NOT `Record<string, never>`) for Views/Functions/Enums or queries return `never`.
- **SeqViz**: Pass `seq` + `annotations` props directly — do NOT use `file` prop (crashes on NCBI GenBank). Topology is controlled via `viewer` prop ("linear"/"circular"/"both"), not a `topology` prop.

## Supabase CLI

Linked project: `mexubhrfyfeacpnygpig` (supabase-ori-bio)
URL: `https://mexubhrfyfeacpnygpig.supabase.co`
Docker is NOT running locally — all operations target the remote project.

### Key commands
```bash
# Query remote DB (use --linked flag)
supabase db query --linked "SELECT * FROM public.sequences LIMIT 5;"

# Query auth schema
supabase db query --linked "SELECT id, email FROM auth.users;"

# Push migrations to remote
supabase db push --linked

# Get API keys (anon + service_role)
supabase --workdir . projects api-keys

# List projects (● = linked)
supabase projects list
```

### Gotchas
- `supabase db query` defaults to local Docker — always pass `--linked` for remote
- `supabase secrets` and `supabase auth` subcommands do NOT exist in this CLI version
- No `--project-ref` flag on `db` commands — use `--linked` instead
- Storage uploads and auth user creation require the service role key (in Vercel env as `SUPABASE_SERVICE_ROLE_KEY`)

### Demo account
- **Email**: `demo@ori.bio` | **Password**: `plasmids2025`
- Pre-seeded with pUC19, pBR322, pACYC184, pGEX-4T-1, pEGFP-N1
- Re-seed: `SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-demo.ts`

## HPC (HTCF @ WashU)
Login: `ssh shandley@login.htcf.wustl.edu`
Scheduler: SLURM — default partition `general` (96 nodes × 24 CPU × 750GB RAM, unlimited time)
GPU partition: `gpu` (5 nodes, A100 + V100)

### Key paths
- User scratch: `/scratch/sahlab/shandley/` (2TB quota)
- Software/conda: `/ref/sahlab/software/scott_conda/miniconda/`
- Databases: `/ref/sahlab/data/` (has `nt`, `nr`, bakta, GTDB, etc.)
- Feature DB project: `/scratch/sahlab/shandley/helix-feature-db/`

### Conda activation in scripts
```bash
source /ref/sahlab/software/scott_conda/miniconda/etc/profile.d/conda.sh
conda activate confphylo   # has HMMER3 + MAFFT + MUSCLE + BLAST + Diamond
```

### Pre-installed bioinformatics tools
All in `confphylo` conda env (or separate envs):
- MMseqs2 12.113e3 — sequence clustering
- HMMER3 3.4 — `hmmbuild`, `hmmscan`, `hmmsearch`, `hmmpress`
- MAFFT 7.525 — multiple sequence alignment
- MUSCLE 3.8 — MSA alternative
- BLAST 2.17.0 — `blastn`, `blastp`
- Diamond 2.1.24 — fast protein search
- Container runtime: Podman 4.9.4 (NO Singularity)

### SLURM job script template
```bash
#!/bin/bash
#SBATCH --job-name=jobname
#SBATCH --output=/scratch/sahlab/shandley/helix-feature-db/logs/job_%j.out
#SBATCH --error=/scratch/sahlab/shandley/helix-feature-db/logs/job_%j.err
#SBATCH --time=24:00:00
#SBATCH --mem=64G
#SBATCH --cpus-per-task=16
#SBATCH --partition=general

set -eo pipefail
source /ref/sahlab/software/scott_conda/miniconda/etc/profile.d/conda.sh
conda activate confphylo
```

## Feature annotation database

**Goal**: Automatically annotate any uploaded plasmid by scanning it against a library of
profile HMMs built from every depositor-annotated feature in public databases. This is
Ori's core moat vs SnapGene's proprietary BLAST feature library.

**Why HMMs over BLAST**: Profile HMMs capture sequence variation across a gene family,
tolerate divergent homologs, and produce calibrated confidence scores. A single HMM for
"CMV promoter" covers all variants; BLAST requires exact matches to stored examples.

### Pipeline (scripts in `/scratch/sahlab/shandley/helix-feature-db/scripts/`)

```
01_fetch_addgene.py      → raw/addgene/*.gb         (requires Addgene credentials)
02_fetch_igem.py         → raw/igem/*.gb             (iGEM Registry REST API, public)
06_fetch_snapgene.py     → raw/snapgene/*.gb         (public SnapGene plasmid library)
run_refseq_download.sh   → raw/refseq/*.gbff.gz      (NCBI FTP, public)

03_extract_features.py   → features/all_features.fna + metadata.tsv
04_cluster.sh            → clusters/ (MMseqs2 at 80% identity)
05_build_hmms.sh         → hmm/ (MAFFT MSA → hmmbuild → hmmpress)

Annotation query: hmmscan --domtblout against compressed hmm/features.hmm
```

### Data source status (as of 2026-05-08)

| Source | Files | Records | Status | Notes |
|--------|-------|---------|--------|-------|
| SnapGene | 2,550 .gb | ~2,550 | ✅ Complete | Public library, high quality |
| NCBI RefSeq plasmids | 8 .gbff.gz | 123,661 | ❌ Unusable | WGS annotation-only records — sequence length stored but no actual bases. `str(rec.seq)` raises `UndefinedSequenceError` on every record. Wrong file type. See note below. |
| iGEM Registry | 11,395 .gb | ~11,000 | 🔄 Re-downloading | 110,879 total parts; job 39960873 running, ~11% done |
| Addgene | 0 | ~200,000 | ❌ Not started | Requires login credentials; script: 01_fetch_addgene.py |

### Downstream pipeline status

| Step | Status | Blocker |
|------|--------|---------|
| Feature extraction | ❌ Broken | RefSeq: script passed `all_plasmids.gbff` (12 GB merged file) — BioPython UndefinedSequenceError. Fix: process individual `.gbff.gz` files directly with gzip support |
| MMseqs2 clustering | ❌ Not started | Needs feature extraction |
| MAFFT + hmmbuild | ❌ Not started | Needs clusters |
| hmmpress (final DB) | ❌ Not started | Needs HMMs |

### Key decisions & constraints
- **RefSeq files**: Always process `raw/refseq/plasmid.*.genomic.gbff.gz` directly via gzip — never the merged `all_plasmids.gbff` (12 GB, causes BioPython to crash)
- **Addgene auth**: `01_fetch_addgene.py` needs `ADDGENE_SESSION_ID` env var (browser cookie) or `--email`/`--password`. Without auth it falls back to catalog metadata only (IDs, no sequences). Catalog saved to `raw/addgene/catalog.tsv`.
- **iGEM completeness**: iGEM API is slow (~2 min/100 parts), 110k parts total. Expect ~24h for full download. Many parts have no sequence (expected, ~10%).
- **Feature deduplication**: `03_extract_features.py` deduplicates by `{accession}_{start}_{end}_{strand}` ID. Safe to re-run.
- **Min feature length**: 20 bp. Max: 50,000 bp. Skips: source, gap, assembly_gap, primer_bind, variation.
- **Target scale**: ~5–10M features extracted → cluster to ~100k–500k representative sequences → ~100k–500k HMM profiles

### Next steps (in order)
1. ✅ Fix `03_extract_features.py` for `.gz` RefSeq files
2. Run feature extraction across SnapGene + RefSeq (iGEM after download finishes)
3. Get Addgene credentials and run `01_fetch_addgene.py`
4. Run `04_cluster.sh` (MMseqs2)
5. Run `05_build_hmms.sh` (MAFFT + hmmbuild + hmmpress)
6. Wire HMMscan into Ori upload pipeline
