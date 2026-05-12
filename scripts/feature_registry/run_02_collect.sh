#!/bin/bash
#SBATCH --job-name=feat_collect
#SBATCH --output=/scratch/sahlab/shandley/helix-feature-db/feature_registry/logs/collect_%j.out
#SBATCH --error=/scratch/sahlab/shandley/helix-feature-db/feature_registry/logs/collect_%j.err
#SBATCH --time=02:00:00
#SBATCH --mem=32G
#SBATCH --cpus-per-task=4
#SBATCH --partition=general

set -euo pipefail
source /ref/sahlab/software/scott_conda/miniconda/etc/profile.d/conda.sh
conda activate confphylo

mkdir -p /scratch/sahlab/shandley/helix-feature-db/feature_registry/logs

# Copy registry JSON from local Mac (sync via git or scp before running)
echo "Start: $(date)"
python3 /scratch/sahlab/shandley/helix-feature-db/scripts/feature_registry/02_collect_sequences.py
echo "Done:  $(date)"
