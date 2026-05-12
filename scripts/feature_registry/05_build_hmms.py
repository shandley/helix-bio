#!/usr/bin/env python3
"""
Build HMM profiles for canonical features from clustered representative sequences.

Pipeline per feature:
  1 sequence  : hmmbuild directly (no alignment needed)
  2-50 seqs   : MUSCLE alignment (60s hard kill) → hmmbuild
  >50 seqs    : subsample to 50 → MUSCLE → hmmbuild
  MUSCLE fail : skip (no HMM for this feature)

Uses os.killpg() to kill MUSCLE's entire process group on timeout,
ensuring child threads die too (unlike subprocess timeout alone).

Resume-safe: skips features with non-empty .hmm files.
"""

import os
import random
import signal
import subprocess
import sys
import tempfile
from pathlib import Path

# ── Config ─────────────────────────────────────────────────────────────────────
DB        = Path("/scratch/sahlab/shandley/helix-feature-db/feature_registry")
VARIANTS  = DB / "variants"
HMMS      = DB / "hmms"
FINAL_HMM = DB / "canonical_features.hmm"
MAX_SEQS  = 50
ALIGN_TIMEOUT = 60  # seconds — hard kill via SIGKILL

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

# ── Alignment with hard kill ───────────────────────────────────────────────────

def muscle_align(input_path: Path, aln_out: Path) -> tuple[bool, str]:
    """
    Run MUSCLE with a hard process-group kill on timeout.
    Kills the entire process group (including threads) so nothing lingers.
    """
    try:
        proc = subprocess.Popen(
            ["muscle", "-in", str(input_path), "-out", str(aln_out), "-quiet"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            start_new_session=True,  # puts process in its own process group
        )
        try:
            _, stderr = proc.communicate(timeout=ALIGN_TIMEOUT)
            if proc.returncode == 0 and aln_out.exists() and aln_out.stat().st_size > 0:
                return True, "aligned"
            return False, f"muscle error: {(stderr or b'').decode()[:80]}"
        except subprocess.TimeoutExpired:
            # Hard kill the entire process group
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            except ProcessLookupError:
                pass
            proc.wait()
            return False, f"muscle timeout >{ALIGN_TIMEOUT}s"
    except FileNotFoundError:
        return False, "muscle not found"

# ── HMM build ──────────────────────────────────────────────────────────────────

def hmmbuild(input_path: Path, hmm_out: Path, cpus: int = 8) -> tuple[bool, str]:
    try:
        r = subprocess.run(
            ["hmmbuild", "--cpu", str(cpus), "--dna", str(hmm_out), str(input_path)],
            capture_output=True, text=True, timeout=60,
        )
        if r.returncode == 0 and hmm_out.exists() and hmm_out.stat().st_size > 0:
            return True, ""
        return False, r.stderr[:120]
    except subprocess.TimeoutExpired:
        return False, "hmmbuild timeout"

# ── Per-feature pipeline ───────────────────────────────────────────────────────

def build_one(fna: Path, hmm: Path) -> tuple[bool, str]:
    records = read_fasta(fna)
    n = len(records)
    if n == 0:
        return False, "empty"

    if n == 1:
        ok, err = hmmbuild(fna, hmm, cpus=2)
        return ok, "single-seq" if ok else f"hmmbuild failed: {err}"

    # Subsample
    if n > MAX_SEQS:
        records = random.sample(records, MAX_SEQS)
        note = f"subsampled {n}→{MAX_SEQS}"
    else:
        note = f"{n} seqs"

    # Write subsampled input
    with tempfile.NamedTemporaryFile(suffix=".fna", delete=False, mode="w",
                                      dir=HMMS) as tmp_fna:
        tmp_fna_path = Path(tmp_fna.name)
    write_fasta(records, tmp_fna_path)

    aln_path = HMMS / f"_aln_{fna.stem}.afa"

    try:
        ok_aln, aln_note = muscle_align(tmp_fna_path, aln_path)
        if not ok_aln:
            return False, f"{note}, {aln_note}"

        ok, err = hmmbuild(aln_path, hmm)
        if ok:
            return True, f"{note}, aligned"
        return False, f"{note}, aligned, hmmbuild failed: {err}"
    finally:
        tmp_fna_path.unlink(missing_ok=True)
        aln_path.unlink(missing_ok=True)

# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    random.seed(42)
    files = sorted(VARIANTS.glob("*.fna"))
    print(f"Building HMMs for {len(files)} features  (MUSCLE + hmmbuild, max {MAX_SEQS} seqs)",
          flush=True)

    built = failed = skipped = 0

    for i, fna in enumerate(files):
        hmm = HMMS / (fna.stem + ".hmm")

        if hmm.exists() and hmm.stat().st_size > 0:
            skipped += 1
            continue

        if fna.stat().st_size == 0:
            skipped += 1
            print(f"[{i+1:3d}] SKIP  {fna.stem}", flush=True)
            continue

        ok, note = build_one(fna, hmm)
        label = "OK  " if ok else "FAIL"
        print(f"[{i+1:3d}] {label}  {fna.stem[:55]}  ({note})", flush=True)
        if ok:
            built += 1
        else:
            failed += 1

        if (i + 1) % 20 == 0:
            pct = round(100 * (i + 1) / len(files))
            print(f"  --- {i+1}/{len(files)} ({pct}%) built={built} failed={failed} ---",
                  flush=True)

    print(f"\nFinal: built={built} failed={failed} skipped={skipped}", flush=True)

    print("\n=== Concatenating and pressing ===", flush=True)
    hmm_files = sorted(f for f in HMMS.glob("*.hmm") if f.stat().st_size > 0)
    if not hmm_files:
        print("No HMM files found")
        sys.exit(1)

    with open(FINAL_HMM, "w") as out:
        for f in hmm_files:
            out.write(f.read_text())

    n_profiles = FINAL_HMM.read_text().count("HMMER3")
    print(f"Total profiles: {n_profiles}", flush=True)

    r = subprocess.run(["hmmpress", "-f", str(FINAL_HMM)], capture_output=True, text=True)
    print("hmmpress OK" if r.returncode == 0 else f"hmmpress FAILED: {r.stderr[:200]}",
          flush=True)
    print(f"\nDone — {FINAL_HMM}", flush=True)


if __name__ == "__main__":
    main()
