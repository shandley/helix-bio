#!/usr/bin/env python3
"""
Build HMM profiles for canonical features from clustered representative sequences.

For each feature in variants/:
  - 1 sequence: hmmbuild directly (no alignment needed)
  - 2-50 sequences: MAFFT alignment then hmmbuild
  - >50 sequences: random subsample to 50, then MAFFT + hmmbuild

Concatenates all profiles and runs hmmpress to produce the final database.
Resume-safe: skips features with existing HMM files.

Usage: python3 05_build_hmms.py
"""

import random
import subprocess
import sys
import tempfile
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────

DB = Path("/scratch/sahlab/shandley/helix-feature-db/feature_registry")
VARIANTS_DIR = DB / "variants"
ALIGNMENTS_DIR = DB / "alignments"
HMMS_DIR = DB / "hmms"
FINAL_HMM = DB / "canonical_features.hmm"
MAX_SEQS_FOR_ALIGNMENT = 50
MAFFT_TIMEOUT_SEC = 300  # 5-minute max per alignment

ALIGNMENTS_DIR.mkdir(parents=True, exist_ok=True)
HMMS_DIR.mkdir(parents=True, exist_ok=True)

# ── Helpers ───────────────────────────────────────────────────────────────────

def parse_fasta(path: Path) -> list[tuple[str, str]]:
    records, header, seq_parts = [], None, []
    for line in path.read_text().splitlines():
        if line.startswith(">"):
            if header is not None:
                records.append((header, "".join(seq_parts)))
            header, seq_parts = line[1:].strip(), []
        else:
            seq_parts.append(line.strip())
    if header is not None:
        records.append((header, "".join(seq_parts)))
    return records

def write_fasta(records: list[tuple[str, str]], path: Path) -> None:
    lines = []
    for header, seq in records:
        lines.append(f">{header}")
        for i in range(0, len(seq), 80):
            lines.append(seq[i:i+80])
    path.write_text("\n".join(lines) + "\n")

def run(cmd: list[str], timeout: int | None = None) -> tuple[bool, str]:
    """Run command, return (success, stderr)."""
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True,
            timeout=timeout, check=False,
        )
        return result.returncode == 0, result.stderr
    except subprocess.TimeoutExpired:
        return False, f"TIMEOUT after {timeout}s"
    except Exception as e:
        return False, str(e)

def build_hmm(input_fna: Path, hmm_out: Path) -> tuple[bool, str]:
    """Align (if needed) and build HMM. Returns (success, note)."""
    records = parse_fasta(input_fna)
    n = len(records)

    if n == 0:
        return False, "empty input"

    if n == 1:
        ok, err = run(["hmmbuild", "--cpu", "2", "--dna", str(hmm_out), str(input_fna)])
        return ok, "single-seq" if ok else f"hmmbuild failed: {err[:80]}"

    # Subsample if too many sequences
    if n > MAX_SEQS_FOR_ALIGNMENT:
        records = random.sample(records, MAX_SEQS_FOR_ALIGNMENT)
        note = f"subsampled {n}→{MAX_SEQS_FOR_ALIGNMENT}"
    else:
        note = f"{n} seqs"

    # Write (possibly subsampled) FASTA to temp file for alignment
    with tempfile.NamedTemporaryFile(suffix=".fna", delete=False, mode="w") as tmp_fna:
        write_fasta(records, Path(tmp_fna.name))
        tmp_path = Path(tmp_fna.name)

    aln_path = ALIGNMENTS_DIR / (input_fna.stem + ".afa")

    # MAFFT alignment with timeout
    ok, err = run(
        ["mafft", "--auto", "--thread", "8", "--quiet", str(tmp_path)],
        timeout=MAFFT_TIMEOUT_SEC,
    )
    tmp_path.unlink(missing_ok=True)

    if not ok:
        # Timeout or error: fall back to no-alignment hmmbuild
        note += f" MAFFT failed ({err[:50]}), using unaligned"
        ok2, err2 = run(["hmmbuild", "--cpu", "8", "--dna", str(hmm_out), str(input_fna)])
        return ok2, note + (" ok" if ok2 else f" hmmbuild failed: {err2[:50]}")

    # Write MAFFT output to alignment file
    aln_path.write_text(err if not ok else "")  # MAFFT writes to stdout via subprocess
    # Re-run MAFFT capturing stdout properly
    try:
        mafft_result = subprocess.run(
            ["mafft", "--auto", "--thread", "8", "--quiet", str(input_fna)
             if n <= MAX_SEQS_FOR_ALIGNMENT else str(input_fna)],
            capture_output=True, text=True, timeout=MAFFT_TIMEOUT_SEC,
        )
        if mafft_result.returncode != 0 or not mafft_result.stdout.strip():
            raise RuntimeError(mafft_result.stderr[:80])
        aln_path.write_text(mafft_result.stdout)
    except (subprocess.TimeoutExpired, RuntimeError) as e:
        note += f" MAFFT timeout/error, using unaligned"
        ok2, err2 = run(["hmmbuild", "--cpu", "8", "--dna", str(hmm_out), str(input_fna)])
        return ok2, note

    # hmmbuild from alignment
    ok3, err3 = run(["hmmbuild", "--cpu", "8", "--dna", str(hmm_out), str(aln_path)])
    return ok3, note + (" ok" if ok3 else f" hmmbuild failed: {err3[:50]}")

# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    random.seed(42)
    variant_files = sorted(VARIANTS_DIR.glob("*.fna"))
    print(f"Building HMMs for {len(variant_files)} canonical features")
    print(f"Max seqs for alignment: {MAX_SEQS_FOR_ALIGNMENT}  MAFFT timeout: {MAFFT_TIMEOUT_SEC}s\n")

    built = skipped = failed = 0

    for i, input_fna in enumerate(variant_files):
        basename = input_fna.stem
        hmm_out = HMMS_DIR / f"{basename}.hmm"

        if hmm_out.exists():
            skipped += 1
            continue

        if not input_fna.exists() or input_fna.stat().st_size == 0:
            skipped += 1
            continue

        ok, note = build_hmm(input_fna, hmm_out)
        if ok:
            built += 1
            print(f"[{i+1:3d}] OK    {basename} ({note})")
        else:
            failed += 1
            print(f"[{i+1:3d}] FAIL  {basename}: {note}")

        if built % 20 == 0 and built > 0:
            print(f"      --- progress: built={built} failed={failed} skipped={skipped} ---")

    print(f"\nBuilt: {built}  Failed: {failed}  Skipped: {skipped}")

    # Concatenate and press
    print("\n=== Concatenating and pressing HMM database ===")
    hmm_files = sorted(HMMS_DIR.glob("*.hmm"))
    if not hmm_files:
        print("ERROR: no HMM files to concatenate")
        sys.exit(1)

    with open(FINAL_HMM, "w") as out:
        for f in hmm_files:
            out.write(f.read_text())

    n_profiles = FINAL_HMM.read_text().count("HMMER3")
    print(f"Total profiles: {n_profiles}")

    ok, err = run(["hmmpress", "-f", str(FINAL_HMM)])
    if ok:
        print("hmmpress complete")
        for f in FINAL_HMM.parent.glob("canonical_features.hmm*"):
            import os
            size = os.path.getsize(f)
            print(f"  {f.name}: {size/1e6:.1f} MB")
    else:
        print(f"hmmpress failed: {err[:200]}")

    print(f"\nDone. Database: {FINAL_HMM}")


if __name__ == "__main__":
    main()
