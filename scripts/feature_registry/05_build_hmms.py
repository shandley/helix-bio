#!/usr/bin/env python3
"""
Build HMM profiles for canonical features from clustered representative sequences.
Resume-safe: skips features with existing .hmm files.

Strategy:
  1 sequence : hmmbuild directly on single sequence (no alignment)
  2–50 seqs  : MAFFT fast alignment (--retree 2 --maxiterate 0) + hmmbuild
  >50 seqs   : random subsample to 50, then same as above
  MAFFT fail : fall back to unaligned hmmbuild

Usage: python3 05_build_hmms.py
"""

import random
import subprocess
import sys
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
DB          = Path("/scratch/sahlab/shandley/helix-feature-db/feature_registry")
VARIANTS    = DB / "variants"
ALNS        = DB / "alignments"
HMMS        = DB / "hmms"
FINAL_HMM   = DB / "canonical_features.hmm"
MAX_SEQS    = 50      # subsample threshold
TIMEOUT_S   = 120     # 2-minute MAFFT timeout per feature

ALNS.mkdir(parents=True, exist_ok=True)
HMMS.mkdir(parents=True, exist_ok=True)

# ── FASTA helpers ─────────────────────────────────────────────────────────────

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

# ── HMM build ─────────────────────────────────────────────────────────────────

def hmmbuild(input_path: Path, hmm_out: Path, cpus: int = 8) -> tuple[bool, str]:
    r = subprocess.run(
        ["hmmbuild", "--cpu", str(cpus), "--dna", str(hmm_out), str(input_path)],
        capture_output=True, text=True,
    )
    return r.returncode == 0, r.stderr[:120]

def mafft_align(input_path: Path, aln_out: Path) -> tuple[bool, str]:
    """Fast MAFFT alignment with timeout. Returns (success, note)."""
    try:
        r = subprocess.run(
            # --retree 2 --maxiterate 0 = fast progressive, no refinement
            ["mafft", "--retree", "2", "--maxiterate", "0",
             "--thread", "8", "--quiet", str(input_path)],
            capture_output=True, text=True, timeout=TIMEOUT_S,
        )
        if r.returncode == 0 and r.stdout.strip():
            aln_out.write_text(r.stdout)
            return True, "aligned"
        return False, f"mafft error: {r.stderr[:80]}"
    except subprocess.TimeoutExpired:
        return False, f"mafft timeout >{TIMEOUT_S}s"

def build_one(input_fna: Path, hmm_out: Path) -> tuple[bool, str]:
    records = read_fasta(input_fna)
    n = len(records)
    if n == 0:
        return False, "empty"

    if n == 1:
        ok, err = hmmbuild(input_fna, hmm_out, cpus=2)
        return ok, "single-seq" if ok else f"hmmbuild failed: {err}"

    # Subsample if needed
    if n > MAX_SEQS:
        records = random.sample(records, MAX_SEQS)
        note = f"subsampled {n}→{MAX_SEQS}"
    else:
        note = f"{n} seqs"

    # Write (sub)sample to temp file for alignment
    tmp = input_fna.parent / f"_tmp_{input_fna.stem}.fna"
    write_fasta(records, tmp)

    try:
        aln_out = ALNS / (input_fna.stem + ".afa")
        ok_aln, aln_note = mafft_align(tmp, aln_out)

        if ok_aln:
            ok, err = hmmbuild(aln_out, hmm_out)
            result_note = f"{note}, {aln_note}"
            return ok, result_note if ok else f"{result_note}, hmmbuild failed: {err}"
        else:
            # MAFFT failed/timed out — use unaligned
            ok, err = hmmbuild(tmp, hmm_out)
            result_note = f"{note}, {aln_note}, unaligned fallback"
            return ok, result_note if ok else f"{result_note}, hmmbuild failed: {err}"
    finally:
        tmp.unlink(missing_ok=True)

# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    random.seed(42)
    files = sorted(VARIANTS.glob("*.fna"))
    print(f"Processing {len(files)} feature files")
    print(f"Max seqs: {MAX_SEQS}  MAFFT timeout: {TIMEOUT_S}s\n")

    built = failed = skipped = 0

    for i, fna in enumerate(files):
        hmm = HMMS / (fna.stem + ".hmm")

        if hmm.exists():
            skipped += 1
            continue

        if fna.stat().st_size == 0:
            skipped += 1
            continue

        ok, note = build_one(fna, hmm)
        if ok:
            built += 1
            print(f"[{i+1:3d}] OK    {fna.stem[:50]}  ({note})")
        else:
            failed += 1
            print(f"[{i+1:3d}] FAIL  {fna.stem[:50]}  ({note})")

        if (built + failed) % 20 == 0:
            print(f"  --- built={built} failed={failed} skipped={skipped} ---")

    print(f"\nFinal: built={built} failed={failed} skipped={skipped}")

    # Concatenate and press
    print("\n=== Concatenating and pressing ===")
    hmm_files = sorted(HMMS.glob("*.hmm"))
    if not hmm_files:
        print("No HMM files — nothing to press")
        sys.exit(1)

    with open(FINAL_HMM, "w") as out:
        for f in hmm_files:
            out.write(f.read_text())

    n = FINAL_HMM.read_text().count("HMMER3")
    print(f"Total profiles: {n}")

    r = subprocess.run(["hmmpress", "-f", str(FINAL_HMM)],
                       capture_output=True, text=True)
    if r.returncode == 0:
        print("hmmpress OK")
    else:
        print(f"hmmpress failed: {r.stderr[:200]}")

    print(f"\nDone — database: {FINAL_HMM}")

if __name__ == "__main__":
    main()
