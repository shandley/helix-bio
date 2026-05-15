import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { formatCatalogForPrompt } from "@/lib/bio/parts-catalog";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export interface DesignConstructRequest {
  insertSeq: string;
  insertName: string;
  goal: string;
}

// Zod schema Claude must conform to
const constructDesignSchema = z.object({
  constructName: z
    .string()
    .describe("Short plasmid name, e.g. pOri-mCherry-T7 or pOri-GFP-tac"),
  organism: z
    .enum(["ecoli"])
    .describe("Target organism for expression"),
  explanation: z
    .string()
    .describe("2-3 sentences explaining the part choices and why they suit the user's goal"),
  warnings: z
    .array(z.string())
    .describe("Any concerns about the design — strain requirements, potential issues, notes"),
  parts: z
    .array(
      z.object({
        partId: z
          .string()
          .describe('Part ID from the catalog, or "INSERT" to place the user\'s sequence'),
        direction: z
          .union([z.literal(1), z.literal(-1)])
          .describe("1 = forward strand, -1 = reverse strand (reverse complement)"),
      }),
    )
    .describe(
      'Ordered list of parts for the circular construct. Must include "INSERT" exactly once. Standard order: marker → ori → promoter → rbs → INSERT → terminator.',
    ),
});

const SYSTEM_PROMPT = `You are an expert molecular biologist designing E. coli expression constructs. Given a DNA insert (gene) and the user's expression goal, select the most appropriate regulatory elements from the provided parts catalog to build a functional circular expression plasmid.

Selection rules:
1. Always include exactly one promoter, one RBS, one terminator, one origin of replication, and one resistance marker.
2. Always place "INSERT" in the parts array exactly once, at the correct position between the RBS and terminator.
3. Standard part order for a circular plasmid: marker → ori → promoter → rbs → INSERT → terminator. This puts the marker and ori "behind" the expression cassette in a logical reading direction.
4. All expression cassette parts (promoter, rbs, INSERT, terminator) should use direction: 1. Marker and ori typically use direction: 1 as well.
5. T7 promoter requires T7 RNA polymerase — only select it if the user mentions BL21(DE3) or T7-compatible strain, or if they want maximum expression without strain concern (and add a warning).
6. Match promoter to goal: IPTG/high-expression → tac or T7; arabinose/tight-control → araBAD; constitutive → J23 series.
7. Default resistance marker: KanR (stable in culture). Use AmpR only if user specifies it.
8. Default origin: ColE1 (high copy) for standard protein expression. p15A for toxic proteins or when lower copy is needed.
9. Be specific in warnings: strain requirements, potential toxicity, satellite colony risks.`;

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

  const catalogContext = formatCatalogForPrompt();

  const userMessage = `${catalogContext}

== USER INSERT ==
Name: ${insertName}
Length: ${insertSeq.length} bp
Sequence (first 60bp): ${insertSeq.slice(0, 60)}${insertSeq.length > 60 ? "..." : ""}

== EXPRESSION GOAL ==
${goal}

Design a complete E. coli expression construct that achieves this goal. Select parts only from the catalog above.`;

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: constructDesignSchema,
    system: SYSTEM_PROMPT,
    prompt: userMessage,
  });

  return new Response(JSON.stringify(object), {
    headers: { "Content-Type": "application/json" },
  });
}
