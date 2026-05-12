#!/bin/bash
#SBATCH --job-name=feat_valid
#SBATCH --output=/scratch/sahlab/shandley/helix-feature-db/feature_registry/logs/valid_%A_%a.out
#SBATCH --error=/scratch/sahlab/shandley/helix-feature-db/feature_registry/logs/valid_%A_%a.err
#SBATCH --time=00:30:00
#SBATCH --mem=4G
#SBATCH --cpus-per-task=1
#SBATCH --partition=general
#SBATCH --array=0-191

set -euo pipefail
source /ref/sahlab/software/scott_conda/miniconda/etc/profile.d/conda.sh
conda activate confphylo

DB=/scratch/sahlab/shandley/helix-feature-db
RAW=$DB/feature_registry/raw_sequences
VALID=$DB/feature_registry/validated_sequences
REGISTRY=$DB/feature_registry/canonical_features.json
SCRIPTS=$DB/scripts/feature_registry

mkdir -p "$VALID"

# Get the Nth raw file
mapfile -t FILES < <(ls "$RAW"/*.fna 2>/dev/null | sort)
INPUT="${FILES[$SLURM_ARRAY_TASK_ID]}"
BASENAME=$(basename "$INPUT" .fna)
OUTPUT="$VALID/${BASENAME}.fna"

echo "Task $SLURM_ARRAY_TASK_ID: $BASENAME"

python3 "$SCRIPTS/03_validate.py" \
    "$BASENAME" \
    "$REGISTRY" \
    "$INPUT" \
    "$OUTPUT"

echo "Done: $(date)"
