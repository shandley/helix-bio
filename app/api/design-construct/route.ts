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
    .describe("Short plasmid name, e.g. pOri-EGFP-tac or pOri-SpCas9-T7"),
  organism: z.enum(["ecoli"]).describe("Target organism for expression"),
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

const SYSTEM_PROMPT = `You are an expert molecular biologist designing E. coli expression constructs. Given an expression goal (and optionally a user-provided gene sequence), select the most appropriate parts from the catalog to build a functional circular plasmid.

Part selection rules:
1. Always include: one promoter, one RBS, one terminator, one origin of replication, one resistance marker, and one coding sequence (either INSERT or a catalog CDS).
2. Standard circular order: marker → ori → promoter → rbs → [CDS] → terminator.
3. All expression cassette parts (promoter, rbs, CDS, terminator) use direction: 1. Marker and ori also use direction: 1.
4. T7 promoter requires T7 RNA polymerase — only select it when the user mentions BL21(DE3) or T7-compatible strain, or explicitly requests maximum yield (add a warning about strain requirement).
5. Match promoter to goal: IPTG/high-yield → tac or T7; arabinose/tight-control → araBAD; constitutive → J23119.
6. Default marker: KanR. Default origin: ColE1.

CDS selection — two modes:
MODE A (user provided a sequence): Use {partId: "INSERT"} in the parts array for the CDS position. Do NOT substitute a catalog CDS — use exactly what the user gave.
MODE C (no sequence provided): Select a catalog CDS by its part ID based on the goal. Match by name/function (GFP/green → egfp_cds; yellow → mvenus_cds; red fluorescence → tdtomato_cds; luciferase reporter → luc_cds; dual reporter → rluc_cds; purification tag → gst_cds; CRISPR compact/AAV → cjcas9_cds; standard CRISPR → spcas9_cds). If no catalog CDS matches, use INSERT and add a warning that the user must provide the sequence.

Warnings to include when relevant:
- T7 promoter: "Requires BL21(DE3) or T7-compatible strain"
- Protein purification: "Consider adding a 6xHis or GST tag to your insert if not already present"
- Large CDS (>3 kb): "Large insert — verify your synthesis vendor can produce this length"
- ColE1 + highly expressed protein: "High-copy ColE1 may increase metabolic burden; switch to p15A if growth is impaired"
- lacI requirement for tac promoter: "Use a lacI-expressing strain (DH5α, BL21, TOP10) or add a lacI gene for tight IPTG control"`;

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
