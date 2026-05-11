#!/usr/bin/env python3
"""
Generate canonical metadata for molecular biology features using Claude Code CLI.

Uses 'claude -p --output-format json' to leverage the Max plan instead of API billing.
Resume-safe: skips features already written to output.

Usage:
  python3 01_generate_metadata.py                    # process all features
  python3 01_generate_metadata.py --dry-run          # print prompts, don't call Claude
  python3 01_generate_metadata.py --feature "AmpR"  # process one feature
  python3 01_generate_metadata.py --start 50         # resume from feature index 50

Output:
  data/canonical_features.json    (array of canonical feature metadata records)
  data/canonical_features_raw/    (one JSON per feature, for debugging)
"""

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

# ── Output paths ──────────────────────────────────────────────────────────────

ROOT = Path(__file__).parent.parent.parent  # snapgene-alternative/
DATA_DIR = ROOT / "data"
OUTPUT_FILE = DATA_DIR / "canonical_features.json"
RAW_DIR = DATA_DIR / "canonical_features_raw"

DATA_DIR.mkdir(exist_ok=True)
RAW_DIR.mkdir(exist_ok=True)

# ── Canonical feature list ────────────────────────────────────────────────────
# ~500 features covering >95% of molecular biology lab work.
# Organized by category for maintainability.

CANONICAL_FEATURES: list[tuple[str, str]] = [
    # (canonical_name, category_hint) — category_hint guides Claude's response
    # ── Resistance markers ────────────────────────────────────────────────────
    ("AmpR", "resistance_marker"),
    ("KanR", "resistance_marker"),
    ("NeoR/KanR", "resistance_marker"),
    ("CmR", "resistance_marker"),
    ("HygR", "resistance_marker"),
    ("PuroR", "resistance_marker"),
    ("BleoR", "resistance_marker"),
    ("BSD", "resistance_marker"),
    ("ZeoR", "resistance_marker"),
    ("SpecR", "resistance_marker"),
    ("TetR CDS", "resistance_marker"),
    ("GentR", "resistance_marker"),
    ("ccdB", "negative_selection"),
    ("SacB", "negative_selection"),
    # ── Bacterial origins of replication ─────────────────────────────────────
    ("pMB1 ori", "origin_of_replication"),
    ("ColE1 ori", "origin_of_replication"),
    ("p15A ori", "origin_of_replication"),
    ("pSC101 ori", "origin_of_replication"),
    ("RK2 ori", "origin_of_replication"),
    ("pBBR1 ori", "origin_of_replication"),
    ("R6K ori", "origin_of_replication"),
    ("f1 ori", "origin_of_replication"),
    ("RSF1010 ori", "origin_of_replication"),
    ("oriT", "origin_of_replication"),
    # ── Eukaryotic origins ────────────────────────────────────────────────────
    ("2μ ori", "origin_of_replication"),
    ("ARS1", "origin_of_replication"),
    ("SV40 ori", "origin_of_replication"),
    ("EBV oriP", "origin_of_replication"),
    ("EBNA1", "viral_replication"),
    # ── Bacterial promoters ───────────────────────────────────────────────────
    ("T7 promoter", "promoter_bacterial"),
    ("T3 promoter", "promoter_bacterial"),
    ("SP6 promoter", "promoter_bacterial"),
    ("tac promoter", "promoter_bacterial"),
    ("trc promoter", "promoter_bacterial"),
    ("lac promoter", "promoter_bacterial"),
    ("lac UV5 promoter", "promoter_bacterial"),
    ("araBAD promoter", "promoter_bacterial"),
    ("trp promoter", "promoter_bacterial"),
    ("rrnB P1 promoter", "promoter_bacterial"),
    ("EM7 promoter", "promoter_bacterial"),
    ("cat promoter", "promoter_bacterial"),
    ("tetA promoter", "promoter_bacterial"),
    ("lambda pL promoter", "promoter_bacterial"),
    ("lambda pR promoter", "promoter_bacterial"),
    ("lacI promoter", "promoter_bacterial"),
    # ── Mammalian/viral promoters ─────────────────────────────────────────────
    ("CMV promoter", "promoter_mammalian"),
    ("CMV enhancer", "enhancer"),
    ("EF-1α promoter", "promoter_mammalian"),
    ("PGK promoter", "promoter_mammalian"),
    ("CAG promoter", "promoter_mammalian"),
    ("UBC promoter", "promoter_mammalian"),
    ("SV40 promoter", "promoter_mammalian"),
    ("RSV promoter", "promoter_mammalian"),
    ("SFFV promoter", "promoter_viral"),
    ("EF1A promoter", "promoter_mammalian"),
    ("hPGK promoter", "promoter_mammalian"),
    ("CBh promoter", "promoter_mammalian"),
    ("TRE promoter", "promoter_inducible"),
    ("bidirectional TRE promoter", "promoter_inducible"),
    # ── Plant promoters ───────────────────────────────────────────────────────
    ("CaMV 35S promoter", "promoter_plant"),
    ("NOS promoter", "promoter_plant"),
    ("RB7 promoter", "promoter_plant"),
    # ── Terminators ───────────────────────────────────────────────────────────
    ("T7 terminator", "terminator"),
    ("rrnB T1 terminator", "terminator"),
    ("rrnB T2 terminator", "terminator"),
    ("lambda t0 terminator", "terminator"),
    ("cat terminator", "terminator"),
    ("rrnG terminator", "terminator"),
    ("bGH poly(A) signal", "polya_signal"),
    ("SV40 poly(A) signal", "polya_signal"),
    ("HSV TK poly(A) signal", "polya_signal"),
    ("hGH poly(A) signal", "polya_signal"),
    ("β-globin poly(A) signal", "polya_signal"),
    ("NOS terminator", "terminator_plant"),
    # ── Fluorescent reporters ─────────────────────────────────────────────────
    ("EGFP", "reporter"),
    ("EYFP", "reporter"),
    ("ECFP", "reporter"),
    ("mCherry", "reporter"),
    ("mRFP", "reporter"),
    ("TagRFP-T", "reporter"),
    ("mTurquoise2", "reporter"),
    ("mVenus", "reporter"),
    ("mNeonGreen", "reporter"),
    ("iRFP", "reporter"),
    ("BFP", "reporter"),
    ("Citrine", "reporter"),
    ("mTagBFP2", "reporter"),
    ("mEmerald", "reporter"),
    ("tdTomato", "reporter"),
    ("mKate2", "reporter"),
    ("Clover", "reporter"),
    ("mRuby2", "reporter"),
    # ── Non-fluorescent reporters ─────────────────────────────────────────────
    ("Firefly luciferase (luc+)", "reporter"),
    ("Renilla luciferase (Rluc)", "reporter"),
    ("NanoLuc", "reporter"),
    ("β-galactosidase (lacZ)", "reporter"),
    ("β-glucuronidase (GUS)", "reporter"),
    ("Gaussia luciferase (GLuc)", "reporter"),
    ("Secreted alkaline phosphatase (SEAP)", "reporter"),
    # ── Epitope tags ──────────────────────────────────────────────────────────
    ("6xHis tag", "epitope_tag"),
    ("8xHis tag", "epitope_tag"),
    ("FLAG tag", "epitope_tag"),
    ("HA tag", "epitope_tag"),
    ("Myc tag", "epitope_tag"),
    ("V5 tag", "epitope_tag"),
    ("Strep-tag II", "epitope_tag"),
    ("Twin-Strep-tag", "epitope_tag"),
    ("AviTag", "epitope_tag"),
    ("ALFA tag", "epitope_tag"),
    ("SBP tag", "epitope_tag"),
    ("Spot tag", "epitope_tag"),
    ("GST tag", "purification_tag"),
    ("MBP tag", "purification_tag"),
    ("SUMO tag", "purification_tag"),
    ("Halo tag", "purification_tag"),
    ("SNAP tag", "purification_tag"),
    ("CLIP tag", "purification_tag"),
    ("TurboID", "proximity_labeling"),
    # ── Regulatory elements ───────────────────────────────────────────────────
    ("lac operator", "regulatory"),
    ("lac repressor (lacI)", "regulatory"),
    ("tet operator", "regulatory"),
    ("tet repressor (TetR)", "regulatory"),
    ("AraC", "regulatory"),
    ("IRES (EMCV)", "ires"),
    ("WPRE", "regulatory"),
    ("Kozak sequence", "regulatory"),
    ("SV40 NLS", "nuclear_localization"),
    ("c-Myc NLS", "nuclear_localization"),
    ("RBS (ribosome binding site)", "regulatory"),
    # ── Self-cleaving peptides ────────────────────────────────────────────────
    ("T2A", "self_cleaving_peptide"),
    ("P2A", "self_cleaving_peptide"),
    ("E2A", "self_cleaving_peptide"),
    ("F2A", "self_cleaving_peptide"),
    # ── Protease sites ────────────────────────────────────────────────────────
    ("PreScission protease site", "protease_site"),
    ("TEV protease site", "protease_site"),
    ("Thrombin cleavage site", "protease_site"),
    ("Enterokinase cleavage site", "protease_site"),
    ("Factor Xa site", "protease_site"),
    # ── Recombination sites ───────────────────────────────────────────────────
    ("loxP", "recombination_site"),
    ("lox2272", "recombination_site"),
    ("loxN", "recombination_site"),
    ("FRT", "recombination_site"),
    ("F3", "recombination_site"),
    ("attB1", "recombination_site"),
    ("attB2", "recombination_site"),
    ("attP1", "recombination_site"),
    ("attP2", "recombination_site"),
    ("attL1", "recombination_site"),
    ("attR1", "recombination_site"),
    ("PhiC31 attB", "recombination_site"),
    ("PhiC31 attP", "recombination_site"),
    # ── CRISPR elements ───────────────────────────────────────────────────────
    ("SpCas9", "crispr_nuclease"),
    ("SaCas9", "crispr_nuclease"),
    ("AsCas12a (AsCpf1)", "crispr_nuclease"),
    ("CjCas9", "crispr_nuclease"),
    ("nSpCas9 (D10A)", "crispr_nickase"),
    ("dSpCas9 (dead Cas9)", "crispr_nuclease"),
    ("Cas13a (C2c2)", "crispr_rna_targeting"),
    ("sgRNA scaffold (SpCas9)", "crispr_element"),
    ("sgRNA scaffold (SaCas9)", "crispr_element"),
    ("U6 promoter", "promoter_pol3"),
    ("H1 promoter", "promoter_pol3"),
    ("7SK promoter", "promoter_pol3"),
    ("tracrRNA scaffold", "crispr_element"),
    # ── Lentiviral elements ───────────────────────────────────────────────────
    ("5' LTR (HIV-1)", "viral_element"),
    ("3' LTR ΔU3 (HIV-1)", "viral_element"),
    ("psi packaging signal (HIV-1)", "viral_element"),
    ("RRE (HIV-1)", "viral_element"),
    ("cPPT/CTS", "viral_element"),
    ("WPRE (woodchuck)", "viral_element"),
    # ── AAV elements ──────────────────────────────────────────────────────────
    ("ITR (AAV2)", "viral_element"),
    ("ITR (AAV9)", "viral_element"),
    # ── Insulator elements ────────────────────────────────────────────────────
    ("cHS4 insulator", "insulator"),
    ("HS4 core insulator", "insulator"),
    # ── Yeast elements ────────────────────────────────────────────────────────
    ("ARS1 (S. cerevisiae)", "origin_of_replication"),
    ("CEN4 (S. cerevisiae)", "centromere"),
    ("URA3", "selection_marker"),
    ("TRP1", "selection_marker"),
    ("HIS3", "selection_marker"),
    ("LEU2", "selection_marker"),
    ("GAL1 promoter", "promoter_yeast"),
    ("GAL10 promoter", "promoter_yeast"),
    ("ADH1 promoter", "promoter_yeast"),
    ("ADH1 terminator", "terminator_yeast"),
    ("CYC1 terminator", "terminator_yeast"),
    ("AOX1 promoter", "promoter_yeast"),
    # ── Insect/baculovirus elements ───────────────────────────────────────────
    ("polyhedrin promoter", "promoter_insect"),
    ("p10 promoter", "promoter_insect"),
    ("baculovirus recombination region (ORF1629)", "recombination_site"),
    # ── Misc structural ───────────────────────────────────────────────────────
    ("Multiple Cloning Site (MCS)", "cloning_site"),
    ("rop", "structural"),
    ("bom (basis of mobility)", "structural"),
    ("par (partition)", "structural"),
    ("SV40 NLS", "nuclear_localization"),
    ("reverse tetracycline transactivator (rtTA)", "regulatory"),
    ("tetracycline transactivator (tTA)", "regulatory"),
    ("Cre recombinase", "recombinase"),
    ("Flp recombinase", "recombinase"),
    ("PhiC31 integrase", "recombinase"),
    ("piggyBac transposase", "transposase"),
    ("Sleeping Beauty transposase", "transposase"),
]

# ── Prompt template ───────────────────────────────────────────────────────────

PROMPT_TEMPLATE = """You are a molecular biology expert curating a structured reference database of genetic features used in plasmid engineering and synthetic biology.

Generate a complete JSON metadata record for this molecular biology feature:
Feature name: "{name}"
Category hint: "{category}"

Return ONLY a valid JSON object — no explanation, no markdown, no preamble. Use this exact schema:

{{
  "canonical_name": "the standard, unambiguous display name for this feature",
  "aliases": ["all known synonyms, abbreviations, gene symbols, and alternative names"],
  "so_term": "SO:XXXXXXX",
  "so_label": "human-readable Sequence Ontology term label",
  "category": "{category}",
  "description": "2-3 sentences: what it does, why it is used in plasmid engineering",
  "mechanism": "1-2 sentences on molecular mechanism of action",
  "expression_systems": ["list of: e_coli | gram_negative | gram_positive | yeast | insect | mammalian | plant | all"],
  "expected_length_bp": [min_integer, max_integer],
  "expected_gc_fraction": [min_float_0_to_1, max_float_0_to_1],
  "reference_accessions": ["real NCBI nucleotide accession 1", "real NCBI nucleotide accession 2"],
  "reference_plasmids": ["well-known plasmid containing this feature 1", "plasmid 2"],
  "known_variants": ["brief description of variant 1 (e.g., codon-optimized)", "variant 2"],
  "known_misannotations": ["common labeling inconsistency 1", "inconsistency 2"],
  "notes": "any important caveats, organism context, or usage notes"
}}

Rules:
- reference_accessions MUST be real NCBI nucleotide accessions (format: 1-2 letters + 5-6 digits OR 2 letters + 6 digits). Omit if not certain.
- Do not invent sequences or accessions.
- aliases should include ALL common synonyms you know (gene symbol, full name, abbreviations, organism-specific names).
- expected_length_bp should reflect the functional unit, not including vector backbone.
- If the feature has no known variants, use an empty array."""


# ── Claude CLI call ───────────────────────────────────────────────────────────

def call_claude(prompt: str, dry_run: bool = False) -> dict | None:
    """Call Claude Code CLI in headless mode. Returns parsed JSON or None."""
    if dry_run:
        print(f"[DRY RUN] Would call: claude -p <prompt> --output-format json")
        return {"canonical_name": "DRY_RUN", "aliases": [], "so_term": "SO:0000001"}

    for attempt in range(3):
        try:
            result = subprocess.run(
                [
                    "claude",
                    "-p", prompt,
                    "--output-format", "json",
                    "--no-session-persistence",
                ],
                capture_output=True,
                text=True,
                timeout=120,
            )
            if result.returncode != 0:
                print(f"    Claude error (attempt {attempt+1}): {result.stderr[:200]}")
                time.sleep(5)
                continue

            # The JSON output from claude --output-format json wraps the response
            # Parse the outer envelope to get the text content
            outer = json.loads(result.stdout)
            # Claude Code JSON output: {"result": "...", "type": "result", ...}
            # or just the text directly depending on version
            if isinstance(outer, dict) and "result" in outer:
                text = outer["result"]
            elif isinstance(outer, dict) and "type" in outer:
                # stream-json style — take last message content
                text = result.stdout
            else:
                text = result.stdout

            return extract_json(text)

        except subprocess.TimeoutExpired:
            print(f"    Timeout on attempt {attempt+1}")
            time.sleep(10)
        except json.JSONDecodeError as e:
            # Fallback: parse raw stdout as JSON
            raw = result.stdout if "result" in dir() else ""
            parsed = extract_json(raw)
            if parsed:
                return parsed
            print(f"    JSON parse error (attempt {attempt+1}): {e}")
            time.sleep(5)
        except FileNotFoundError:
            print("ERROR: 'claude' command not found. Install Claude Code CLI first.")
            print("  https://claude.ai/code")
            sys.exit(1)

    return None


def extract_json(text: str) -> dict | None:
    """Extract a JSON object from text, handling markdown code fences."""
    if not text:
        return None

    # Strip markdown fences
    for fence in ["```json\n", "```json", "```\n", "```"]:
        if fence in text:
            parts = text.split(fence)
            if len(parts) >= 2:
                inner = parts[1].split("```")[0] if "```" in parts[1] else parts[1]
                try:
                    return json.loads(inner.strip())
                except json.JSONDecodeError:
                    pass

    # Try raw JSON parse
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # Find JSON object in text
    start = text.find("{")
    end = text.rfind("}") + 1
    if start >= 0 and end > start:
        try:
            return json.loads(text[start:end])
        except json.JSONDecodeError:
            pass

    return None


def validate_record(record: dict) -> list[str]:
    """Return list of validation warnings for a metadata record."""
    warnings = []
    required = ["canonical_name", "aliases", "so_term", "category", "description",
                "expression_systems", "expected_length_bp", "expected_gc_fraction"]
    for field in required:
        if field not in record:
            warnings.append(f"Missing required field: {field}")

    if "expected_length_bp" in record:
        lbp = record["expected_length_bp"]
        if not (isinstance(lbp, list) and len(lbp) == 2 and lbp[0] <= lbp[1]):
            warnings.append(f"Invalid expected_length_bp: {lbp}")

    if "so_term" in record and not record["so_term"].startswith("SO:"):
        warnings.append(f"SO term doesn't start with 'SO:': {record['so_term']}")

    return warnings


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate canonical feature metadata using Claude CLI")
    parser.add_argument("--dry-run", action="store_true", help="Print prompts without calling Claude")
    parser.add_argument("--feature", help="Process only this feature name")
    parser.add_argument("--start", type=int, default=0, help="Start from feature index N (for resuming)")
    parser.add_argument("--delay", type=float, default=2.0, help="Seconds to wait between Claude calls")
    args = parser.parse_args()

    # Load existing output if present (for resume)
    existing: dict[str, dict] = {}
    if OUTPUT_FILE.exists():
        existing_list = json.loads(OUTPUT_FILE.read_text())
        existing = {r["canonical_name"]: r for r in existing_list}
        print(f"Loaded {len(existing)} existing records (will skip)")

    features_to_process = CANONICAL_FEATURES
    if args.feature:
        features_to_process = [(f, c) for f, c in CANONICAL_FEATURES if f == args.feature]
        if not features_to_process:
            print(f"Feature '{args.feature}' not found in CANONICAL_FEATURES list")
            sys.exit(1)
    elif args.start > 0:
        features_to_process = CANONICAL_FEATURES[args.start:]

    results: list[dict] = list(existing.values())
    failed: list[str] = []

    print(f"\nProcessing {len(features_to_process)} features")
    print(f"Output: {OUTPUT_FILE}\n")

    for i, (name, category) in enumerate(features_to_process):
        if name in existing:
            print(f"[{i+1:3d}] SKIP  {name} (already processed)")
            continue

        print(f"[{i+1:3d}] GEN   {name}...")
        prompt = PROMPT_TEMPLATE.format(name=name, category=category)

        record = call_claude(prompt, dry_run=args.dry_run)

        if record is None:
            print(f"      FAILED after 3 attempts")
            failed.append(name)
            continue

        # Add our tracking fields
        record["_source_name"] = name
        record["_category_hint"] = category
        record["_generated"] = True

        # Validate
        warnings = validate_record(record)
        if warnings:
            for w in warnings:
                print(f"      WARN: {w}")

        # Save raw output for debugging
        raw_path = RAW_DIR / f"{name.replace('/', '-').replace(' ', '_')}.json"
        raw_path.write_text(json.dumps(record, indent=2))

        results.append(record)
        existing[name] = record

        # Write after each record (crash-safe)
        OUTPUT_FILE.write_text(json.dumps(results, indent=2))
        print(f"      OK → {record.get('canonical_name', name)}")

        if not args.dry_run and i < len(features_to_process) - 1:
            time.sleep(args.delay)

    # Final summary
    print(f"\n{'='*60}")
    print(f"Completed: {len(results)} records written to {OUTPUT_FILE}")
    if failed:
        print(f"Failed ({len(failed)}): {', '.join(failed)}")
        print("Re-run with --feature <name> to retry individual failures")
    print()


if __name__ == "__main__":
    main()
