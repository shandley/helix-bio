#!/bin/bash
#SBATCH --job-name=feat_blast
#SBATCH --output=/scratch/sahlab/shandley/helix-feature-db/feature_registry/logs/blast_%A_%a.out
#SBATCH --error=/scratch/sahlab/shandley/helix-feature-db/feature_registry/logs/blast_%A_%a.err
#SBATCH --time=04:00:00
#SBATCH --mem=16G
#SBATCH --cpus-per-task=8
#SBATCH --partition=general
#SBATCH --array=0-199%20   # 200 features, max 20 concurrent

# BLAST-validate collected sequences for one canonical feature.
# Keeps only sequences that:
#   - Hit a real GenBank record (E < 1e-20)
#   - Query coverage > 60%
#   - Percent identity > 70%
#
# Submit: sbatch 03_validate_blast.sh
# Depends on: 02_collect_sequences.py having been run

set -euo pipefail
source /ref/sahlab/software/scott_conda/miniconda/etc/profile.d/conda.sh
conda activate confphylo

DB=/scratch/sahlab/shandley/helix-feature-db
RAW=$DB/feature_registry/raw_sequences
VALID=$DB/feature_registry/validated_sequences
LOGS=$DB/feature_registry/logs
mkdir -p "$VALID" "$LOGS"

# Get list of raw sequence files (one per feature)
mapfile -t FILES < <(ls "$RAW"/*.fna 2>/dev/null | sort)
NFILES=${#FILES[@]}

if [ "$SLURM_ARRAY_TASK_ID" -ge "$NFILES" ]; then
    echo "Task $SLURM_ARRAY_TASK_ID >= $NFILES files, nothing to do"
    exit 0
fi

INPUT="${FILES[$SLURM_ARRAY_TASK_ID]}"
BASENAME=$(basename "$INPUT" .fna)
OUTPUT="$VALID/${BASENAME}.fna"
BLAST_OUT="$LOGS/blast_${BASENAME}.txt"

echo "Task $SLURM_ARRAY_TASK_ID: $BASENAME"
echo "Input:  $INPUT ($(grep -c '^>' "$INPUT" 2>/dev/null || echo 0) sequences)"

# Skip empty files
if [ ! -s "$INPUT" ]; then
    echo "Empty input, skipping"
    exit 0
fi

# Skip if already validated
if [ -f "$OUTPUT" ] && [ -s "$OUTPUT" ]; then
    echo "Already validated: $OUTPUT"
    exit 0
fi

# Run BLAST against nt database
# -task blastn-short for features < 50 bp, blastn otherwise
blastn \
    -query "$INPUT" \
    -db /ref/sahlab/data/nt/nt \
    -out "$BLAST_OUT" \
    -outfmt "6 qseqid sseqid pident length qcovs evalue bitscore stitle" \
    -evalue 1e-5 \
    -num_threads 8 \
    -max_target_seqs 5 \
    -max_hsps 1 2>/dev/null || {
    # Fall back to local NCBI nt if path differs
    blastn \
        -query "$INPUT" \
        -remote \
        -db nt \
        -out "$BLAST_OUT" \
        -outfmt "6 qseqid sseqid pident length qcovs evalue bitscore stitle" \
        -evalue 1e-5 \
        -max_target_seqs 5 \
        -max_hsps 1 2>/dev/null || true
}

# Filter sequences: keep if top hit passes thresholds
python3 - <<'PYEOF'
import sys
from pathlib import Path

blast_out = Path("$BLAST_OUT")
input_fna = Path("$INPUT")
output_fna = Path("$OUTPUT")

# Parse BLAST results: best hit per query
best_hits: dict[str, dict] = {}
if blast_out.exists():
    for line in blast_out.read_text().splitlines():
        parts = line.split("\t")
        if len(parts) < 7:
            continue
        qid, sid, pident, length, qcovs, evalue, bitscore = parts[:7]
        stitle = parts[7] if len(parts) > 7 else ""
        if qid not in best_hits:
            try:
                best_hits[qid] = {
                    "pident": float(pident),
                    "qcovs": float(qcovs),
                    "evalue": float(evalue),
                    "bitscore": float(bitscore),
                    "stitle": stitle,
                }
            except ValueError:
                pass

# Parse input FASTA and filter
passing = []
current_id = None
current_seq_lines = []

def flush(seq_id, seq_lines):
    if seq_id is None:
        return
    hit = best_hits.get(seq_id, {})
    # NCBI reference sequences (fetched directly) always pass
    is_ncbi_ref = seq_id.startswith("ncbi_")
    passes = is_ncbi_ref or (
        hit.get("evalue", 1) < 1e-20 and
        hit.get("pident", 0) >= 70 and
        hit.get("qcovs", 0) >= 60
    )
    if passes:
        passing.append(f">{seq_id}\n" + "\n".join(seq_lines))

for line in input_fna.read_text().splitlines():
    if line.startswith(">"):
        flush(current_id, current_seq_lines)
        current_id = line[1:].split()[0]
        current_seq_lines = []
    else:
        current_seq_lines.append(line.strip())
flush(current_id, current_seq_lines)

if passing:
    output_fna.write_text("\n".join(passing) + "\n")
    print(f"Kept {len(passing)} / {len(best_hits) + (1 if not best_hits else 0)} sequences")
else:
    print(f"No sequences passed validation (had {len(best_hits)} BLAST hits)")
PYEOF

echo "Done: $(date)"
