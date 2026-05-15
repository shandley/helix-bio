import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

interface PrimerData {
  seq: string;
  tm: number;
  gc: number;
  len: number;
  hairpinDG: number;
  selfDimerDG: number;
  accessibility: number;
  start: number;
}

export interface DiagnosePCRRequest {
  mode: "pcr" | "qpcr" | "assembly";
  tmTarget: number;
  fwd: PrimerData;
  rev: PrimerData;
  productSize: number;
  tmDiff: number;
  heteroDimerDG: number;
  context: {
    sequenceName: string;
    seqLen: number;
    topology: string;
    regionLen: number;
  };
}

const SYSTEM_PROMPT = `You are a PCR troubleshooting expert embedded in Ori, a molecular biology design platform. You are given thermodynamic metrics for a primer pair computed by the primd design engine. Diagnose any issues and give the researcher specific, actionable advice.

Thresholds (values beyond these are flagged ⚠):
- Tm deviation from target: >4°C = off target
- ΔTm between primers: >2°C = unequal annealing
- GC content: <40% or >65% = efficiency problems
- Hairpin ΔG: <-1.0 kcal/mol = moderate; <-3.0 = severe
- Self-dimer ΔG: <-3.0 kcal/mol = problematic
- Hetero-dimer ΔG: <-3.0 kcal/mol = primer pair cross-hybridizes
- Template accessibility: <40% = binding site structured (major efficiency drop); 40–75% = partially structured (moderate)

Severity ranking: template structure > hetero-dimer > severe hairpin > self-dimer > large ΔTm > Tm mismatch > GC

Instructions:
- Identify the 1–3 most significant issues by severity. If all metrics are within acceptable ranges, say so briefly and recommend a standard protocol.
- Be specific: cite the actual values (e.g. "your reverse primer binds a site that is only 32% single-stranded, well below the 40% threshold").
- For each issue, give a concrete fix: temperature (give °C values), additives (5% DMSO, 1M betaine), touchdown PCR protocol details, or redesign advice pointing to the specific property to change.
- Target 120–180 words total.
- End with exactly one specific next step.
- Write in plain prose. No markdown headers (##), no bullet lists, no code blocks. Bold key terms with **text** only.
- No filler sentences. No restatement of the verdict.`;

function buildContext(body: DiagnosePCRRequest): string {
	const { mode, fwd, rev, productSize, tmDiff, heteroDimerDG, tmTarget, context } = body;
	const { sequenceName, seqLen, topology, regionLen } = context;

	const lines: string[] = [
		"== PCR DESIGN ==",
		`Sequence: ${sequenceName} (${seqLen.toLocaleString()} bp, ${topology})`,
		`Mode: ${mode.toUpperCase()} | Target region: ${regionLen} bp | Tm target: ${tmTarget}°C`,
	];

	const fmtPrimer = (label: string, p: PrimerData) => {
		const delta = p.tm - tmTarget;
		const gcPct = Math.round(p.gc * 100);
		const accPct = Math.round(p.accessibility * 100);
		lines.push(
			"",
			`${label} (position ${p.start + 1}):`,
			`  Sequence:    ${p.seq} (${p.len} bp)`,
			`  Tm:          ${p.tm.toFixed(1)}°C (Δ = ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}°C from target)${Math.abs(delta) > 4 ? " ⚠ OFF TARGET" : ""}`,
			`  GC:          ${gcPct}%${gcPct < 40 || gcPct > 65 ? " ⚠ OUT OF RANGE (40–65%)" : ""}`,
			`  Hairpin:     ΔG = ${p.hairpinDG.toFixed(1)} kcal/mol${p.hairpinDG < -3.0 ? " ⚠ SEVERE" : p.hairpinDG < -1.0 ? " ⚠ MODERATE" : " OK"}`,
			`  Self-dimer:  ΔG = ${p.selfDimerDG.toFixed(1)} kcal/mol${p.selfDimerDG < -3.0 ? " ⚠ PROBLEMATIC" : " OK"}`,
			`  Accessibility: ${accPct}% ${p.accessibility < 0.4 ? "⚠ STRUCTURED — major efficiency drop expected" : p.accessibility < 0.75 ? "~ PARTIALLY STRUCTURED" : "OK — site is open"}`,
		);
	};

	fmtPrimer("Forward primer (→)", fwd);
	fmtPrimer("Reverse primer (←)", rev);

	lines.push(
		"",
		"Pair metrics:",
		`  ΔTm (fwd vs rev): ${tmDiff.toFixed(1)}°C${tmDiff > 2 ? " ⚠ HIGH" : ""}`,
		`  Hetero-dimer:     ΔG = ${heteroDimerDG.toFixed(1)} kcal/mol${heteroDimerDG < -3.0 ? " ⚠ PROBLEMATIC" : " OK"}`,
		`  Expected product: ${productSize} bp`,
	);

	if (mode === "qpcr") {
		lines.push("  Note: qPCR amplicons should be 70–200 bp and have minimal secondary structure.");
	}

	return lines.join("\n");
}

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

	const body = (await req.json()) as DiagnosePCRRequest;
	const promptContext = buildContext(body);

	const stream = streamText({
		model: anthropic("claude-haiku-4-5"),
		system: SYSTEM_PROMPT,
		messages: [{ role: "user", content: promptContext }],
		maxOutputTokens: 512,
	});

	return stream.toTextStreamResponse();
}
