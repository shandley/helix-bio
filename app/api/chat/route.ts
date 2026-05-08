import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export interface SequenceContext {
	name: string;
	seqLen: number;
	topology: string;
	gc: number | null;
	fileFormat: string;
	annotations: { name: string; start: number; end: number; direction: number }[];
	seq: string | null;
}

export interface ChatMessage {
	role: "user" | "assistant";
	content: string;
}

function buildSystemPrompt(ctx: SequenceContext): string {
	const { name, seqLen, topology, gc, fileFormat, annotations, seq } = ctx;

	const featuresBlock =
		annotations.length > 0
			? annotations
				.map(
					(a) =>
						`  • ${a.name}: ${a.start + 1}–${a.end + 1} bp, ${a.direction === 1 ? "forward" : "reverse"} strand`,
				)
				.join("\n")
			: "  (no annotated features)";

	const seqBlock = seq
		? `\nDNA Sequence (${seqLen} bp):\n${seq}\n`
		: `\n(Sequence omitted — ${seqLen.toLocaleString()} bp. Ask the user to paste specific regions if needed.)\n`;

	return `You are an expert molecular biologist embedded in Ori, an open-source web-based molecular biology platform (a SnapGene alternative). You are analyzing a specific DNA construct the user has open in the viewer.

== Current Sequence ==
Name: ${name}
Length: ${seqLen.toLocaleString()} bp
Topology: ${topology}
GC content: ${gc !== null ? gc.toFixed(1) + "%" : "unknown"}
Format: ${fileFormat}

Annotated Features (${annotations.length} total):
${featuresBlock}
${seqBlock}
== Instructions ==
- Be concise and scientifically precise. Avoid filler sentences.
- Focus on information specific to THIS construct, not generic biology.
- When suggesting cloning strategies, refer to actual features and positions in this sequence.
- When evaluating primers, reason against the actual sequence if provided.
- When generating protocols, give specific conditions (temperatures, times, concentrations).
- Format responses with markdown: **bold** for key terms, \`code\` for sequences, numbered lists for protocols.
- Keep most responses to 3–6 sentences unless the user asks for a detailed protocol or full analysis.`;
}

export async function POST(req: NextRequest) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const { messages, context } = (await req.json()) as {
		messages: ChatMessage[];
		context: SequenceContext;
	};

	const result = streamText({
		model: anthropic("claude-sonnet-4-6"),
		system: buildSystemPrompt(context),
		messages,
		maxOutputTokens: 1024,
	});

	return result.toTextStreamResponse();
}
