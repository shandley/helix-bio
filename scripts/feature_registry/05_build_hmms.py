#!/usr/bin/env python3
"""
Build HMM profiles for canonical features from clustered representative sequences.

Skips MAFFT entirely — runs hmmbuild directly on (sub)sampled sequences.
For feature detection databases, unaligned HMMs with --fast are adequate
and take seconds per feature rather than minutes.

Resume-safe: skips features with non-empty .hmm files.

Usage: python3 05_build_hmms.py
"""

import random
import subprocess
import sys
from pathlib import Path

# ── Config ─────────────────────────────────────────────────────────────────────
DB        = Path("/scratch/sahlab/shandley/helix-feature-db/feature_registry")
VARIANTS  = DB / "variants"
HMMS      = DB / "hmms"
FINAL_HMM = DB / "canonical_features.hmm"
MAX_SEQS  = 50   # subsample threshold before hmmbuild

HMMS.mkdir(parents=True, exist_ok=True)

# ── FASTA helpers ──────────────────────────────────────────────────────────────

def read_fasta(path: Path) -> list[tuple[str, str]]:
    records, hdr, parts = [], None, []
    for line in path.read_text().splitlines():
        if line.startswith(">"):
            if hdr is not None:
                records.append((hdr, "".join(parts)))
            hdr, parts = line[1:].strip(), []
        else:
            parts.append(line.strip())
    if hdr is not None:
        records.append((hdr, "".join(parts)))
    return records

def write_fasta(records: list[tuple[str, str]], path: Path) -> None:
    with open(path, "w") as fh:
        for hdr, seq in records:
            fh.write(f">{hdr}\n")
            for i in range(0, len(seq), 80):
                fh.write(seq[i:i+80] + "\n")

# ── HMM build ──────────────────────────────────────────────────────────────────

def build_hmm(input_path: Path, hmm_out: Path, cpus: int = 4) -> tuple[bool, str]:
    r = subprocess.run(
        ["hmmbuild", "--cpu", str(cpus), "--dna", "--fast",
         str(hmm_out), str(input_path)],
        capture_output=True, text=True, timeout=60,
    )
    if r.returncode == 0 and hmm_out.exists() and hmm_out.stat().st_size > 0:
        return True, ""
    return False, r.stderr[:120]

# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    random.seed(42)
    files = sorted(VARIANTS.glob("*.fna"))
    print(f"Building HMMs for {len(files)} canonical features (no alignment, --fast)")
    print(f"Max seqs per feature: {MAX_SEQS}\n", flush=True)

    built = failed = skipped = 0

    for i, fna in enumerate(files):
        hmm = HMMS / (fna.stem + ".hmm")

        # Skip if already built (non-empty)
        if hmm.exists() and hmm.stat().st_size > 0:
            skipped += 1
            continue

        if fna.stat().st_size == 0:
            skipped += 1
            print(f"[{i+1:3d}] SKIP  {fna.stem} (empty)", flush=True)
            continue

        # Read and optionally subsample
        records = read_fasta(fna)
        n = len(records)
        note = f"{n} seqs"

        if n == 0:
            skipped += 1
            continue

        if n > MAX_SEQS:
            records = random.sample(records, MAX_SEQS)
            note = f"subsampled {n}→{MAX_SEQS}"

        # Write input for hmmbuild (subsampled if needed)
        tmp = HMMS / f"_tmp_{fna.stem}.fna"
        write_fasta(records, tmp)

        try:
            ok, err = build_hmm(tmp, hmm)
        except subprocess.TimeoutExpired:
            ok, err = False, "hmmbuild timeout"
        finally:
            tmp.unlink(missing_ok=True)

        if ok:
            built += 1
            print(f"[{i+1:3d}] OK    {fna.stem[:55]}  ({note})", flush=True)
        else:
            failed += 1
            print(f"[{i+1:3d}] FAIL  {fna.stem[:55]}  {err}", flush=True)

        if (i + 1) % 20 == 0:
            print(f"  --- {i+1}/{len(files)}: built={built} failed={failed} skipped={skipped} ---",
                  flush=True)

    print(f"\nFinal: built={built} failed={failed} skipped={skipped}")

    # Concatenate and press
    print("\n=== Concatenating and pressing ===", flush=True)
    hmm_files = sorted(f for f in HMMS.glob("*.hmm") if f.stat().st_size > 0)
    if not hmm_files:
        print("No HMM files — nothing to press")
        sys.exit(1)

    with open(FINAL_HMM, "w") as out:
        for f in hmm_files:
            out.write(f.read_text())

    n_profiles = FINAL_HMM.read_text().count("HMMER3")
    print(f"Total profiles: {n_profiles}")

    r = subprocess.run(["hmmpress", "-f", str(FINAL_HMM)], capture_output=True, text=True)
    print("hmmpress OK" if r.returncode == 0 else f"hmmpress FAILED: {r.stderr[:200]}")
    print(f"\nDone — {FINAL_HMM}", flush=True)


if __name__ == "__main__":
    main()
