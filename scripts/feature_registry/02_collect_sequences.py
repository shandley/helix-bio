#!/usr/bin/env python3
"""
Collect sequences for each canonical feature from the HTCF feature corpus
and NCBI GenBank.

For each of the 200 canonical features in canonical_features.json:

  Corpus sequences (SnapGene + iGEM):
    - Scan metadata.tsv for features whose name matches any alias
    - Extract sequences via samtools faidx
    - Length-filter: discard sequences outside [0.3x, 3x] expected length
      (catches mislabeled annotations that span large genomic regions)

  NCBI reference sequences:
    - Fetch as GenBank format (not raw FASTA) so feature coordinates are available
    - Parse the GenBank record with BioPython
    - Find the feature matching our canonical name/aliases in the annotation table
    - Extract ONLY that feature's coordinates from the sequence
    - Fallback: if no matching annotation found, use full record only if within
      [0.5x, 3x] expected length

This coordinate-extraction approach prevents the contamination problem where
fetching J01749 (pBR322, 4361 bp) as a reference for "AmpR" (861 bp) would
return the entire plasmid backbone and corrupt the HMM profile.

Usage (on HTCF):
  python3 02_collect_sequences.py
"""

import json
import re
import subprocess
import sys
import time
import urllib.request
from io import StringIO
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────

DB            = Path("/scratch/sahlab/shandley/helix-feature-db")
FEATURES_FNA  = DB / "features" / "all_features.fna"
METADATA_TSV  = DB / "features" / "metadata.tsv"
REGISTRY_JSON = DB / "feature_registry" / "canonical_features.json"
OUT_DIR       = DB / "feature_registry" / "raw_sequences"

OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Load BioPython (required for GenBank coordinate extraction) ────────────────

try:
    from Bio import SeqIO as _SeqIO
    HAS_BIOPYTHON = True
except ImportError:
    HAS_BIOPYTHON = False
    print("WARNING: BioPython not available — NCBI coordinate extraction disabled")
    print("  Install: conda install -c conda-forge biopython")

# ── Load registry ─────────────────────────────────────────────────────────────

print("Loading canonical feature registry...")
registry: list[dict] = json.loads(REGISTRY_JSON.read_text())
print(f"  {len(registry)} canonical features")

def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())

# Build normalised alias lookup per feature
feature_aliases: dict[str, set[str]] = {}
for feat in registry:
    fid = feat.get("_source_name", feat.get("canonical_name", ""))
    names = ([feat.get("canonical_name", ""), feat.get("_source_name", "")]
             + feat.get("aliases", []))
    feature_aliases[fid] = {norm(n) for n in names if n}

# ── Load metadata index ────────────────────────────────────────────────────────

print("Loading metadata index...")
name_to_ids: dict[str, list[str]] = {}
with open(METADATA_TSV) as fh:
    fh.readline()
    for line in fh:
        parts = line.rstrip("\n").split("\t")
        if len(parts) < 7:
            continue
        feat_id, _acc, _start, _end, _strand, feat_name, _type = parts[:7]
        key = norm(feat_name)
        if key:
            name_to_ids.setdefault(key, []).append(feat_id)

print(f"  {len(name_to_ids)} unique normalised names in corpus")

# ── NCBI GenBank extraction ────────────────────────────────────────────────────

NCBI_EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

def fetch_ncbi_genbank(
    accession: str,
    feat: dict,
) -> list[tuple[str, str]]:
    """
    Fetch a GenBank record from NCBI and extract the feature sequence.

    Strategy:
      1. Fetch as GenBank format (includes annotation coordinates)
      2. Search feature table for any annotation matching our canonical name/aliases
      3. Extract ONLY that feature's coordinates from the sequence
      4. Fallback: if no matching annotation, use full record only if within
         expected length range (catches records that ARE just the feature)

    Returns: list of (fasta_header, sequence) tuples
    """
    canonical_name = feat.get("canonical_name", "")
    expected_len   = feat.get("expected_length_bp", [20, 10000])
    alias_norms    = feature_aliases.get(
        feat.get("_source_name", canonical_name), set()
    )

    # Fetch GenBank record
    url = (f"{NCBI_EFETCH}?db=nuccore&id={accession}"
           f"&rettype=gb&retmode=text")
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            gbk_text = resp.read().decode("utf-8")
    except Exception as e:
        print(f"    NCBI fetch failed for {accession}: {e}")
        return []

    if not gbk_text.strip().startswith("LOCUS"):
        print(f"    {accession}: unexpected response (not GenBank)")
        return []

    # ── BioPython coordinate extraction ──────────────────────────────────────
    if HAS_BIOPYTHON:
        try:
            record = _SeqIO.read(StringIO(gbk_text), "genbank")
        except Exception as e:
            print(f"    {accession}: parse error: {e}")
            return []

        results: list[tuple[str, str]] = []
        QUALIFIER_KEYS = ["label", "gene", "product", "note", "standard_name"]

        for feature in record.features:
            if feature.type in ("source", "gene"):
                continue

            # Check if any qualifier matches our aliases
            matched = False
            for qkey in QUALIFIER_KEYS:
                for qval in feature.qualifiers.get(qkey, []):
                    if norm(qval) in alias_norms:
                        matched = True
                        break
                if matched:
                    break

            if not matched:
                continue

            try:
                feat_seq = str(feature.extract(record.seq))
                feat_len = len(feat_seq)
            except Exception:
                continue

            # Length sanity check — feature must be plausibly sized
            lo = expected_len[0] * 0.3
            hi = expected_len[1] * 3.0
            if not (lo <= feat_len <= hi):
                continue

            loc = feature.location
            safe_name = canonical_name.replace(" ", "_").replace("/", "-")
            header = (f"ncbi_{accession}_{feature.type}"
                      f"_{int(loc.start)}_{int(loc.end)}"
                      f"|{safe_name}|{feature.type}|{feat_len}")
            results.append((header, feat_seq.upper()))

        if results:
            return results

        # Fallback: no matching annotation — use full record if right length
        full_len = len(record.seq)
        lo_full  = expected_len[0] * 0.5
        hi_full  = expected_len[1] * 3.0
        if lo_full <= full_len <= hi_full:
            safe_name = canonical_name.replace(" ", "_").replace("/", "-")
            header = (f"ncbi_{accession}_full"
                      f"|{safe_name}|ncbi_reference|{full_len}")
            return [(header, str(record.seq).upper())]

        print(f"    {accession}: no matching feature; full record {full_len} bp "
              f"outside expected range [{int(lo_full)}, {int(hi_full)}] — skipping")
        return []

    # ── Fallback: parse FASTA from GenBank without BioPython ─────────────────
    # Extract just the sequence and apply length filter
    seq_lines: list[str] = []
    in_origin = False
    for line in gbk_text.splitlines():
        if line.startswith("ORIGIN"):
            in_origin = True
            continue
        if line.startswith("//"):
            break
        if in_origin:
            seq_lines.append(re.sub(r"[^acgtACGT]", "", line))
    seq = "".join(seq_lines).upper()
    if not seq:
        return []
    full_len = len(seq)
    lo = expected_len[0] * 0.5
    hi = expected_len[1] * 3.0
    if lo <= full_len <= hi:
        safe_name = canonical_name.replace(" ", "_").replace("/", "-")
        header = f"ncbi_{accession}_full|{safe_name}|ncbi_reference|{full_len}"
        return [(header, seq)]
    print(f"    {accession}: {full_len} bp outside length range — skipping")
    return []

# ── Corpus sequence extraction ────────────────────────────────────────────────

def extract_corpus_sequences(
    feat_ids: list[str],
    expected_len: list[int],
) -> list[tuple[str, str]]:
    """
    Extract sequences from all_features.fna by ID list.
    Applies length filter: discard sequences outside [0.3x, 3x] expected length.
    """
    if not feat_ids:
        return []

    lo = expected_len[0] * 0.3
    hi = expected_len[1] * 3.0

    results: list[tuple[str, str]] = []
    batch_size = 500

    for i in range(0, len(feat_ids), batch_size):
        batch = feat_ids[i:i + batch_size]
        try:
            r = subprocess.run(
                ["samtools", "faidx", str(FEATURES_FNA)] + batch,
                capture_output=True, text=True, timeout=120,
            )
            if r.returncode != 0 or not r.stdout:
                continue

            # Parse FASTA output and apply length filter
            hdr: str | None = None
            seq_parts: list[str] = []

            def flush(h: str | None, parts: list[str]) -> None:
                if h is None:
                    return
                seq = "".join(parts)
                seq_len = len(seq)
                if lo <= seq_len <= hi:
                    results.append((h, seq))

            for line in r.stdout.splitlines():
                if line.startswith(">"):
                    flush(hdr, seq_parts)
                    hdr = line[1:].strip()
                    seq_parts = []
                else:
                    seq_parts.append(line.strip().upper())
            flush(hdr, seq_parts)

        except Exception as e:
            print(f"    samtools error: {e}")

    return results

# ── Main collection loop ───────────────────────────────────────────────────────

print("\nCollecting sequences per canonical feature...\n")
stats = {"matched": 0, "ncbi_only": 0, "empty": 0}

for i, feat in enumerate(registry):
    fid          = feat.get("_source_name", feat.get("canonical_name", f"feat_{i}"))
    canon_name   = feat.get("canonical_name", fid)
    expected_len = feat.get("expected_length_bp", [20, 10000])
    safe_id      = re.sub(r"[^a-zA-Z0-9_-]", "_", fid)
    out_path     = OUT_DIR / f"{safe_id}.fna"

    # Skip if already collected
    if out_path.exists() and out_path.stat().st_size > 0:
        print(f"[{i+1:3d}] SKIP  {canon_name}")
        continue

    print(f"[{i+1:3d}] COLL  {canon_name}")

    fasta_records: list[tuple[str, str]] = []

    # ── Corpus sequences ────────────────────────────────────────────────────
    aliases       = feature_aliases.get(fid, set())
    matched_ids: list[str] = []
    for alias_norm in aliases:
        matched_ids.extend(name_to_ids.get(alias_norm, []))
    matched_ids = list(dict.fromkeys(matched_ids))  # deduplicate

    if matched_ids:
        corpus_recs = extract_corpus_sequences(matched_ids, expected_len)
        fasta_records.extend(corpus_recs)
        kept = len(corpus_recs)
        discarded = len(matched_ids) - kept
        print(f"       Corpus: {kept} kept, {discarded} length-filtered "
              f"(from {len(matched_ids)} candidates)")

    # ── NCBI reference sequences ────────────────────────────────────────────
    accessions   = feat.get("reference_accessions", [])
    ncbi_fetched = 0
    for acc in accessions[:3]:
        recs = fetch_ncbi_genbank(acc, feat)
        if recs:
            fasta_records.extend(recs)
            ncbi_fetched += len(recs)
            for _, seq in recs:
                print(f"       NCBI {acc}: extracted {len(seq)} bp")
        time.sleep(0.4)  # respect NCBI rate limit

    # ── Write output ────────────────────────────────────────────────────────
    if fasta_records:
        with open(out_path, "w") as fh:
            for hdr, seq in fasta_records:
                fh.write(f">{hdr}\n")
                for j in range(0, len(seq), 80):
                    fh.write(seq[j:j+80] + "\n")

        n_seqs = len(fasta_records)
        print(f"       Wrote {n_seqs} sequences → {out_path.name}")
        if matched_ids:
            stats["matched"] += 1
        else:
            stats["ncbi_only"] += 1
    else:
        print(f"       WARNING: no sequences found for {canon_name}")
        out_path.write_text("")
        stats["empty"] += 1

print(f"""
{'='*60}
Collection complete:
  Features with corpus matches:  {stats['matched']}
  Features with NCBI only:       {stats['ncbi_only']}
  Features with no sequences:    {stats['empty']}

Output: {OUT_DIR}
Next:   03_validate.py → 04_cluster.py → 05_build_hmms.py
""")
