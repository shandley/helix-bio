import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { formatCatalogForPrompt } from "@/lib/bio/parts-catalog";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export interface DesignConstructRequest {
  /** User-provided gene sequence. Empty string = Mode C (Claude picks CDS from catalog). */
  insertSeq: string;
  insertName: string;
  goal: string;
}

const constructDesignSchema = z.object({
  constructName: z
    .string()
    .describe('Short plasmid name, e.g. pOri-EGFP-CMV or pOri-GAL1-GFP or pOri-mCherry-tac'),
  organism: z.enum(["ecoli", "mammalian", "yeast"]).describe("Target expression organism"),
  explanation: z
    .string()
    .describe("2-3 sentences explaining the part choices and why they suit the goal"),
  warnings: z
    .array(z.string())
    .describe("Biological concerns: strain requirements, toxicity risks, size limitations, recommended additions (e.g. 6xHis tag for purification)"),
  parts: z
    .array(
      z.object({
        partId: z
          .string()
          .describe(
            'Part ID from the catalog, "INSERT" to place a user-provided sequence, or a catalog CDS id (e.g. "egfp_cds") to pick from the library',
          ),
        direction: z
          .union([z.literal(1), z.literal(-1)])
          .describe("1 = forward strand, -1 = reverse complement"),
      }),
    )
    .describe(
      "Ordered parts for the circular construct. Standard order: marker → ori → promoter → rbs → [CDS] → terminator.",
    ),
});

const SYSTEM_PROMPT = `You are an expert molecular biologist designing expression constructs for E. coli, mammalian cells, or yeast. Given a goal (and optionally a gene sequence), select the most appropriate parts from the catalog to build a functional circular plasmid.

=== ORGANISM DETECTION ===
Infer target organism from the goal:
- Mentions "mammalian", "HEK293", "CHO", "COS", "HeLa", "293T", "lentiviral", "AAV", "transfection", "human cells" → organism: "mammalian"
- Mentions "yeast", "S. cerevisiae", "Saccharomyces", "galactose", "SC-Leu", "pRS" → organism: "yeast"
- All other goals → organism: "ecoli"

=== E. COLI RULES ===
Include: promoter + rbs + [CDS] + terminator + ori + marker. All direction: 1.
Order: marker → ori → promoter → rbs → [CDS] → terminator.
- Promoter: IPTG → tac or T7; arabinose → araBAD; constitutive → J23119.
- T7 requires BL21(DE3) — always warn. Default: KanR + ColE1.

=== MAMMALIAN RULES ===
Mammalian vectors need E. coli backbone for propagation. Include ALL of:
[mammalian_marker] → colE1_ori → ampR_marker → [mammalian_promoter] → kozak → [CDS] → [polyA_signal]
- Promoter: cmv_promoter (strong) or sv40_promoter (moderate).
- kozak MUST be between promoter and CDS — required for mammalian translation initiation.
- PolyA: bgh_polya (for gene of interest) or sv40_polya (for selection marker cassette).
- Marker: puroR_mammalian (fast, 2-5 days) or neoR_mammalian (G418, 2-3 weeks).
- DO NOT use T7, tac, araBAD, J23, B0034, or any prokaryotic part for mammalian expression.
- colE1_ori + ampR_marker are required even in mammalian vectors (for E. coli propagation).

=== YEAST RULES ===
Yeast vectors also need E. coli backbone. Include:
[yeast_marker] → colE1_ori → ampR_marker → [yeast_promoter] → [CDS] → [yeast_terminator] → [yeast_ori]
- Promoter: gal1_promoter (galactose-inducible) or tef1_promoter/adh1_promoter (constitutive).
- Terminator: cyc1_terminator (standard) or adh1_terminator.
- Ori: 2mu_ori (high-copy) or cen_ars (low-copy, stable).
- Marker: leu2_marker or trp1_marker.
- DO NOT use B0034 or any prokaryotic RBS — yeast uses cap-dependent translation (no RBS needed).

=== CDS SELECTION ===
MODE A (user provided sequence): Use {partId: "INSERT"} for the CDS position.
MODE C (no sequence): Pick catalog CDS: green → egfp_cds; yellow → mvenus_cds; red → tdtomato_cds; luciferase → luc_cds; dual-reporter → rluc_cds; purification → gst_cds; CRISPR/AAV → cjcas9_cds; standard CRISPR → spcas9_cds. No match → use INSERT + warn.

=== WARNINGS ===
- T7: requires BL21(DE3); tac: requires lacI strain; puroR: 1-10 μg/mL; neoR: 400-800 μg/mL G418
- LEU2: use leu2Δ strain, SC-Leu; TRP1: use trp1Δ strain, SC-Trp
- Large CDS (>3 kb): verify synthesis vendor; purification: suggest 6xHis/GST/FLAG tag`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { insertSeq, insertName, goal } = (await req.json()) as DesignConstructRequest;
  const hasInsert = insertSeq.trim().length > 0;

  const catalogContext = formatCatalogForPrompt();

  const modeBlock = hasInsert
    ? `== USER INSERT (Mode A) ==\nName: ${insertName}\nLength: ${insertSeq.length} bp\nFirst 60 bp: ${insertSeq.slice(0, 60)}${insertSeq.length > 60 ? "..." : ""}\nInstruction: Use {partId: "INSERT"} for this gene. Do NOT substitute a catalog CDS.`
    : `== NO INSERT PROVIDED (Mode C) ==\nInstruction: The user has not provided a sequence. Select an appropriate catalog CDS based on the goal. Use its part ID directly (e.g. "egfp_cds"). Do NOT use "INSERT".`;

  const userMessage = `${catalogContext}\n\n${modeBlock}\n\n== EXPRESSION GOAL ==\n${goal}`;

  // providerOptions.anthropic.structuredOutputMode: "outputFormat" enables native
  // Anthropic structured outputs (compiled grammar / constrained sampling) instead
  // of the tool-use JSON fallback. Schemas are cached for 24h on Anthropic's side.
  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: constructDesignSchema,
    system: SYSTEM_PROMPT,
    prompt: userMessage,
    providerOptions: {
      anthropic: { structuredOutputMode: "outputFormat" },
    },
  });

  return new Response(JSON.stringify(object), {
    headers: { "Content-Type": "application/json" },
  });
}
