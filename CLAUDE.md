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

## Feature annotation database strategy
SnapGene's moat = proprietary BLAST feature library. We build better with profile HMMs:
1. Collect all Addgene (~200k) + iGEM Registry + NCBI RefSeq plasmid GenBank files
2. Extract annotated features → FASTA per type
3. MMseqs2 cluster at 80-90% identity
4. MAFFT MSA → HMMER3 profile per cluster
5. HMMscan any uploaded sequence → feature calls with confidence scores
6. LLM (Claude) for novel regions and construct-level interpretation

Data sources priority: Addgene (depositor-annotated, highest quality) > iGEM Registry > NCBI RefSeq
