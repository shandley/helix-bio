# Ori

**Open-source molecular biology workbench for the web**

Ori is a browser-based alternative to SnapGene — a plasmid editor and analysis tool with AI-assisted primer design, restriction enzyme mapping, cloning simulation, and a natural language co-pilot.

**Live:** [ori-bio.vercel.app](https://ori-bio.vercel.app)

---

## What you can do

### Sequence analysis
- Upload GenBank, FASTA, SnapGene (.dna), or EMBL files
- Circular and linear plasmid maps with annotation colors and labels
- Restriction enzyme cut-site mapping (single and double digests)
- ORF detection across all 6 reading frames with protein translation
- Sequence search with ambiguous base support (IUPAC codes)

### Primer design
Powered by [primd](https://github.com/shandley/primd) — a thermodynamically-accurate TypeScript library using SantaLucia 1998 nearest-neighbor parameters and Owczarzy 2008 Mg²⁺ salt correction.

- Click any annotation on the map → primers auto-designed for that feature
- Ranked primer pairs with amplicon size, ΔTm, and 3′ dimer ΔG
- Per-primer template accessibility score (Boltzmann model — see if your primer lands in a hairpin)
- Parameter controls: Tm target, primer length range, GC% range
- Primer positions visualized on the sequence map and on a template accessibility heat map

### Cloning simulation
- Restriction enzyme cloning (digest + ligate preview)
- Gibson Assembly
- Gateway recombination

### AI co-pilot
Natural language Q&A about the loaded construct, powered by Claude. Ask about features, mechanisms, and experimental design.

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
ANTHROPIC_API_KEY=your_key          # optional — only needed for Ask Ori panel
```

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Tech

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16, TypeScript strict, Turbopack |
| Auth + storage | Supabase (SSR) |
| Sequence viewer | [SeqViz](https://github.com/Lattice-Automation/seqviz) |
| Primer design | [primd](https://github.com/shandley/primd) |
| AI | Claude API via Vercel AI SDK |
| UI | shadcn/ui (@base-ui/react) |
| Deployment | Vercel |

---

## Roadmap

The primary strategic advantage over existing tools is automatic sequence annotation using profile HMMs trained on Addgene, iGEM, and NCBI plasmid databases — catching codon-optimized and mutant variants that BLAST-based tools miss. This pipeline is under development.

---

## License

MIT
