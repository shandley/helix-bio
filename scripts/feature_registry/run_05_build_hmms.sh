#!/bin/bash
#SBATCH --job-name=feat_hmm
#SBATCH --output=/scratch/sahlab/shandley/helix-feature-db/feature_registry/logs/hmm_%j.out
#SBATCH --error=/scratch/sahlab/shandley/helix-feature-db/feature_registry/logs/hmm_%j.err
#SBATCH --time=04:00:00
#SBATCH --mem=32G
#SBATCH --cpus-per-task=16
#SBATCH --partition=general

set -euo pipefail
source /ref/sahlab/software/scott_conda/miniconda/etc/profile.d/conda.sh
conda activate confphylo

echo "Start: $(date)"
python3 /scratch/sahlab/shandley/helix-feature-db/scripts/feature_registry/05_build_hmms.py
echo "Done:  $(date)"
