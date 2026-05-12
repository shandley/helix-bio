#!/usr/bin/env python3
"""
Collect sequences for each canonical feature from the HTCF feature corpus.

For each of the 200 canonical features in canonical_features.json:
  1. Build a search set from the canonical name + all aliases (case-insensitive)
  2. Scan metadata.tsv for features whose name matches the search set
  3. Extract matched sequences from all_features.fna using samtools faidx
  4. Fetch up to 3 reference sequences from NCBI using the accessions in the registry
  5. Write one FASTA per canonical feature to raw_sequences/{feature_id}.fna

The BLAST validation step (03_validate_blast.sh) then filters these to
confirmed sequences only.

Usage (on HTCF):
  python3 02_collect_sequences.py

Requires:
  samtools (in PATH)
  all_features.fna + all_features.fna.fai (samtools faidx index)
  metadata.tsv  (id, accession, start, end, strand, name, type, source, length)
  canonical_features.json (output of 01_generate_metadata.py)
"""

import json
import re
import subprocess
import sys
import time
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────

DB = Path("/scratch/sahlab/shandley/helix-feature-db")
FEATURES_FNA = DB / "features" / "all_features.fna"
FEATURES_FAI = DB / "features" / "all_features.fna.fai"
METADATA_TSV = DB / "features" / "metadata.tsv"
REGISTRY_JSON = DB / "feature_registry" / "canonical_features.json"
OUT_DIR = DB / "feature_registry" / "raw_sequences"
NCBI_EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Load registry ─────────────────────────────────────────────────────────────

print("Loading canonical feature registry...")
registry: list[dict] = json.loads(REGISTRY_JSON.read_text())
print(f"  {len(registry)} canonical features")

# Build normalised alias lookup per feature
def norm(s: str) -> str:
    """Normalize a feature name for comparison."""
    return re.sub(r"[^a-z0-9]", "", s.lower())

feature_aliases: dict[str, set[str]] = {}
for feat in registry:
    fid = feat.get("_source_name", feat.get("canonical_name", ""))
    names = [feat.get("canonical_name", ""), feat.get("_source_name", "")] + feat.get("aliases", [])
    feature_aliases[fid] = {norm(n) for n in names if n}

# ── Load metadata index ────────────────────────────────────────────────────────

print("Loading metadata index...")
# Build: normalised_name → list of feature_ids in the corpus
name_to_ids: dict[str, list[str]] = {}
with open(METADATA_TSV) as fh:
    fh.readline()  # header
    for line in fh:
        parts = line.rstrip("\n").split("\t")
        if len(parts) < 7:
            continue
        feat_id, accession, start, end, strand, feat_name, feat_type = parts[:7]
        key = norm(feat_name)
        if key:
            name_to_ids.setdefault(key, []).append(feat_id)

print(f"  {len(name_to_ids)} unique normalised names in corpus")

# ── NCBI fetch helper ─────────────────────────────────────────────────────────

def fetch_ncbi_sequence(accession: str, feature_name: str) -> str | None:
    """Fetch a GenBank record from NCBI and extract sequence as FASTA."""
    import urllib.request
    url = f"{NCBI_EFETCH}?db=nuccore&id={accession}&rettype=fasta&retmode=text"
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            text = resp.read().decode("utf-8")
        if text.startswith(">"):
            # Re-header to include feature name and accession
            lines = text.strip().split("\n")
            new_header = f">ncbi_{accession}|{feature_name.replace(' ', '_')}|ncbi_reference|0"
            return new_header + "\n" + "\n".join(lines[1:]) + "\n"
    except Exception as e:
        print(f"    NCBI fetch failed for {accession}: {e}")
    return None

# ── Samtools faidx extraction ─────────────────────────────────────────────────

def extract_sequences(feat_ids: list[str], label: str) -> str:
    """Extract sequences from all_features.fna by ID list. Returns FASTA string."""
    if not feat_ids:
        return ""
    # samtools faidx handles large ID lists via -r (region file) or direct args
    # Use xargs-style batching to avoid ARG_MAX limits
    batch_size = 500
    results = []
    for i in range(0, len(feat_ids), batch_size):
        batch = feat_ids[i:i + batch_size]
        try:
            result = subprocess.run(
                ["samtools", "faidx", str(FEATURES_FNA)] + batch,
                capture_output=True, text=True, timeout=120,
            )
            if result.returncode == 0 and result.stdout:
                results.append(result.stdout)
        except Exception as e:
            print(f"    samtools error for {label}: {e}")
    return "".join(results)

# ── Main collection loop ───────────────────────────────────────────────────────

print("\nCollecting sequences per canonical feature...\n")

stats = {"matched": 0, "ncbi_only": 0, "empty": 0}

for i, feat in enumerate(registry):
    fid = feat.get("_source_name", feat.get("canonical_name", f"feat_{i}"))
    canonical_name = feat.get("canonical_name", fid)
    safe_id = re.sub(r"[^a-zA-Z0-9_-]", "_", fid)
    out_path = OUT_DIR / f"{safe_id}.fna"

    # Skip if already collected
    if out_path.exists() and out_path.stat().st_size > 0:
        print(f"[{i+1:3d}] SKIP  {canonical_name}")
        continue

    print(f"[{i+1:3d}] COLL  {canonical_name}")

    # Find all corpus feature IDs that match any alias
    aliases = feature_aliases.get(fid, set())
    matched_ids: list[str] = []
    for alias_norm in aliases:
        matched_ids.extend(name_to_ids.get(alias_norm, []))

    # Deduplicate
    matched_ids = list(dict.fromkeys(matched_ids))

    fasta_content = ""

    # Extract from corpus
    if matched_ids:
        corpus_fasta = extract_sequences(matched_ids, canonical_name)
        if corpus_fasta:
            fasta_content += corpus_fasta
            print(f"       Corpus: {matched_ids[:3]}{'...' if len(matched_ids)>3 else ''} ({len(matched_ids)} total)")

    # Fetch NCBI reference sequences
    accessions = feat.get("reference_accessions", [])
    ncbi_fetched = 0
    for acc in accessions[:3]:  # max 3 NCBI fetches per feature
        seq = fetch_ncbi_sequence(acc, canonical_name)
        if seq:
            fasta_content += seq
            ncbi_fetched += 1
        time.sleep(0.4)  # respect NCBI rate limit

    if ncbi_fetched:
        print(f"       NCBI:   {ncbi_fetched} reference sequence(s)")

    # Write output
    if fasta_content:
        out_path.write_text(fasta_content)
        seq_count = fasta_content.count(">")
        print(f"       Wrote {seq_count} sequences → {out_path.name}")
        if matched_ids:
            stats["matched"] += 1
        else:
            stats["ncbi_only"] += 1
    else:
        print(f"       WARNING: no sequences found for {canonical_name}")
        # Write empty marker so we don't retry
        out_path.write_text("")
        stats["empty"] += 1

print(f"""
{'='*60}
Collection complete:
  Features with corpus matches:  {stats['matched']}
  Features with NCBI only:       {stats['ncbi_only']}
  Features with no sequences:    {stats['empty']}

Output: {OUT_DIR}
Next:   03_validate_blast.sh
""")
