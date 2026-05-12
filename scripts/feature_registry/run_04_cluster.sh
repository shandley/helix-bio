#!/bin/bash
#SBATCH --job-name=feat_cluster
#SBATCH --output=/scratch/sahlab/shandley/helix-feature-db/feature_registry/logs/cluster_%j.out
#SBATCH --error=/scratch/sahlab/shandley/helix-feature-db/feature_registry/logs/cluster_%j.err
#SBATCH --time=01:00:00
#SBATCH --mem=32G
#SBATCH --cpus-per-task=16
#SBATCH --partition=general

set -euo pipefail
source /ref/sahlab/software/scott_conda/miniconda/etc/profile.d/conda.sh
conda activate mmseqs2

echo "Start: $(date)"
python3 /scratch/sahlab/shandley/helix-feature-db/scripts/feature_registry/04_cluster.py
echo "Done:  $(date)"
