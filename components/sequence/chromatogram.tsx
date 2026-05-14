"use client";

import { useEffect, useRef } from "react";
import type { AlignmentResult } from "@/lib/bio/align";

// ── Constants ─────────────────────────────────────────────────────────────────

const PX_PER_BASE = 6; // canvas pixels per base call
const CANVAS_H = 182;
const TRACE_TOP = 6;
const TRACE_BOTTOM = 132;
const BASE_Y = 147;
const QUAL_TOP = 158;
const QUAL_BOTTOM = 176;

const BASE_COLOR: Record<string, string> = {
	A: "#1aaa55",
	C: "#2244bb",
	G: "#222222",
	T: "#cc3333",
	N: "#888888",
};

const TRACE_COLOR: Record<string, string> = {
	A: "rgba(26,170,85,0.70)",
	C: "rgba(34,68,187,0.70)",
	G: "rgba(34,34,34,0.70)",
	T: "rgba(204,51,51,0.70)",
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TraceData {
	A: Int16Array;
	C: Int16Array;
	G: Int16Array;
	T: Int16Array;
}

export interface ChromatogramProps {
	name: string;
	sequence: string;
	quality?: number[];
	peakPositions: number[];
	traceLength: number;
	traces: TraceData;
	result?: AlignmentResult;
	onClose: () => void;
}

// ── Canvas drawing ─────────────────────────────────────────────────────────────

function drawChromatogram(
	ctx: CanvasRenderingContext2D,
	totalWidth: number,
	sequence: string,
	quality: number[] | undefined,
	peakPositions: number[],
	traceLength: number,
	traces: TraceData,
	result: AlignmentResult | undefined,
) {
	ctx.clearRect(0, 0, totalWidth, CANVAS_H);
	ctx.fillStyle = "#faf7f2";
	ctx.fillRect(0, 0, totalWidth, CANVAS_H);

	if (traceLength === 0) return;

	// Normalize: find global max
	let globalMax = 1;
	for (const ch of [traces.A, traces.C, traces.G, traces.T]) {
		for (let i = 0; i < ch.length; i++) {
			if (ch[i]! > globalMax) globalMax = ch[i]!;
		}
	}

	const xFromTrace = (idx: number) => (idx / traceLength) * totalWidth;
	const yFromVal = (val: number) => {
		const n = Math.max(0, val) / globalMax;
		return TRACE_BOTTOM - n * (TRACE_BOTTOM - TRACE_TOP);
	};

	// Build mismatch set in original-read coordinates
	// When strand="-", alignment used rcQuery; flip queryPos back to fwd orientation
	const mismatchSet = new Set<number>();
	if (result?.mismatches) {
		for (const m of result.mismatches) {
			const pos = result.strand === "-" ? sequence.length - 1 - m.queryPos : m.queryPos;
			if (pos >= 0 && pos < sequence.length) mismatchSet.add(pos);
		}
	}

	// Mismatch background highlights
	for (const pos of mismatchSet) {
		const peakIdx = peakPositions[pos] ?? 0;
		const prevPeak = peakPositions[pos - 1] ?? 0;
		const nextPeak = peakPositions[pos + 1] ?? traceLength;
		const x0 = xFromTrace((peakIdx + prevPeak) / 2);
		const x1 = xFromTrace((peakIdx + nextPeak) / 2);
		ctx.fillStyle = "rgba(220,38,38,0.09)";
		ctx.fillRect(x0, 0, x1 - x0, CANVAS_H);
	}

	// Trace polylines — draw each channel
	for (const base of ["G", "A", "T", "C"] as const) {
		const ch = traces[base];
		if (ch.length === 0) continue;

		ctx.beginPath();
		ctx.strokeStyle = TRACE_COLOR[base]!;
		ctx.lineWidth = 1.1;
		ctx.lineJoin = "round";
		ctx.moveTo(xFromTrace(0), yFromVal(ch[0]!));
		for (let i = 1; i < ch.length; i++) {
			ctx.lineTo(xFromTrace(i), yFromVal(ch[i]!));
		}
		ctx.stroke();
	}

	// Divider under traces
	ctx.strokeStyle = "rgba(200,192,184,0.4)";
	ctx.lineWidth = 0.5;
	ctx.beginPath();
	ctx.moveTo(0, TRACE_BOTTOM + 7);
	ctx.lineTo(totalWidth, TRACE_BOTTOM + 7);
	ctx.stroke();

	// Base calls at peak positions
	ctx.font = `bold 9.5px "Courier Prime", "Courier New", monospace`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";

	for (let i = 0; i < sequence.length && i < peakPositions.length; i++) {
		const base = (sequence[i] ?? "N").toUpperCase();
		const traceIdx = peakPositions[i]!;
		const x = xFromTrace(traceIdx);
		const q = quality?.[i] ?? 40;
		const alpha = q >= 30 ? 1.0 : q >= 20 ? 0.7 : 0.4;
		const isMM = mismatchSet.has(i);

		if (isMM) {
			// Red pill behind the letter
			ctx.globalAlpha = 1;
			ctx.fillStyle = "#dc2626";
			ctx.beginPath();
			ctx.roundRect(x - 5, BASE_Y - 6, 10, 12, 2);
			ctx.fill();
			ctx.fillStyle = "#ffffff";
		} else {
			ctx.globalAlpha = alpha;
			ctx.fillStyle = BASE_COLOR[base] ?? "#888888";
		}
		ctx.fillText(base, x, BASE_Y);
		ctx.globalAlpha = 1;

		// Quality bars
		if (quality && !isMM) {
			const barH = Math.min(1, q / 40) * (QUAL_BOTTOM - QUAL_TOP);
			ctx.fillStyle = q >= 30 ? "#1a4731" : q >= 20 ? "#b8933a" : "#a02828";
			ctx.globalAlpha = 0.65;
			ctx.fillRect(x - 1.5, QUAL_BOTTOM - barH, 3, barH);
			ctx.globalAlpha = 1;
		}
	}
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Chromatogram({
	name,
	sequence,
	quality,
	peakPositions,
	traceLength,
	traces,
	result,
	onClose,
}: ChromatogramProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const totalWidth = Math.max(sequence.length * PX_PER_BASE, 400);

	// Draw whenever input changes
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		canvas.width = totalWidth * dpr;
		canvas.height = CANVAS_H * dpr;
		canvas.style.width = `${totalWidth}px`;
		canvas.style.height = `${CANVAS_H}px`;
		ctx.scale(dpr, dpr);

		drawChromatogram(
			ctx,
			totalWidth,
			sequence,
			quality,
			peakPositions,
			traceLength,
			traces,
			result,
		);
	}, [sequence, quality, peakPositions, traceLength, traces, result, totalWidth]);

	// Auto-scroll to aligned region on open
	useEffect(() => {
		if (!containerRef.current || !result) return;
		const scrollX = result.queryStart * PX_PER_BASE;
		containerRef.current.scrollLeft = Math.max(0, scrollX - 80);
	}, [result]);

	const strand = result?.strand;
	const identity = result ? `${(result.identity * 100).toFixed(1)}%` : null;
	const position = result ? `${result.refStart + 1}–${result.refEnd}` : null;
	const mmCount = result?.mismatches.length ?? 0;

	return (
		<div
			style={{
				flexShrink: 0,
				borderTop: "2px solid #c8c0b8",
				background: "#faf7f2",
				height: "220px",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}
		>
			{/* Header bar */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					padding: "5px 14px",
					borderBottom: "1px solid #ddd8ce",
					flexShrink: 0,
					background: "#f5f0e8",
					gap: "10px",
				}}
			>
				<span
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "9px",
						color: "#1c1a16",
						fontWeight: "bold",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
						maxWidth: "160px",
					}}
				>
					{name}
				</span>

				{strand && (
					<span
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "8px",
							color: strand === "+" ? "#1a4731" : "#7c3aed",
						}}
					>
						{strand} strand
					</span>
				)}
				{identity && (
					<span style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#5a5648" }}>
						{identity} identity
					</span>
				)}
				{position && (
					<span style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#9a9284" }}>
						ref {position}
					</span>
				)}
				{mmCount > 0 && (
					<span style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#a02828" }}>
						{mmCount} mismatch{mmCount !== 1 ? "es" : ""}
					</span>
				)}

				<div style={{ flex: 1 }} />

				{/* Base color legend */}
				{(["A", "C", "G", "T"] as const).map((b) => (
					<span
						key={b}
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "8.5px",
							color: BASE_COLOR[b],
							fontWeight: "bold",
							letterSpacing: "0.02em",
						}}
					>
						{b}
					</span>
				))}

				<button
					type="button"
					onClick={onClose}
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "13px",
						lineHeight: 1,
						color: "#9a9284",
						background: "none",
						border: "none",
						cursor: "pointer",
						padding: "0 2px",
						marginLeft: "6px",
					}}
					aria-label="Close chromatogram"
				>
					×
				</button>
			</div>

			{/* Canvas scroll area */}
			<div ref={containerRef} style={{ flex: 1, overflowX: "auto", overflowY: "hidden" }}>
				<canvas ref={canvasRef} style={{ display: "block" }} />
			</div>
		</div>
	);
}
