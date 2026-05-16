"use client";

import { useEffect, useRef } from "react";
import type { ConservationResult, ConsensusPrimer } from "./conservation.worker";

// ── Constants ─────────────────────────────────────────────────────────────────

const MARGIN = { top: 24, right: 12, bottom: 32, left: 12 };
const TRACK_H = 80; // conservation bars
const PRIMER_H = 12; // primer highlight row above bars

// ── Color helpers ─────────────────────────────────────────────────────────────

function conservationColor(v: number): string {
	if (v >= 0.9) return "#1a4731"; // very conserved — dark green
	if (v >= 0.75) return "#2d7a54"; // conserved — medium green
	if (v >= 0.5) return "#b8933a"; // variable — amber
	return "#a02828"; // highly variable — red
}

function fmtPos(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return String(n);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ConservationTrackProps {
	result: ConservationResult;
	selectedIdx: number | null;
	threshold: number; // [0,1] — draw a threshold line
}

export function ConservationTrack({ result, selectedIdx, threshold }: ConservationTrackProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const container = containerRef.current;
		const canvas = canvasRef.current;
		if (!canvas || !container) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const W = container.clientWidth || 600;
		const H = MARGIN.top + PRIMER_H + TRACK_H + MARGIN.bottom;

		const dpr = window.devicePixelRatio || 1;
		canvas.width = W * dpr;
		canvas.height = H * dpr;
		canvas.style.width = `${W}px`;
		canvas.style.height = `${H}px`;
		ctx.scale(dpr, dpr);

		const plotW = W - MARGIN.left - MARGIN.right;
		const { alignmentLen, conservation, primers } = result;

		function xScale(pos: number) {
			return MARGIN.left + (pos / alignmentLen) * plotW;
		}

		const trackTop = MARGIN.top + PRIMER_H;

		// ── Background ────────────────────────────────────────────────────────
		ctx.fillStyle = "#faf7f2";
		ctx.fillRect(0, 0, W, H);

		// ── Primer highlight blocks (above track) ─────────────────────────────
		for (let pi = 0; pi < primers.length; pi++) {
			const p = primers[pi]!;
			const isSelected = selectedIdx === pi;
			const color = p.direction === "fwd" ? "#1a4731" : "#b45309";
			const x1 = xScale(p.alignPos);
			const x2 = xScale(p.alignPos + p.length);
			ctx.fillStyle = isSelected ? color : color + "66";
			ctx.fillRect(x1, MARGIN.top, x2 - x1, PRIMER_H - 1);
		}

		// ── Conservation bars ─────────────────────────────────────────────────
		const pxPerCol = plotW / alignmentLen;

		for (let i = 0; i < alignmentLen; i++) {
			const v = conservation[i] ?? 0;
			const barH = Math.max(1, v * TRACK_H);
			const x = xScale(i);
			const w = Math.max(1, pxPerCol - (pxPerCol > 3 ? 0.5 : 0));
			ctx.fillStyle = conservationColor(v);
			ctx.fillRect(x, trackTop + TRACK_H - barH, w, barH);
		}

		// ── Threshold line ────────────────────────────────────────────────────
		const threshY = trackTop + TRACK_H - threshold * TRACK_H;
		ctx.strokeStyle = "rgba(26,71,49,0.4)";
		ctx.lineWidth = 1;
		ctx.setLineDash([4, 3]);
		ctx.beginPath();
		ctx.moveTo(MARGIN.left, threshY);
		ctx.lineTo(MARGIN.left + plotW, threshY);
		ctx.stroke();
		ctx.setLineDash([]);

		// Threshold label
		ctx.fillStyle = "rgba(26,71,49,0.7)";
		ctx.font = `7px "Courier Prime", monospace`;
		ctx.textAlign = "right";
		ctx.fillText(`${Math.round(threshold * 100)}%`, MARGIN.left - 2, threshY + 3);

		// ── Ruler ─────────────────────────────────────────────────────────────
		const rulerY = trackTop + TRACK_H;
		ctx.strokeStyle = "#b8b0a4";
		ctx.lineWidth = 0.5;
		ctx.beginPath();
		ctx.moveTo(MARGIN.left, rulerY);
		ctx.lineTo(MARGIN.left + plotW, rulerY);
		ctx.stroke();

		const tickInterval =
			alignmentLen <= 500 ? 50 : alignmentLen <= 2000 ? 200 : alignmentLen <= 5000 ? 500 : 1000;

		ctx.fillStyle = "#9a9284";
		ctx.font = `7px "Courier Prime", monospace`;
		ctx.textAlign = "center";
		for (let t = tickInterval; t < alignmentLen; t += tickInterval) {
			const x = xScale(t);
			ctx.beginPath();
			ctx.moveTo(x, rulerY);
			ctx.lineTo(x, rulerY + 3);
			ctx.strokeStyle = "#b8b0a4";
			ctx.stroke();
			ctx.fillText(fmtPos(t), x, rulerY + 11);
		}

		// Start/end labels
		ctx.textAlign = "left";
		ctx.fillText("0", MARGIN.left, rulerY + 11);
		ctx.textAlign = "right";
		ctx.fillText(fmtPos(alignmentLen), MARGIN.left + plotW, rulerY + 11);

		// ── Y-axis labels ─────────────────────────────────────────────────────
		ctx.fillStyle = "#9a9284";
		ctx.textAlign = "right";
		ctx.fillText("100%", MARGIN.left - 2, trackTop + 7);
		ctx.fillText("0%", MARGIN.left - 2, trackTop + TRACK_H);

		// ── Legend ────────────────────────────────────────────────────────────
		const legendItems = [
			{ color: "#1a4731", label: "≥90%" },
			{ color: "#b8933a", label: "50-75%" },
			{ color: "#a02828", label: "<50%" },
		];
		let lx = MARGIN.left;
		ctx.font = `7px "Courier Prime", monospace`;
		for (const item of legendItems) {
			ctx.fillStyle = item.color;
			ctx.fillRect(lx, MARGIN.top - 10, 6, 6);
			ctx.fillStyle = "#9a9284";
			ctx.textAlign = "left";
			ctx.fillText(item.label, lx + 8, MARGIN.top - 4);
			lx += 50;
		}

	}, [result, selectedIdx, threshold]);

	return (
		<div ref={containerRef} style={{ width: "100%" }}>
			<canvas ref={canvasRef} style={{ display: "block" }} />
		</div>
	);
}
