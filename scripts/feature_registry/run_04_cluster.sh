#!/bin/bash
#SBATCH --job-name=feat_cluster
#SBATCH --output=/scratch/sahlab/shandley/helix-feature-db/feature_registry/logs/cluster_%j.out
#SBATCH --error=/scratch/sahlab/shandley/helix-feature-db/feature_registry/logs/cluster_%j.err
#SBATCH --time=01:00:00
#SBATCH --mem=32G
#SBATCH --cpus-per-task=16
#SBATCH --partition=general

# Cluster validated sequences per canonical feature at 95% identity.
# For each feature: MMseqs2 cluster → pick representative → write to variants/
# Then merge all representatives into one FASTA for HMM building.

set -euo pipefail
source /ref/sahlab/software/scott_conda/miniconda/etc/profile.d/conda.sh
conda activate mmseqs2

DB=/scratch/sahlab/shandley/helix-feature-db/feature_registry
VALID=$DB/validated_sequences
VARIANTS=$DB/variants
MERGED=$DB/all_representatives.fna
TMP=$DB/tmp_cluster

mkdir -p "$VARIANTS" "$TMP"

echo "=== Clustering validated sequences at 95% identity ==="
echo "Start: $(date)"

total_in=0
total_out=0
skipped=0

for INPUT in "$VALID"/*.fna; do
    BASENAME=$(basename "$INPUT" .fna)
    OUTPUT="$VARIANTS/${BASENAME}.fna"

    # Count input sequences
    N=$(grep -c '^>' "$INPUT" 2>/dev/null || echo 0)
    total_in=$((total_in + N))

    if [ "$N" -eq 0 ]; then
        echo "SKIP $BASENAME (empty)"
        skipped=$((skipped + 1))
        touch "$OUTPUT"
        continue
    fi

    if [ "$N" -le 3 ]; then
        # Too few to cluster meaningfully — use as-is
        cp "$INPUT" "$OUTPUT"
        total_out=$((total_out + N))
        echo "COPY $BASENAME ($N seqs, no clustering needed)"
        continue
    fi

    # MMseqs2 cluster at 95% identity
    MMDB="$TMP/${BASENAME}_db"
    CLUSTERDB="$TMP/${BASENAME}_cluster"
    REPDB="$TMP/${BASENAME}_rep"

    mmseqs createdb "$INPUT" "$MMDB" -v 0
    mmseqs cluster \
        "$MMDB" "$CLUSTERDB" "$TMP/tmp_${BASENAME}" \
        --min-seq-id 0.95 \
        --cov-mode 0 \
        -c 0.80 \
        --threads 16 \
        -v 0

    mmseqs result2repseq "$MMDB" "$CLUSTERDB" "$REPDB" -v 0
    mmseqs convert2fasta "$REPDB" "$OUTPUT"

    NOUT=$(grep -c '^>' "$OUTPUT" 2>/dev/null || echo 0)
    total_out=$((total_out + NOUT))
    echo "CLUST $BASENAME: $N → $NOUT representatives"
done

echo ""
echo "=== Merging all representatives ==="
cat "$VARIANTS"/*.fna > "$MERGED"
TOTAL=$(grep -c '^>' "$MERGED" || echo 0)
echo "Total representative sequences: $TOTAL"
echo "Input sequences:  $total_in"
echo "Output (reps):    $total_out"
echo "Skipped (empty):  $skipped"
echo "Reduction ratio:  $(python3 -c "print(f'{$total_in/$total_out:.1f}x' if $total_out > 0 else 'N/A')")"
echo "Merged FASTA:     $MERGED"
echo ""
echo "Done: $(date)"
echo "Next: run_05_build_hmms.sh"
