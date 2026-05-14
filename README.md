# Ori

Open-source, browser-based molecular biology workbench.

**[ori-bio.vercel.app](https://ori-bio.vercel.app)**

Try the demo account: `demo@ori.bio` / `plasmids2025` — pre-loaded with pUC19, pBR322, pACYC184, pGEX-4T-1, and pEGFP-N1.

---

## What it does

Upload a plasmid file (GenBank, FASTA, SnapGene .dna, or EMBL) and the app gives you a circular or linear sequence map with all annotated features. From there:

**Restriction enzymes** — cut-site mapping for any combination of enzymes, shown on the map and in a sortable panel. Single-cutters highlighted.

**Gel digest simulation** — pick an enzyme set and generate a virtual gel with 1kb or 100bp ladder. Add a second lane to compare two digests side by side, or add a PCR lane if you have primer pairs designed. Export the gel as PNG.

**Primer design** — click any annotation to auto-design primers for that feature. Rankings include amplicon size, Tm, GC content, 3' dimer free energy, and a template accessibility score that estimates whether the primer landing site is buried in secondary structure. The underlying thermodynamics use SantaLucia 1998 nearest-neighbor parameters with Owczarzy 2008 Mg2+ correction.

**Sanger alignment** — drag in one or more `.ab1` or `.fasta` files and align them to the loaded sequence. Each read shows strand, position, identity, and any mismatches. Click TRACE to open the chromatogram viewer: fluorescence curves for all four channels, base calls colored by Phred quality score, and mismatch positions highlighted. Handles both forward and reverse-complement alignments correctly.

**Feature auto-detection** — when you load a sequence, the app scans it against a library of common molecular biology features (promoters, resistance genes, origins, tags, terminators) and highlights any it finds, even if they are not annotated in the original file.

**ORF detection** — all 6 reading frames, filterable by minimum length, with protein translation.

**Sequence search** — supports IUPAC ambiguity codes. Matches shown on the map.

**Cloning simulation** — restriction enzyme cloning, Gibson Assembly, and Gateway recombination previews.

**AI co-pilot** — natural language Q&A about the loaded construct. Ask what a feature does, how to clone it, or what primers to order.

**Sharing** — share a read-only link to any sequence with a single click.

---

## Running locally

You need a [Supabase](https://supabase.com) project and an [Anthropic API key](https://console.anthropic.com) for the AI panel.

```bash
git clone https://github.com/shandley/ori-bio
cd ori-bio
pnpm install
```

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
ANTHROPIC_API_KEY=your_key
```

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16, TypeScript strict, Turbopack |
| Auth + storage | Supabase |
| Sequence viewer | [SeqViz](https://github.com/Lattice-Automation/seqviz) |
| Primer design | [@shandley/primd](https://github.com/shandley/primd) |
| ABIF parsing | [@shandley/abif-ts](https://github.com/shandley/abif-ts) |
| Alignment | Smith-Waterman with affine gap penalties (Web Worker) |
| AI | Claude API via Vercel AI SDK |
| UI | shadcn/ui (@base-ui/react) |
| Deployment | Vercel |

---

## License

MIT
