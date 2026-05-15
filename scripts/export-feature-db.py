#!/usr/bin/env python3
"""
Export cluster representative sequences from the HTCF HMM pipeline
into the features.json format used by Ori's annotation worker.

Run on HTCF:
  python3 export-feature-db.py --out /scratch/sahlab/shandley/helix-feature-db/features_export.json

Then scp back:
  scp shandley@login.htcf.wustl.edu:/scratch/sahlab/.../features_export.json public/data/features.json
"""

import argparse
import json
import re
import sys
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────

BASE    = Path("/scratch/sahlab/shandley/helix-feature-db")
REP_FA  = BASE / "clusters/clusterDB_rep_seq.fasta"
CLU_TSV = BASE / "clusters/clusters_parsed.tsv"
OUT_DEF = BASE / "features_export.json"

# ── Filter thresholds ──────────────────────────────────────────────────────────

MIN_CLUSTER_SIZE = 2    # must appear in ≥2 source plasmids
MIN_SEQ_LEN      = 20   # bp
MAX_SEQ_LEN      = 50_000

# Recognised feature types (matches Ori's annotation colour scheme)
KEEP_TYPES = {
    "CDS", "promoter", "terminator", "rep_origin", "misc_feature",
    "regulatory", "LTR", "polyA_signal", "misc_RNA", "enhancer",
    "protein_bind", "primer_bind", "mobile_element", "ncRNA",
    "mat_peptide", "sig_peptide", "transit_peptide", "stem_loop",
    "RBS", "oriT", "3_UTR", "5_UTR",
}

# Generic / uninformative names to drop
BAD_NAME_PATTERNS = re.compile(
    r"^(unknown|unnamed|hypothetical|uncharacterized|misc|orf\d*|feature|sequence|region)$",
    re.IGNORECASE,
)

# ── Parse cluster sizes ────────────────────────────────────────────────────────

def load_cluster_sizes(tsv: Path) -> dict[str, int]:
    sizes: dict[str, int] = {}
    with open(tsv) as f:
        next(f)  # skip header
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) >= 2:
                sizes[parts[0]] = int(parts[1])
    return sizes

# ── Parse rep FASTA ────────────────────────────────────────────────────────────

def parse_rep_fasta(fa: Path):
    """Yield (seq_id, name, feature_type, source, sequence)."""
    seq_id = name = ftype = source = ""
    buf: list[str] = []

    def emit():
        if seq_id and buf:
            yield (seq_id, name, ftype, source, "".join(buf).upper())

    with open(fa) as f:
        for line in f:
            line = line.rstrip()
            if line.startswith(">"):
                yield from emit()
                buf = []
                # Header: ><seq_id> name=X type=Y source=Z
                header = line[1:]
                parts  = header.split(" ", 1)
                seq_id = parts[0]
                rest   = parts[1] if len(parts) > 1 else ""

                name   = re.search(r"name=([^\t]+?)(?:\s+type=|\s+source=|$)", rest)
                ftype  = re.search(r"type=(\S+)",   rest)
                src    = re.search(r"source=(\S+)", rest)
                name   = name.group(1).strip()  if name  else ""
                ftype  = ftype.group(1).strip() if ftype else "misc_feature"
                source = src.group(1).strip()   if src   else ""
            else:
                buf.append(line)

    yield from emit()

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(OUT_DEF))
    ap.add_argument("--min-size", type=int, default=MIN_CLUSTER_SIZE)
    ap.add_argument("--max-features", type=int, default=0,
                    help="Cap output (0 = no cap, sort by cluster size descending)")
    args = ap.parse_args()

    print("Loading cluster sizes…", file=sys.stderr)
    sizes = load_cluster_sizes(CLU_TSV)
    print(f"  {len(sizes):,} clusters loaded", file=sys.stderr)

    print("Parsing rep sequences…", file=sys.stderr)

    features: list[dict] = []
    skipped_size = skipped_type = skipped_name = skipped_len = 0

    for seq_id, name, ftype, source, seq in parse_rep_fasta(REP_FA):
        cluster_size = sizes.get(seq_id, 1)

        if cluster_size < args.min_size:
            skipped_size += 1
            continue
        if ftype not in KEEP_TYPES:
            skipped_type += 1
            continue
        if not name or BAD_NAME_PATTERNS.match(name):
            skipped_name += 1
            continue
        if not (MIN_SEQ_LEN <= len(seq) <= MAX_SEQ_LEN):
            skipped_len += 1
            continue

        features.append({
            "name":    name,
            "type":    ftype,
            "seq":     seq,
            "_size":   cluster_size,   # temp; stripped before output
        })

    print(f"  Accepted: {len(features):,}", file=sys.stderr)
    print(f"  Skipped — cluster too small: {skipped_size:,}", file=sys.stderr)
    print(f"  Skipped — unrecognised type: {skipped_type:,}", file=sys.stderr)
    print(f"  Skipped — generic name:      {skipped_name:,}", file=sys.stderr)
    print(f"  Skipped — seq length:        {skipped_len:,}", file=sys.stderr)

    # Sort by cluster size descending (most-common features first)
    features.sort(key=lambda f: -f["_size"])

    if args.max_features and len(features) > args.max_features:
        features = features[:args.max_features]
        print(f"  Capped to {args.max_features:,}", file=sys.stderr)

    # Strip internal field before writing
    output = [{"name": f["name"], "type": f["type"], "seq": f["seq"]}
              for f in features]

    out_path = Path(args.out)
    with open(out_path, "w") as f:
        json.dump(output, f, separators=(",", ":"))

    size_mb = out_path.stat().st_size / 1_048_576
    print(f"\nWrote {len(output):,} features → {out_path} ({size_mb:.1f} MB)",
          file=sys.stderr)

    # Type breakdown
    type_counts: dict[str, int] = {}
    for feat in output:
        type_counts[feat["type"]] = type_counts.get(feat["type"], 0) + 1
    print("\nBy type:", file=sys.stderr)
    for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"  {t}: {c:,}", file=sys.stderr)

if __name__ == "__main__":
    main()
