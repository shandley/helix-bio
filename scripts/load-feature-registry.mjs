#!/usr/bin/env node
/**
 * Load the canonical feature registry into Supabase.
 *
 * Reads:  data/canonical_features.json  (200 features with metadata)
 *         public/data/features.json     (to count sequences per feature)
 * Writes: Supabase public.feature_registry table (upsert)
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/load-feature-registry.mjs
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, "..");

const SUPABASE_URL     = "https://mexubhrfyfeacpnygpig.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY env var");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Load data
const registry = JSON.parse(readFileSync(join(ROOT, "data", "canonical_features.json"), "utf8"));
const features = JSON.parse(readFileSync(join(ROOT, "public", "data", "features.json"), "utf8"));

// Count sequences per canonical name in features.json
const seqCounts = new Map();
for (const f of features) {
  const norm = f.name.toLowerCase().replace(/[+\-]$/, "").trim();
  seqCounts.set(norm, (seqCounts.get(norm) ?? 0) + 1);
}

function norm(s) {
  return (s ?? "").toLowerCase().replace(/[+\-]$/, "").trim();
}

console.log(`Loading ${registry.length} features into Supabase feature_registry...\n`);

let upserted = 0;
let failed   = 0;

for (const feat of registry) {
  const canonName = feat.canonical_name ?? feat._source_name ?? "";
  if (!canonName) continue;

  const expectedLen = feat.expected_length_bp ?? [20, 10000];
  const expectedGC  = feat.expected_gc_fraction ?? feat.expected_gc_range ?? [0.3, 0.7];
  const seqCount    = seqCounts.get(norm(canonName)) ?? 0;

  const record = {
    id:                   canonName,
    canonical_name:       canonName,
    aliases:              feat.aliases ?? [],
    so_term:              feat.so_term ?? null,
    so_label:             feat.so_label ?? null,
    category:             feat.category ?? feat._category_hint ?? null,
    description:          feat.description ?? null,
    mechanism:            feat.mechanism ?? null,
    expression_systems:   feat.expression_systems ?? [],
    expected_length_min:  expectedLen[0] ?? null,
    expected_length_max:  expectedLen[1] ?? null,
    expected_gc_min:      expectedGC[0] ?? null,
    expected_gc_max:      expectedGC[1] ?? null,
    reference_accessions: feat.reference_accessions ?? [],
    reference_plasmids:   feat.reference_plasmids ?? [],
    known_variants:       feat.known_variants ?? [],
    known_misannotations: feat.known_misannotations ?? [],
    notes:                feat.notes ?? null,
    seq_count:            seqCount,
    updated_at:           new Date().toISOString(),
  };

  const { error } = await supabase
    .from("feature_registry")
    .upsert(record, { onConflict: "id" });

  if (error) {
    console.error(`  ✗ ${canonName}: ${error.message}`);
    failed++;
  } else {
    console.log(`  ✓ ${canonName.padEnd(45)} ${seqCount} seqs`);
    upserted++;
  }
}

console.log(`\nDone: ${upserted} upserted, ${failed} failed`);
