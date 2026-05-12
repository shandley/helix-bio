#!/bin/bash
#SBATCH --job-name=feat_hmm
#SBATCH --output=/scratch/sahlab/shandley/helix-feature-db/feature_registry/logs/hmm_%j.out
#SBATCH --error=/scratch/sahlab/shandley/helix-feature-db/feature_registry/logs/hmm_%j.err
#SBATCH --time=04:00:00
#SBATCH --mem=64G
#SBATCH --cpus-per-task=16
#SBATCH --partition=general

set -euo pipefail
source /ref/sahlab/software/scott_conda/miniconda/etc/profile.d/conda.sh
conda activate confphylo

DB=/scratch/sahlab/shandley/helix-feature-db/feature_registry
VARIANTS=$DB/variants
ALIGNMENTS=$DB/alignments
HMMS=$DB/hmms
FINAL_HMM=$DB/canonical_features.hmm

mkdir -p "$ALIGNMENTS" "$HMMS"

echo "=== Building HMM profiles for canonical features ==="
echo "Start: $(date)"

built=0
failed=0
skipped=0

for INPUT in "$VARIANTS"/*.fna; do
    BASENAME=$(basename "$INPUT" .fna)
    HMM_OUT="$HMMS/${BASENAME}.hmm"
    ALN_OUT="$ALIGNMENTS/${BASENAME}.afa"

    # Already done
    if [ -f "$HMM_OUT" ]; then
        skipped=$((skipped + 1))
        continue
    fi

    # Count sequences safely
    N=0
    if [ -s "$INPUT" ]; then
        N=$(grep -c '^>' "$INPUT" || true)
    fi

    if [ "$N" -eq 0 ]; then
        skipped=$((skipped + 1))
        continue
    fi

    if [ "$N" -eq 1 ]; then
        # Single sequence — hmmbuild directly
        if hmmbuild --cpu 2 --dna "$HMM_OUT" "$INPUT" > /dev/null 2>&1; then
            built=$((built + 1))
        else
            failed=$((failed + 1))
        fi
    else
        # Multiple sequences — align with MAFFT then hmmbuild
        if mafft --auto --thread 8 --quiet "$INPUT" > "$ALN_OUT" 2>/dev/null && \
           hmmbuild --cpu 8 --dna "$HMM_OUT" "$ALN_OUT" > /dev/null 2>&1; then
            built=$((built + 1))
        else
            failed=$((failed + 1))
        fi
    fi

    if [ $((built % 20)) -eq 0 ] && [ "$built" -gt 0 ]; then
        echo "  Progress: built=$built failed=$failed skipped=$skipped"
    fi
done

echo "Built: $built  Failed: $failed  Skipped: $skipped"
echo ""
echo "=== Concatenating and pressing HMM database ==="
cat "$HMMS"/*.hmm > "$FINAL_HMM"
N_PROFILES=$(grep -c "^HMMER3" "$FINAL_HMM" || echo 0)
echo "Total profiles: $N_PROFILES"
hmmpress -f "$FINAL_HMM"
echo "hmmpress complete"
echo ""
ls -lh "${FINAL_HMM}"*
echo ""
echo "Done: $(date)"
