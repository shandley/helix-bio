#!/usr/bin/env python3
"""
Cluster validated sequences per canonical feature at 95% identity.
Uses MMseqs2 via subprocess. Much more robust than bash for 192 features.

For each feature in validated_sequences/:
  - <=3 sequences: copy as-is (too few to cluster)
  - >3 sequences: MMseqs2 cluster --min-seq-id 0.95, extract representatives

All representatives merged into all_representatives.fna for HMM building.

Usage: python3 04_cluster.py
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────

DB = Path("/scratch/sahlab/shandley/helix-feature-db/feature_registry")
VALID_DIR = DB / "validated_sequences"
VARIANTS_DIR = DB / "variants"
MERGED = DB / "all_representatives.fna"
TMP_DIR = DB / "tmp_cluster"

VARIANTS_DIR.mkdir(parents=True, exist_ok=True)
TMP_DIR.mkdir(parents=True, exist_ok=True)

# ── Helpers ───────────────────────────────────────────────────────────────────

def count_seqs(fna: Path) -> int:
    return sum(1 for line in fna.read_text().splitlines() if line.startswith(">"))

def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, check=check)

def cluster_feature(input_fna: Path, output_fna: Path, tmp: Path) -> int:
    """Run MMseqs2 cluster, return number of representatives."""
    tmp.mkdir(parents=True, exist_ok=True)

    mmdb = tmp / "db"
    cldb = tmp / "cluster"
    repdb = tmp / "rep"
    tmpwork = tmp / "tmp"
    tmpwork.mkdir(exist_ok=True)

    run(["mmseqs", "createdb", str(input_fna), str(mmdb), "-v", "0"])
    run(["mmseqs", "cluster", str(mmdb), str(cldb), str(tmpwork),
         "--min-seq-id", "0.95", "--cov-mode", "0", "-c", "0.80",
         "--threads", "16", "-v", "0"])
    run(["mmseqs", "result2repseq", str(mmdb), str(cldb), str(repdb), "-v", "0"])
    run(["mmseqs", "convert2fasta", str(repdb), str(output_fna)])

    return count_seqs(output_fna)

# ── Main ───────────────────────────────────────────────────────────────────────

input_files = sorted(VALID_DIR.glob("*.fna"))
print(f"Processing {len(input_files)} feature files\n")

stats = {"total_in": 0, "total_out": 0, "clustered": 0, "copied": 0, "empty": 0}

for i, input_fna in enumerate(input_files):
    basename = input_fna.stem
    output_fna = VARIANTS_DIR / input_fna.name
    tmp = TMP_DIR / basename

    n_in = count_seqs(input_fna)
    stats["total_in"] += n_in

    if n_in == 0:
        output_fna.write_text("")
        stats["empty"] += 1
        print(f"[{i+1:3d}] SKIP  {basename} (empty)")
        continue

    if output_fna.exists() and count_seqs(output_fna) > 0:
        n_out = count_seqs(output_fna)
        stats["total_out"] += n_out
        print(f"[{i+1:3d}] DONE  {basename} ({n_in} → {n_out} reps, already clustered)")
        continue

    if n_in <= 3:
        shutil.copy2(input_fna, output_fna)
        stats["total_out"] += n_in
        stats["copied"] += 1
        print(f"[{i+1:3d}] COPY  {basename} ({n_in} seqs)")
        continue

    try:
        n_out = cluster_feature(input_fna, output_fna, tmp)
        stats["total_out"] += n_out
        stats["clustered"] += 1
        ratio = n_in / n_out if n_out > 0 else float("inf")
        print(f"[{i+1:3d}] CLUST {basename}: {n_in} → {n_out} reps ({ratio:.1f}x reduction)")
    except subprocess.CalledProcessError as e:
        print(f"[{i+1:3d}] ERROR {basename}: {e.stderr[:100]}")
        # Fall back to copying
        shutil.copy2(input_fna, output_fna)
        stats["total_out"] += n_in

# ── Merge all representatives ─────────────────────────────────────────────────

print("\n=== Merging all representatives ===")
with open(MERGED, "w") as out:
    for variant_fna in sorted(VARIANTS_DIR.glob("*.fna")):
        content = variant_fna.read_text().strip()
        if content:
            out.write(content + "\n")

total_merged = count_seqs(MERGED)
print(f"Total representatives: {total_merged}")
print(f"Input sequences:  {stats['total_in']}")
print(f"Output (reps):    {stats['total_out']}")
print(f"  Clustered:      {stats['clustered']} features")
print(f"  Copied:         {stats['copied']} features")
print(f"  Empty:          {stats['empty']} features")
if stats["total_out"] > 0:
    print(f"Reduction ratio:  {stats['total_in']/stats['total_out']:.1f}x")
print(f"\nMerged FASTA: {MERGED}")
print("Next: run_05_build_hmms.sh")
