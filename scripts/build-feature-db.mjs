#!/usr/bin/env node
/**
 * Build the compact annotation feature database from canonical_features.fna.
 *
 * Reads: lib/bio/canonical_features.fna  (1,472 sequences from SnapGene library)
 * Writes: public/data/features.json      (array of {name, type, seq, len})
 *
 * The JSON is loaded by the annotation Web Worker at runtime.
 * Typical output: ~1.2 MB uncompressed; the worker builds the k-mer index
 * in memory on first load (~100–200 ms) and caches it for subsequent queries.
 *
 * Run: node scripts/build-feature-db.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");

const inPath = join(ROOT, "lib", "bio", "canonical_features.fna");
const outDir = join(ROOT, "public", "data");
const outPath = join(outDir, "features.json");

mkdirSync(outDir, { recursive: true });

// Parse FASTA — header: >id|name|type|len
const raw = readFileSync(inPath, "utf8");
const lines = raw.split("\n");

const features = [];
let name = null, type = null, seqParts = [];

function flush() {
  if (name === null) return;
  const seq = seqParts.join("").toUpperCase();
  if (seq.length > 0) features.push({ name, type, seq });
  seqParts = [];
}

for (const line of lines) {
  if (line.startsWith(">")) {
    flush();
    const parts = line.slice(1).split("|");
    // Support two header formats:
    //   Old (SnapGene corpus): >id|name|type|len   (4 parts, name at [1])
    //   New (registry export): >name|type|len       (3 parts, name at [0])
    const has4 = parts.length >= 4;
    name = (has4 ? parts[1] : parts[0]).replace(/_/g, " ").trim();
    type = (has4 ? parts[2] : parts[1]).trim();
  } else {
    seqParts.push(line.trim());
  }
}
flush();

// Filter: drop sequences <20 bp (too short to anchor reliably)
const filtered = features.filter(f => f.seq.length >= 20);

// Sort by name for reproducible output
filtered.sort((a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type));

writeFileSync(outPath, JSON.stringify(filtered));

const totalBp = filtered.reduce((s, f) => s + f.seq.length, 0);
console.log(`Features: ${filtered.length}`);
console.log(`Total bp: ${totalBp.toLocaleString()}`);
console.log(`Output:   ${outPath} (${(Buffer.byteLength(JSON.stringify(filtered)) / 1024).toFixed(0)} KB)`);
