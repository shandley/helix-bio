#!/usr/bin/env python3
"""
Fill variant files for the 50 features missing from the canonical database.

Strategy per feature type:
  1. Short elements (<50 bp): hard-coded canonical sequences
  2. Features with NCBI accessions: fetch GenBank, extract by length (not name)
  3. Fluorescent proteins / CRISPR: targeted NCBI nucleotide search + CDS fetch
  4. Local GenBank files: extract by length from known demo plasmids

Run locally; outputs to data/fill_missing/. Then SCP to HTCF variants/ dir.
"""

import json, re, time, urllib.request, urllib.parse
from io import StringIO
from pathlib import Path

try:
    from Bio import SeqIO, Entrez
    HAS_BIOPYTHON = True
    Entrez.email = "handley.scott@gmail.com"
except ImportError:
    print("pip install biopython"); exit(1)

ROOT     = Path(__file__).parent.parent.parent
DEMO_DIR = ROOT / "public" / "demo"
REGISTRY = ROOT / "data" / "canonical_features.json"
OUT_DIR  = ROOT / "data" / "fill_missing"
OUT_DIR.mkdir(parents=True, exist_ok=True)

NCBI_EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
NCBI_SEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"

registry: list[dict] = json.loads(REGISTRY.read_text())
def norm(s): return re.sub(r"[^a-z0-9]", "", s.lower())
def safe_id(s): return re.sub(r"[^a-zA-Z0-9_-]", "_", s)

feat_by_name: dict[str, dict] = {}
for f in registry:
    for n in [f.get("canonical_name",""), f.get("_source_name","")] + f.get("aliases",[]):
        if n: feat_by_name[norm(n)] = f

# ── Helper: write sequences to output file ────────────────────────────────────

written_count = {}

def write_seqs(canonical_name: str, seqs: list[str], source: str) -> None:
    sid = safe_id(canonical_name)
    out = OUT_DIR / f"{sid}.fna"
    safe_name = canonical_name.replace(" ","_").replace("/","-").replace("|","-")
    feat = feat_by_name.get(norm(canonical_name), {})
    category = feat.get("category", feat.get("_category_hint", ""))
    ftype_map = {
        "resistance_marker":"CDS","origin_of_replication":"rep_origin",
        "promoter_bacterial":"promoter","promoter_mammalian":"promoter",
        "promoter_inducible":"promoter","reporter":"CDS","epitope_tag":"CDS",
        "crispr_nuclease":"CDS","regulatory":"regulatory","viral_element":"LTR",
        "recombination_site":"protein_bind","crispr_element":"misc_RNA",
    }
    ftype = ftype_map.get(category, "misc_feature")
    mode = "a" if out.exists() else "w"
    with open(out, mode) as fh:
        for seq in seqs:
            if not seq: continue
            hdr = f">{safe_name}_{source}|{ftype}|{len(seq)}"
            fh.write(f"{hdr}\n")
            for i in range(0, len(seq), 80): fh.write(seq[i:i+80]+"\n")
    n = written_count.get(canonical_name, 0) + len(seqs)
    written_count[canonical_name] = n
    print(f"  {'HARD' if source=='hardcoded' else source.upper():6s} {canonical_name:<42} {[len(s) for s in seqs]} bp")

# ── NCBI helpers ──────────────────────────────────────────────────────────────

def fetch_genbank(accession: str) -> object | None:
    url = f"{NCBI_EFETCH}?db=nuccore&id={accession}&rettype=gb&retmode=text"
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            text = r.read().decode()
        if not text.strip().startswith("LOCUS"): return None
        return SeqIO.read(StringIO(text), "genbank")
    except Exception as e:
        print(f"    fetch {accession}: {e}")
        return None

def extract_by_length(record, expected: list[int],
                      feature_types: list[str] | None = None) -> list[str]:
    """Extract feature sequences from GenBank record by expected length range."""
    lo, hi = expected[0] * 0.4, expected[1] * 3.0
    results = []
    for feat in record.features:
        if feat.type in ("source",): continue
        if feature_types and feat.type not in feature_types: continue
        try:
            seq = str(feat.extract(record.seq)).upper()
            if lo <= len(seq) <= hi:
                results.append(seq)
        except Exception: pass
    # If no annotated features match, try the full record
    if not results:
        full = str(record.seq).upper()
        if lo <= len(full) <= hi:
            results.append(full)
    return results

def ncbi_search_fetch(query: str, expected: list[int],
                      max_results: int = 3) -> list[str]:
    """Search NCBI nucleotide, fetch top results, extract by length."""
    slen_range = f"{int(expected[0]*0.5)}:{int(expected[1]*2)}[SLEN]"
    q = urllib.parse.quote(f"{query} AND {slen_range}")
    url = f"{NCBI_SEARCH}?db=nuccore&term={q}&retmax={max_results}&retmode=json"
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            data = json.loads(r.read())
        ids = data.get("esearchresult", {}).get("idlist", [])
    except Exception:
        return []
    results = []
    for uid in ids[:max_results]:
        record = fetch_genbank(uid)
        if record:
            seqs = extract_by_length(record, expected)
            results.extend(seqs[:2])
        time.sleep(0.4)
    return results

# ── 1. Hard-coded canonical sequences ─────────────────────────────────────────
print("\n=== Hard-coded short sequences ===")

HARD: dict[str, str] = {
    # Short regulatory elements — sequences are definitional
    "Kozak sequence":
        "GCCGCCACCATG",            # Kozak 1987 consensus + start codon
    "tet operator":
        "TCCCTATCAGTGATAGAGAACGAAACAT",  # TetO2, Gossen & Bujard 1992
    # Recombination sites
    "lox2272":
        "ATAACTTCGTATAATGTATGCTATACGAAGTTAT",  # Branda & Bhatt 2004
    "loxN":
        "ATAACTTCGTATAATGTATAGTTATACGAAGTTAT",  # Langer et al. 2002
    "F3 FRT site":
        "GAAGTTCCTATTCTTCAAAAGAATAGGAACTTC",   # mutant FRT, Schlake & Bode 1994
    # Epitope tags (DNA encoding)
    "Myc tag":
        "GAACAAAAACTCATCTCAGAAGAGGATCTG",       # 10aa EQKLISEEDL
    "ALFA tag":
        "TCCCGTCTTGAAGAGCTTCGGCGTCGTCTTACTGAA", # 13aa SRLEEELRRRLTE, Götzke 2019
    "Twin-Strep-tag":
        "TGGAGCCATCCGCAGTTTGAAAAAGGTGGAGGCGGTTCAGGCGGAGGTGGCTCTGGCGGTGGCGGATCG"
        "TGGAGCCATCCGCAGTTTGAAAAATAG",           # Twin-Strep-tag, Schmidt 2013
    # Protease recognition sites
    "PreScission protease site":
        "CTGGAAGTTCTGTTCCAGGGGCCC",   # LEVLFQGP, HRV 3C protease site
    "Thrombin cleavage site":
        "CTGGTGCCGCGCGGCAGC",          # LVPRGS
    "Enterokinase cleavage site":
        "GACGACGACGACAAA",             # DDDDK
    "Factor Xa site":
        "ATTGAAGGCCGT",                # IEGR
    # Self-cleaving peptides (T2A from thosea asigna virus)
    "E2A self-cleaving peptide":
        "CAGTGTACTAATTATGCTCTCTTGAAATTGGCTGGAGATGTTGAGAGCAACCCTGGACCT",  # 20aa E2A
    "F2A":
        "GTGAAACAGACTTTGAATTTTGACCTTCTGAAGTTGGCAGGTGACGTGGAGTCCAACCCTGGCCCC",  # 22aa F2A
    # T3 promoter (17-23 bp, the core sequence)
    "T3 promoter":
        "AATTAACCCTCACTAAAGG",         # T3 minimal promoter consensus
}

for feat_name, seq in HARD.items():
    write_seqs(feat_name, [seq.upper()], "hardcoded")

# ── 2. Features with NCBI accessions in registry ──────────────────────────────
print("\n=== NCBI accession-based extraction ===")

ACCESSION_TARGETS: dict[str, list[str]] = {
    "pMB1 ori":                  ["J01749", "L09137"],
    "ColE1 ori":                 ["J01749", "L09137"],
    "RK2 oriV":                  ["BN000925"],
    "R6K gamma origin of replication": ["M28571"],
    "CMV immediate-early promoter": ["M21295", "BK000394"],
    "EF1α promoter":             ["J04617", "NM_001402"],
    "EF-1α promoter":            ["J04617"],
    "Human Ubiquitin C Promoter": ["NM_021009"],
    "HSV TK poly(A) signal":     ["NC_001806"],
    "PhiC31 attP":               ["AF218816"],
    "CjCas9":                    ["AL111168"],
    "Cas13a":                    ["KX823641"],
    "3' LTR ΔU3 (HIV-1)":        ["K03455"],
    "ITR (AAV9)":                ["AY530579"],
    "Myc tag":                   ["NM_002467"],
}

for feat_name, accessions in ACCESSION_TARGETS.items():
    feat = feat_by_name.get(norm(feat_name), {})
    expected = feat.get("expected_length_bp", [50, 5000])
    seqs = []
    for acc in accessions:
        record = fetch_genbank(acc)
        if record:
            extracted = extract_by_length(record, expected)
            seqs.extend(extracted[:2])
        time.sleep(0.4)
        if seqs:
            break
    if seqs:
        write_seqs(feat_name, seqs[:3], "ncbi")
    else:
        print(f"  MISS   {feat_name}")

# ── 3. Fluorescent proteins — NCBI nucleotide search ─────────────────────────
print("\n=== Fluorescent protein CDS search ===")

FP_SEARCHES: dict[str, str] = {
    "mTurquoise2":   "mTurquoise2 CDS fluorescent protein",
    "mNeonGreen":    "mNeonGreen fluorescent protein CDS",
    "iRFP":          "iRFP infrared fluorescent protein CDS phytochrome",
    "mEmerald":      "mEmerald green fluorescent protein CDS",
    "Clover":        "Clover green fluorescent protein CDS",
    "mRuby2":        "mRuby2 red fluorescent protein CDS",
    "Blue Fluorescent Protein": "EBFP blue fluorescent protein CDS",
    "BSD":           "blasticidin S deaminase CDS resistance",
    "SNAP tag":      "SNAP tag protein CDS labeling",
    "TurboID":       "TurboID biotin ligase CDS proximity labeling",
    "nSpCas9 (D10A)": "Cas9 D10A nickase CDS Streptococcus pyogenes",
    "sgRNA scaffold (SaCas9)": "SaCas9 tracrRNA scaffold guide RNA",
    "7SK promoter":  "7SK promoter snRNA human",
    "cHS4 insulator": "chicken hypersensitive site 4 HS4 insulator",
    "HS4 core insulator": "HS4 core insulator chicken globin",
    "CAG promoter":  "CAG promoter CMV enhancer chicken actin",
    "CBh promoter":  "CBh promoter compact hybrid CMV beta-actin",
    "TRE promoter":  "TRE promoter tetracycline responsive element",
    "bidirectional TRE promoter": "bidirectional TRE promoter tetracycline",
}

for feat_name, query in FP_SEARCHES.items():
    feat = feat_by_name.get(norm(feat_name), {})
    expected = feat.get("expected_length_bp", [200, 5000])
    seqs = ncbi_search_fetch(query, expected, max_results=3)
    if seqs:
        write_seqs(feat_name, seqs[:2], "ncbi")
    else:
        print(f"  MISS   {feat_name}")
    time.sleep(0.8)

# ── 4. Local GenBank files — length-based extraction ─────────────────────────
print("\n=== Local GenBank files (length-based) ===")

# Map canonical features to local files and expected feature types
LOCAL_TARGETS: dict[str, tuple[str, list[str], list[str]]] = {
    # (canonical_name, [gb_files], [expected_feature_types])
    "pMB1 ori":     (["pUC19.gb", "pET-28a.gb"], ["rep_origin"]),
    "ColE1 ori":    (["pGL3-Basic.gb", "pUC19.gb"], ["rep_origin"]),
    "T3 promoter":  (["pBluescriptKS.gb"], ["promoter"]),
    "AmpR promoter":(["pUC19.gb"], ["promoter"]),
    "lac promoter": (["pUC19.gb", "pGEX-4T-1.gb"], ["promoter"]),
    "tac promoter": (["pGEX-4T-1.gb", "pGEX-6P-1.gb"], ["regulatory"]),
    "SV40 poly(A) signal": (["pGL3-Basic.gb"], ["regulatory"]),
}

for feat_name, (gb_files, ftypes) in LOCAL_TARGETS.items():
    if feat_name in written_count:
        continue  # already written from NCBI
    feat = feat_by_name.get(norm(feat_name), {})
    expected = feat.get("expected_length_bp", [20, 5000])
    for gbf in gb_files:
        path = DEMO_DIR / gbf
        if not path.exists(): continue
        try:
            record = SeqIO.read(str(path), "genbank")
        except Exception:
            continue
        seqs = extract_by_length(record, expected, feature_types=ftypes)
        if seqs:
            write_seqs(feat_name, seqs[:2], f"local_{gbf.replace('.gb','')}")
            break

# ── Summary ────────────────────────────────────────────────────────────────────
print(f"\n{'='*60}")
all_files = list(OUT_DIR.glob("*.fna"))
print(f"Written {len(all_files)} feature files to {OUT_DIR}/")
print(f"Features filled: {sorted(written_count.keys())}")
still_missing = [m for m in [
    "pMB1 ori","ColE1 ori","RK2 oriV","T3 promoter","CAG promoter",
    "CBh promoter","TRE promoter","mTurquoise2","mNeonGreen","iRFP",
    "mEmerald","Clover","mRuby2","BSD","CMV immediate-early promoter",
    "EF1α promoter","CjCas9","nSpCas9 (D10A)","Cas13a",
    "sgRNA scaffold (SaCas9)","3' LTR ΔU3 (HIV-1)","ITR (AAV9)",
    "cHS4 insulator","7SK promoter",
] if m not in written_count]
if still_missing:
    print(f"\nStill missing ({len(still_missing)}): {still_missing}")
print(f"\nNext:")
print(f"  scp {OUT_DIR}/*.fna \\")
print(f"    shandley@login.htcf.wustl.edu:/scratch/sahlab/shandley/helix-feature-db/feature_registry/variants/")
print(f"  ssh htcf 'python3 .../07_export.py'")
