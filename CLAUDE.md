# Ori — SnapGene Alternative

Open-source, web-based, LLM-powered molecular biology platform.

## Project structure
- `app/` — Next.js 16 App Router (TypeScript strict), Turbopack bundler
- `components/` — React UI components (shadcn/ui using @base-ui/react, NOT Radix)
- `components/sequence/` — Sequence viewer, primer panel, accessibility heat map, enzyme/ORF/digest/search panels
- `lib/bio/` — GenBank parser, restriction enzymes, ORF finder, cloning simulations (Gibson, Gateway, RE)
- `app/actions/` — Next.js server actions (auth, sequences, seed)
- `supabase/migrations/` — Database schema

## primd — primer design library
Published on npm as **`@shandley/primd`** v0.3.2. Lives at `../primd` (sibling). Ori uses `^0.3.2` from npm.
- After changing primd source: build → bump version → `npm publish --access public` → update `package.json` version → `pnpm install`
- Exports: `designPCR`, `designLAMP`, `designQPCR`, `designAssembly` (Gibson + Golden Gate), thermodynamic utilities
- Web Worker: `components/sequence/primer-design.worker.ts` runs all design modes off the main thread

## abif-ts — ABIF parser
Published on npm as **`@shandley/abif-ts`** v0.1.0. Lives at `../abif-ts` (sibling). Same publish workflow as primd.
- Parses `.ab1` Sanger files: sequence, quality scores, peak positions, all 4 fluorescence trace channels, metadata

## Critical Next.js / shadcn gotchas
- **No `asChild` prop** — shadcn here uses `@base-ui/react`, not Radix UI. Never use `<Button asChild>`. Use `<Link className={buttonVariants({...})}>` instead.
- **`proxy.ts` not `middleware.ts`** — Next.js 16 renamed the file; export is `proxy` not `middleware`.
- **Supabase types**: Use `{ [_ in never]: never }` (NOT `Record<string, never>`) for Views/Functions/Enums or queries return `never`.
- **SeqViz**: Pass `seq` + `annotations` props directly — do NOT use `file` prop (crashes on NCBI GenBank). Topology is controlled via `viewer` prop ("linear"/"circular"/"both"), not a `topology` prop.
- **SeqViz `onSelection`**: When an annotation is clicked, the selection object has `type: "ANNOTATION"` and `name: "AmpR"` (etc). The `ref` field is stripped by SeqViz before reaching `onSelection` — use `name` not `ref`.
- **Turbopack + symlinks**: Do not set `turbopack.root` to expand the filesystem root — it breaks tailwind CSS resolution. Use `file:` protocol for local packages instead.

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

### Google OAuth
- Provider enabled in Supabase dashboard
- Client ID: `647892611155-m1sip2fi0vhded9aige08i9bj9vrhntn.apps.googleusercontent.com`
- Google Cloud project: `ori-bio` — currently in Testing mode (no 100-user cap with basic scopes)
- To publish: Google Cloud Console → Google Auth Platform → Audience → Publish App (instant)

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

**Architecture**: The HTCF pipeline is an OFFLINE CURATION TOOL, not a runtime service.
Users never send sequences to HTCF. All annotation runs client-side in a Web Worker.
The pipeline produces a static feature library that ships with the app.

**Do not suggest wiring hmmscan or any HPC tool into the user-facing Ori pipeline.**

### How it works
1. HTCF pipeline (offline, our work): collect plasmid GenBanks → extract features → cluster → build HMMs
2. Export step: cluster representative sequences → `data/features.json` (shipped with app)
3. Ori annotation worker: k-mer matching against `features.json`, runs in browser, no server needed

### HTCF pipeline status (as of 2026-05-14) — COMPLETE
All jobs finished successfully. No jobs currently running.

| Source | Files | Status |
|--------|-------|--------|
| SnapGene | 2,550 .gb | ✅ Complete |
| iGEM Registry | 15,673 with sequences | ✅ Complete (finished 2026-05-09) |
| RefSeq | 8 .gbff.gz | ❌ Unusable — WGS annotation-only, no actual bases |
| Addgene | catalog only | ❌ Needs login credentials |

| Step | Status | Output |
|------|--------|--------|
| Feature extraction | ✅ Done | 113,529 features, `all_features.fna` |
| MMseqs2 clustering | ✅ Done | 31,020 clusters, `clusterDB_rep_seq.fasta` (36 MB) |
| MAFFT + hmmbuild | ✅ Done | 26,832 HMM profiles |
| hmmpress | ✅ Done | 14 GB database at `/scratch/sahlab/shandley/helix-feature-db/db/helix_features.hmm` |

### Remaining work
- Export filtered cluster rep seqs from HTCF → update `data/features.json` in Ori
- Filter strategy: keep clusters with multiple members, recognizable feature types, size ≥ 2
- Target: ~500–2000 high-confidence features (compact enough to ship in browser)
- Addgene expansion: if credentials obtained, re-run pipeline to add ~200k more sequences
