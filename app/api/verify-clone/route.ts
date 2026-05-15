import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import type { NextRequest } from "next/server";
import type { AnnotationSummary, VerificationResult } from "@/lib/bio/verify-clone";
import { buildVerificationPromptContext } from "@/lib/bio/verify-clone";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export interface VerifyCloneRequest {
  result: VerificationResult;
  context: {
    name: string;
    seqLen: number;
    topology: "circular" | "linear";
    annotations: AnnotationSummary[];
  };
}

const SYSTEM_PROMPT = `You are a molecular biology expert embedded in Ori, a DNA analysis platform. A clone verification algorithm has already determined the verdict for a Sanger sequencing result. Your job is to explain that verdict clearly to the researcher — you are NOT recomputing it.

Rules:
- Never contradict the verdict produced by the algorithm. If it says CONFIRMED, explain why it passed. If it says FAILED, explain why it failed.
- Reference specific feature names, codon numbers, and positions from the data provided. Do not speak in generalities.
- Use plain prose. No headers, no bullet lists. Write as you would in a lab meeting.
- Target 120–200 words. End with exactly one specific, actionable next step.

Guidance by verdict:
- CONFIRMED: state what was verified (which features, how many reads, identity). Note any unsequenced regions the researcher should be aware of even though the clone passed. Recommend proceeding.
- MUTATION_DETECTED: name the specific mutation and feature. Reason briefly about whether it is likely to affect protein function (e.g. a conservative substitution in a non-critical domain vs. an active-site residue). Always recommend picking additional colonies and re-sequencing.
- FAILED (frameshift or nonsense): explain concretely what the consequence is — a frameshift destroys all downstream codons, a premature stop truncates the protein. Do not soften this. Recommend re-cloning: picking more colonies, or redesigning primers if the error is systematic.
- INCOMPLETE: specify exactly which annotated feature was not covered, estimate what percentage was sequenced, and name the direction of sequencing needed (e.g. "sequence from the opposite end with an M13-rev primer to cover the 3' end of the CDS").

Do not add filler like "Great question!" or "I hope this helps." Do not repeat the verdict word as a heading.`;

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

	const body = (await req.json()) as VerifyCloneRequest;
	const { result, context } = body;

	const promptContext = buildVerificationPromptContext(
		result,
		context.name,
		context.seqLen,
		context.topology,
		context.annotations,
	);

	const stream = streamText({
		model: anthropic("claude-haiku-4-5"),
		system: SYSTEM_PROMPT,
		messages: [{ role: "user", content: promptContext }],
		maxOutputTokens: 512,
	});

	return stream.toTextStreamResponse();
}
