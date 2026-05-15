#!/usr/bin/env python3
"""
Generates real sequences for the construct designer parts catalog.

Sources:
  1. public/data/features.json — our curated annotation database (primary)
  2. NCBI efetch — for parts missing from features.json (CmR)

Run from project root:
  python3 scripts/update-parts-catalog.py

Outputs a JSON file that records every part sequence and its source.
Re-run whenever features.json is updated (e.g., after Addgene expansion).
"""

import json
import urllib.request
import re
import time
import sys
from pathlib import Path

# ── Load features database ────────────────────────────────────────────────────

features_path = Path("public/data/features.json")
if not features_path.exists():
    sys.exit("Error: public/data/features.json not found. Run from project root.")

with open(features_path) as f:
    features = json.load(f)

print(f"Loaded {len(features)} features from features.json", file=sys.stderr)

def find_feature(name_exact=None, name_contains=None, feat_type=None,
                 min_len=0, max_len=999999, index=None):
    if index is not None:
        return features[index]["seq"]
    for feat in features:
        if name_exact and feat["name"] != name_exact:
            continue
        if name_contains and name_contains.lower() not in feat["name"].lower():
            continue
        if feat_type and feat["type"] != feat_type:
            continue
        if not (min_len <= len(feat["seq"]) <= max_len):
            continue
        return feat["seq"]
    return None

# ── NCBI helpers ──────────────────────────────────────────────────────────────

NCBI_EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

def fetch_gb(accession):
    url = f"{NCBI_EFETCH}?db=nucleotide&id={accession}&rettype=gb&retmode=text"
    print(f"  Fetching {accession} from NCBI...", file=sys.stderr)
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            return resp.read().decode()
    except Exception as e:
        print(f"  Failed: {e}", file=sys.stderr)
        return None

def parse_origin(gb_text):
    m = re.search(r"^ORIGIN\s*\n([\s\S]+?)^//", gb_text, re.MULTILINE)
    if not m:
        return ""
    return re.sub(r"[\d\s]", "", m.group(1)).upper()

def rc(seq):
    comp = {"A": "T", "T": "A", "G": "C", "C": "G", "N": "N"}
    return "".join(comp.get(b, "N") for b in reversed(seq.upper()))

def extract_range(seq, start, end, complement=False):
    """Extract 1-based inclusive range, optionally reverse-complement."""
    s = seq[start - 1 : end]
    return rc(s) if complement else s

# ── Build catalog sequences ───────────────────────────────────────────────────

parts = {}

# AmpR promoter (105 bp) + AmpR CDS (861 bp) = 966 bp
ampR_prom = find_feature(name_exact="AmpR promoter", min_len=100, max_len=115)
ampR_cds  = find_feature(name_exact="AmpR", feat_type="CDS", min_len=858, max_len=865)
if ampR_prom and ampR_cds:
    parts["ampR_marker"] = {
        "seq": ampR_prom + ampR_cds,
        "length": len(ampR_prom) + len(ampR_cds),
        "source": f"features.json — AmpR promoter ({len(ampR_prom)} bp) + AmpR/bla CDS ({len(ampR_cds)} bp, TEM-1)",
    }
    print(f"ampR_marker: {len(parts['ampR_marker']['seq'])} bp", file=sys.stderr)

# KanR: AmpR promoter + Tn903 KanR CDS (816 bp) = 921 bp
# The AmpR promoter is a strong constitutive bacterial promoter that drives KanR expression.
kanR_cds = find_feature(name_exact="KanR", feat_type="CDS", min_len=810, max_len=820)
if ampR_prom and kanR_cds:
    parts["kanR_marker"] = {
        "seq": ampR_prom + kanR_cds,
        "length": len(ampR_prom) + len(kanR_cds),
        "source": f"features.json — AmpR promoter ({len(ampR_prom)} bp) + KanR/APH(3')-Ia CDS ({len(kanR_cds)} bp, Tn903)",
    }
    print(f"kanR_marker: {len(parts['kanR_marker']['seq'])} bp", file=sys.stderr)

# CmR: cat promoter (102 bp) + cat CDS from NCBI (Tn9, J01783)
cat_prom = find_feature(name_exact="cat promoter", min_len=95, max_len=110)
print(f"Fetching CmR (cat gene) from NCBI...", file=sys.stderr)
cmr_gb = fetch_gb("J01783")  # Tn9 transposon — contains the canonical cat gene
time.sleep(0.5)
if cmr_gb:
    full_seq = parse_origin(cmr_gb)
    # cat CDS in J01783: find the CDS annotation
    # The cat gene in Tn9 encodes a 219aa / 660bp protein
    # Look for the CDS coordinates in the features table
    feat_section = re.search(r"FEATURES.*?(?=ORIGIN)", cmr_gb, re.DOTALL)
    cat_location = None
    if feat_section:
        cds_matches = re.finditer(r"     CDS\s+([^\n]+(?:\n\s+[^\n]+)*?)(?=\n     \S|\nORIGIN)", feat_section.group(), re.DOTALL)
        for m in cds_matches:
            block = m.group()
            if "cat" in block.lower() or "acetyltransferase" in block.lower() or "chloramphenicol" in block.lower():
                loc_match = re.search(r"CDS\s+([^\n]+)", block)
                if loc_match:
                    cat_location = loc_match.group(1).strip()
                    break
    if cat_location:
        print(f"  Found cat CDS at: {cat_location}", file=sys.stderr)
        # Parse the location
        is_comp = cat_location.startswith("complement(")
        loc = cat_location.replace("complement(", "").rstrip(")")
        if ".." in loc:
            s, e = loc.split("..")
            cat_cds = extract_range(full_seq, int(s), int(e), complement=is_comp)
        else:
            cat_cds = None
    else:
        # Fallback: J01783 is 1766bp; the cat gene CDS is approximately 561-1220 (660bp)
        print("  Could not parse CDS location; using approximate coordinates", file=sys.stderr)
        cat_cds = extract_range(full_seq, 561, 1220)

    if cat_cds and cat_prom:
        parts["cmR_marker"] = {
            "seq": cat_prom + cat_cds,
            "length": len(cat_prom) + len(cat_cds),
            "source": f"features.json — cat promoter ({len(cat_prom)} bp) + NCBI J01783 cat CDS ({len(cat_cds)} bp, Tn9)",
        }
        print(f"cmR_marker: {len(parts['cmR_marker']['seq'])} bp", file=sys.stderr)

# ColE1/pMB1 ori (1191 bp from features.json)
cole1 = find_feature(name_exact="ColE1 ori", feat_type="rep_origin", min_len=1100)
if cole1:
    parts["colE1_ori"] = {
        "seq": cole1,
        "length": len(cole1),
        "source": f"features.json — ColE1 ori ({len(cole1)} bp)",
    }
    print(f"colE1_ori: {len(cole1)} bp", file=sys.stderr)

# pMB1 ori (same cluster as ColE1 — use for the distinct catalog entry)
pmb1 = find_feature(name_exact="pMB1 ori", feat_type="rep_origin", min_len=1100)
if pmb1:
    parts["pMB1_ori"] = {
        "seq": pmb1,
        "length": len(pmb1),
        "source": f"features.json — pMB1 ori ({len(pmb1)} bp)",
    }

# p15A ori (546 bp)
p15a = find_feature(name_exact="p15A ori", feat_type="rep_origin", min_len=500, max_len=600)
if p15a:
    parts["p15a_ori"] = {
        "seq": p15a,
        "length": len(p15a),
        "source": f"features.json — p15A ori ({len(p15a)} bp)",
    }
    print(f"p15a_ori: {len(p15a)} bp", file=sys.stderr)

# araBAD promoter (285 bp)
arabad = find_feature(name_exact="araBAD promoter", min_len=200, max_len=400)
if arabad:
    parts["araBAD_promoter"] = {
        "seq": arabad,
        "length": len(arabad),
        "source": f"features.json — araBAD promoter ({len(arabad)} bp)",
    }
    print(f"araBAD_promoter: {len(arabad)} bp", file=sys.stderr)

# T7 terminator (48 bp)
t7_term = find_feature(name_exact="T7 terminator", feat_type="terminator", min_len=45, max_len=55)
if t7_term:
    parts["t7_terminator"] = {
        "seq": t7_term,
        "length": len(t7_term),
        "source": f"features.json — T7 terminator ({len(t7_term)} bp)",
    }
    print(f"t7_terminator: {len(t7_term)} bp", file=sys.stderr)

# rrnB T1T2 terminator: T1 (87 bp) + T2 (28 bp) = 115 bp
rrnb_t1 = find_feature(name_exact="rrnB T1 terminator", min_len=80, max_len=100)
rrnb_t2 = find_feature(name_exact="rrnB T2 terminator", min_len=25, max_len=35)
if rrnb_t1 and rrnb_t2:
    parts["rrnB_T1T2"] = {
        "seq": rrnb_t1 + rrnb_t2,
        "length": len(rrnb_t1) + len(rrnb_t2),
        "source": f"features.json — rrnB T1 ({len(rrnb_t1)} bp) + rrnB T2 ({len(rrnb_t2)} bp)",
    }
    print(f"rrnB_T1T2: {len(rrnb_t1)+len(rrnb_t2)} bp", file=sys.stderr)

# ── Output ────────────────────────────────────────────────────────────────────

out_path = Path("data/parts-sequences.json")
out_path.parent.mkdir(exist_ok=True)
with open(out_path, "w") as f:
    json.dump(parts, f, indent=2)

print(f"\nWrote {len(parts)} part sequences to {out_path}", file=sys.stderr)

# Print summary
print("\nPart | Length | Source")
print("-" * 80)
for part_id, info in parts.items():
    print(f"{part_id:20s} | {info['length']:6d} bp | {info['source'][:55]}")
