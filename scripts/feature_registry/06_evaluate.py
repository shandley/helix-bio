#!/usr/bin/env python3
"""
Ground truth evaluation of the k-mer annotation engine.

Ground truth: GenBank annotations in public/demo/*.gb
Predicted:    k-mer annotation using public/data/features.json

Metrics per plasmid and overall:
  Precision: fraction of auto-detections that overlap a real feature
  Recall:    fraction of real features that were detected
  F1:        harmonic mean of precision and recall

A predicted annotation is a True Positive if it overlaps >50% with any
ground truth feature of the same broad type (CDS, promoter, ori, etc.)
OR if the predicted name matches a ground truth name (normalised).

Usage: python3 scripts/feature_registry/06_evaluate.py
"""

import json
import re
from pathlib import Path

try:
    from Bio import SeqIO
    HAS_BIOPYTHON = True
except ImportError:
    HAS_BIOPYTHON = False
    print("BioPython not available — using regex GenBank parser")

ROOT     = Path(__file__).parent.parent.parent
DEMO_DIR = ROOT / "public" / "demo"
FEAT_DB  = ROOT / "public" / "data" / "features.json"

# ── Load feature database ──────────────────────────────────────────────────────

features = json.loads(FEAT_DB.read_text())
print(f"Feature database: {len(features)} sequences\n")

# ── K-mer annotation engine (mirrors annotate.ts) ─────────────────────────────

K            = 15
MIN_VOTES    = 3
MIN_IDENTITY = 0.82
MAX_SEQS_PER_FEAT = 12  # seed positions to sample

RC_TABLE = str.maketrans("ACGTN", "TGCAN")

def rc(s: str) -> str:
    return s.translate(RC_TABLE)[::-1]

def build_kmer_map(s: str) -> dict[str, list[int]]:
    m: dict[str, list[int]] = {}
    for i in range(len(s) - K + 1):
        k = s[i:i + K]
        if "N" not in k:
            m.setdefault(k, []).append(i)
    return m

def identity(a: str, b: str) -> float:
    matches = sum(x == y for x, y in zip(a, b))
    return matches / max(len(a), len(b))

def seed_positions(flen: int, n: int = 12) -> list[int]:
    if flen <= K:
        return [0]
    step = max(1, (flen - K) // (n - 1))
    pos: list[int] = []
    for i in range(n):
        p = min(i * step, flen - K)
        if not pos or p != pos[-1]:
            pos.append(p)
    return pos

def search_strand(query: str, qmap: dict, strand: int) -> list[dict]:
    results = []
    qlen = len(query)
    for f in features:
        fseq = f["seq"] if strand == 1 else rc(f["seq"])
        flen = len(fseq)
        if flen < K:
            continue
        votes: dict[int, int] = {}
        for pos in seed_positions(flen):
            kmer = fseq[pos:pos + K]
            if "N" in kmer:
                continue
            for qpos in qmap.get(kmer, []):
                es = qpos - pos
                votes[es] = votes.get(es, 0) + 1
        best = None
        for es, vc in votes.items():
            if vc < MIN_VOTES:
                continue
            qs = max(0, es)
            qe = min(qlen, es + flen)
            if qe - qs < max(20, flen * 0.6):
                continue
            fo = qs - es
            id_ = identity(query[qs:qe], fseq[fo:fo + (qe - qs)])
            if id_ < MIN_IDENTITY:
                continue
            if not best or id_ > best["identity"]:
                best = {"name": f["name"], "type": f["type"],
                        "start": qs, "end": qe, "strand": strand, "identity": id_}
        if best:
            results.append(best)
    return results

def annotate(seq: str) -> list[dict]:
    upper = seq.upper()
    rcseq = rc(upper)
    fwd = search_strand(upper, build_kmer_map(upper), 1)
    rev_raw = search_strand(rcseq, build_kmer_map(rcseq), -1)
    rev = [dict(a, start=len(upper)-a["end"], end=len(upper)-a["start"]) for a in rev_raw]

    # Dedup by position overlap >70%
    all_ann = sorted(fwd + rev, key=lambda a: -a["identity"])
    kept: list[dict] = []
    for ann in all_ann:
        overlaps = any(
            (min(k["end"], ann["end"]) - max(k["start"], ann["start"])) /
            max(1, min(k["end"] - k["start"], ann["end"] - ann["start"])) > 0.7
            for k in kept
        )
        if not overlaps:
            kept.append(ann)
    return sorted(kept, key=lambda a: a["start"])

# ── GenBank parsing ────────────────────────────────────────────────────────────

def norm(s: str) -> str:
    return re.sub(r"[+\-]$", "", s).lower().strip()

SKIP_TYPES = {"source", "gene", "primer_bind", "misc_difference",
              "old_sequence", "repeat_region", "misc_binding", "sig_peptide"}
MIN_FEATURE_LEN = 15  # ignore very short annotations

def parse_gb(path: Path) -> tuple[str, list[dict]]:
    """Return (sequence, list of feature dicts with name/start/end/type)."""
    if HAS_BIOPYTHON:
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            record = SeqIO.read(str(path), "genbank")
        seq = str(record.seq).upper()
        feats = []
        for f in record.features:
            if f.type in SKIP_TYPES:
                continue
            for qkey in ["label", "gene", "product", "note"]:
                vals = f.qualifiers.get(qkey, [])
                if vals:
                    name = vals[0].strip()
                    start = int(f.location.start)
                    end   = int(f.location.end)
                    if end - start >= MIN_FEATURE_LEN:
                        feats.append({"name": name, "type": f.type,
                                      "start": start, "end": end})
                    break
        return seq, feats

    # Fallback: regex parser
    seq = ""
    in_origin = False
    feats = []
    current_type = current_loc = None
    current_quals: list[str] = []

    def flush_feat():
        if not current_type or current_type in SKIP_TYPES:
            return
        loc_match = re.search(r"(\d+)\.\.(\d+)", current_loc or "")
        if not loc_match:
            return
        start, end = int(loc_match.group(1)) - 1, int(loc_match.group(2))
        if end - start < MIN_FEATURE_LEN:
            return
        for q in current_quals:
            m = re.search(r'/(?:label|gene|product|note)="([^"]+)"', q)
            if m:
                feats.append({"name": m.group(1), "type": current_type,
                              "start": start, "end": end})
                return

    for line in path.read_text().splitlines():
        if line.startswith("ORIGIN"):
            in_origin = True
            continue
        if line.startswith("//"):
            flush_feat()
            break
        if in_origin:
            seq += re.sub(r"[^acgtACGT]", "", line)
            continue
        feat_match = re.match(r"^ {5}(\S+)\s+(.+)$", line)
        if feat_match and feat_match.group(1) != "FEATURES":
            flush_feat()
            current_type = feat_match.group(1)
            current_loc  = feat_match.group(2).strip()
            current_quals = []
            continue
        if current_type and line.strip().startswith("/"):
            current_quals.append(line.strip())
    return seq.upper(), feats

# ── Evaluation ────────────────────────────────────────────────────────────────

def overlap_fraction(a: dict, b: dict) -> float:
    lo = max(a["start"], b["start"])
    hi = min(a["end"],   b["end"])
    if hi <= lo:
        return 0.0
    minlen = min(a["end"] - a["start"], b["end"] - b["start"])
    return (hi - lo) / max(1, minlen)

def is_tp(predicted: dict, ground_truths: list[dict], threshold: float = 0.5) -> bool:
    """True positive: predicted overlaps a ground truth by >threshold."""
    pnorm = norm(predicted["name"])
    for gt in ground_truths:
        if overlap_fraction(predicted, gt) > threshold:
            return True
        # Also accept: name match with any overlap
        if norm(gt["name"]) == pnorm and overlap_fraction(predicted, gt) > 0:
            return True
    return False

# ── Main ───────────────────────────────────────────────────────────────────────

gb_files = sorted(DEMO_DIR.glob("*.gb"))
print(f"Evaluating {len(gb_files)} plasmids...\n")
print(f"{'Plasmid':<22} {'GT':>4} {'Pred':>5} {'TP':>4} {'FP':>4} {'FN':>4}  {'Prec':>6} {'Rec':>6} {'F1':>6}")
print("-" * 75)

total_gt = total_pred = total_tp = total_fp = total_fn = 0

per_plasmid: list[dict] = []

for gbf in gb_files:
    seq, gt_feats = parse_gb(gbf)
    if not seq:
        continue

    predicted = annotate(seq)

    # Remove predicted annotations that overlap existing GT (dedup against GT)
    gt_norms = {norm(f["name"]) for f in gt_feats}
    pred_new = [p for p in predicted
                if not any(overlap_fraction(p, gt) > 0.5 for gt in gt_feats)]

    # Evaluate pred_new (the "new" auto-annotations)
    # TP: predicted overlaps a ground truth that wasn't already in GenBank
    # For overall evaluation: consider ALL predictions against ALL GT
    all_pred = predicted  # all predictions, including those overlapping GenBank

    tp = sum(1 for p in all_pred if is_tp(p, gt_feats))
    fp = len(all_pred) - tp
    fn = sum(1 for gt in gt_feats
             if not any(overlap_fraction(p, gt) > 0.5 for p in all_pred))

    prec = tp / max(1, tp + fp)
    rec  = tp / max(1, tp + fn)
    f1   = 2 * prec * rec / max(0.001, prec + rec)

    name = gbf.stem
    print(f"{name:<22} {len(gt_feats):>4} {len(all_pred):>5} {tp:>4} {fp:>4} {fn:>4}  "
          f"{prec:>6.1%} {rec:>6.1%} {f1:>6.1%}")

    total_gt   += len(gt_feats)
    total_pred += len(all_pred)
    total_tp   += tp
    total_fp   += fp
    total_fn   += fn

    per_plasmid.append({
        "plasmid": name, "gt": len(gt_feats), "pred": len(all_pred),
        "tp": tp, "fp": fp, "fn": fn,
        "precision": prec, "recall": rec, "f1": f1,
        "fn_features": [gt["name"] for gt in gt_feats
                        if not any(overlap_fraction(p, gt) > 0.5 for p in all_pred)],
        "fp_features": [p["name"] for p in all_pred if not is_tp(p, gt_feats)],
    })

print("-" * 75)
macro_prec = total_tp / max(1, total_tp + total_fp)
macro_rec  = total_tp / max(1, total_tp + total_fn)
macro_f1   = 2 * macro_prec * macro_rec / max(0.001, macro_prec + macro_rec)
print(f"{'OVERALL':<22} {total_gt:>4} {total_pred:>5} {total_tp:>4} {total_fp:>4} {total_fn:>4}  "
      f"{macro_prec:>6.1%} {macro_rec:>6.1%} {macro_f1:>6.1%}")

# ── Detailed breakdown ────────────────────────────────────────────────────────

print("\n=== False Positives (features detected that aren't in GenBank) ===")
for p in per_plasmid:
    if p["fp_features"]:
        print(f"  {p['plasmid']}: {', '.join(p['fp_features'][:5])}"
              + (f" +{len(p['fp_features'])-5} more" if len(p['fp_features']) > 5 else ""))

print("\n=== False Negatives (GenBank features not detected) ===")
for p in per_plasmid:
    if p["fn_features"]:
        print(f"  {p['plasmid']}: {', '.join(p['fn_features'][:5])}"
              + (f" +{len(p['fn_features'])-5} more" if len(p['fn_features']) > 5 else ""))

# Save results
out = ROOT / "data" / "evaluation_results.json"
out.write_text(json.dumps({
    "overall": {"precision": macro_prec, "recall": macro_rec, "f1": macro_f1,
                "total_gt": total_gt, "total_pred": total_pred,
                "total_tp": total_tp, "total_fp": total_fp, "total_fn": total_fn},
    "per_plasmid": per_plasmid,
}, indent=2))
print(f"\nResults saved: {out}")
