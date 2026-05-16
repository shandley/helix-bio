"use client";

import { useEffect, useRef } from "react";
import type { WalkingPrimer, WalkingResult } from "./walking.worker";

// ── Constants ─────────────────────────────────────────────────────────────────

const MARGIN = { top: 28, right: 16, bottom: 40, left: 16 };
const RULER_H = 20;
const READS_H = 80;     // height of the read band area
const DEPTH_H = 30;     // coverage depth bars
const ARROW_Y = 14;     // y within reads band where primer arrow sits
const GAP_COLOR = "rgba(160,40,40,0.18)";
const FWD_COLOR = "#1a4731";
const REV_COLOR = "#b45309";
const READ_ALPHA = "30";  // hex alpha for read rectangles

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBp(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return String(n);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface CoverageMapProps {
	result: WalkingResult;
	selectedIdx: number | null;
	onSelectPrimer: (i: number) => void;
}

export function CoverageMap({ result, selectedIdx, onSelectPrimer }: CoverageMapProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const container = containerRef.current;
		const canvas = canvasRef.current;
		if (!canvas || !container || result.primers.length === 0) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const W = container.clientWidth || 600;
		const H = MARGIN.top + RULER_H + READS_H + DEPTH_H + MARGIN.bottom;

		const dpr = window.devicePixelRatio || 1;
		canvas.width = W * dpr;
		canvas.height = H * dpr;
		canvas.style.width = `${W}px`;
		canvas.style.height = `${H}px`;
		ctx.scale(dpr, dpr);

		const plotW = W - MARGIN.left - MARGIN.right;
		const { seqLen, primers, gaps } = result;

		function xScale(pos: number) {
			return MARGIN.left + (pos / seqLen) * plotW;
		}

		// ── Background ────────────────────────────────────────────────────────
		ctx.fillStyle = "#faf7f2";
		ctx.fillRect(0, 0, W, H);

		// ── Gap shading ───────────────────────────────────────────────────────
		for (const [gStart, gEnd] of gaps) {
			ctx.fillStyle = GAP_COLOR;
			ctx.fillRect(xScale(gStart), MARGIN.top, xScale(gEnd + 1) - xScale(gStart), RULER_H + READS_H);
		}

		// ── Ruler ─────────────────────────────────────────────────────────────
		// Backbone line
		const rulerY = MARGIN.top + RULER_H;
		ctx.strokeStyle = "#b8b0a4";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(MARGIN.left, rulerY);
		ctx.lineTo(MARGIN.left + plotW, rulerY);
		ctx.stroke();

		// Tick marks and labels
		const tickInterval = seqLen <= 2000 ? 200 : seqLen <= 5000 ? 500 : seqLen <= 10000 ? 1000 : 2000;
		ctx.fillStyle = "#9a9284";
		ctx.font = `7px "Courier Prime", monospace`;
		ctx.textAlign = "center";
		for (let t = 0; t <= seqLen; t += tickInterval) {
			const x = xScale(t);
			ctx.strokeStyle = "#b8b0a4";
			ctx.lineWidth = 0.5;
			ctx.beginPath();
			ctx.moveTo(x, rulerY - 4);
			ctx.lineTo(x, rulerY);
			ctx.stroke();
			if (t > 0 && t < seqLen) ctx.fillText(fmtBp(t), x, rulerY - 6);
		}
		ctx.textAlign = "left";
		ctx.fillText("0", MARGIN.left, rulerY - 6);
		ctx.textAlign = "right";
		ctx.fillText(fmtBp(seqLen), MARGIN.left + plotW, rulerY - 6);

		// ── Reads band ────────────────────────────────────────────────────────
		const bandsTop = rulerY;
		const bandsH = READS_H;

		// Lay out read rows so overlapping reads stack without overlap
		// Simple greedy row assignment
		const rows: { readEnd: number }[] = [];
		const primerRows: number[] = [];

		for (const primer of primers) {
			const isFwd = primer.direction === "fwd";
			const readLeft = isFwd ? xScale(primer.position) : xScale(primer.readEnd);
			const readRight = isFwd ? xScale(primer.readEnd) : xScale(primer.position + primer.seq.length);
			let assignedRow = -1;
			for (let r = 0; r < rows.length; r++) {
				if (rows[r]!.readEnd <= readLeft + 1) {
					assignedRow = r;
					rows[r]!.readEnd = readRight;
					break;
				}
			}
			if (assignedRow === -1) {
				assignedRow = rows.length;
				rows.push({ readEnd: readRight });
			}
			primerRows.push(assignedRow);
		}

		const nRows = Math.max(1, rows.length);
		const rowH = Math.min(16, (bandsH - 6) / nRows);

		for (let pi = 0; pi < primers.length; pi++) {
			const primer = primers[pi]!;
			const row = primerRows[pi]!;
			const rowY = bandsTop + 4 + row * rowH;
			const isFwd = primer.direction === "fwd";
			const color = isFwd ? FWD_COLOR : REV_COLOR;
			const isSelected = selectedIdx === pi;

			// Read rectangle
			const readLeft = xScale(isFwd ? primer.position : primer.readEnd);
			const readRight = xScale(isFwd ? primer.readEnd : primer.position + primer.seq.length);
			ctx.fillStyle = color + READ_ALPHA;
			ctx.fillRect(readLeft, rowY, readRight - readLeft, rowH - 2);

			// Primer block (the actual oligo, darker)
			const primerLeft = xScale(primer.position);
			const primerRight = xScale(primer.position + primer.seq.length);
			ctx.fillStyle = isSelected ? color : color + "99";
			ctx.fillRect(primerLeft, rowY, primerRight - primerLeft, rowH - 2);

			// Direction arrow
			ctx.fillStyle = isSelected ? "#faf7f2" : color;
			const arrowX = isFwd ? primerRight : primerLeft;
			const arrowY2 = rowY + (rowH - 2) / 2;
			const arrowSize = Math.min(4, rowH / 3);
			ctx.beginPath();
			if (isFwd) {
				ctx.moveTo(arrowX, arrowY2);
				ctx.lineTo(arrowX - arrowSize, arrowY2 - arrowSize);
				ctx.lineTo(arrowX - arrowSize, arrowY2 + arrowSize);
			} else {
				ctx.moveTo(arrowX, arrowY2);
				ctx.lineTo(arrowX + arrowSize, arrowY2 - arrowSize);
				ctx.lineTo(arrowX + arrowSize, arrowY2 + arrowSize);
			}
			ctx.closePath();
			ctx.fill();
		}

		// ── Coverage depth bar ────────────────────────────────────────────────
		const depthTop = bandsTop + bandsH + 4;
		const coverage = new Uint16Array(seqLen);
		for (const p of primers) {
			const lo = Math.min(p.position, p.readEnd);
			const hi = Math.max(p.position, p.readEnd);
			for (let j = lo; j < hi; j++) coverage[j]++;
		}
		const maxDepth = Math.max(1, ...coverage);

		for (let j = 0; j < seqLen; j++) {
			const depth = coverage[j] ?? 0;
			if (depth === 0) continue;
			const barH = (depth / maxDepth) * DEPTH_H;
			const x = xScale(j);
			const xNext = xScale(j + 1);
			ctx.fillStyle = depth >= 2 ? FWD_COLOR + "99" : FWD_COLOR + "55";
			ctx.fillRect(x, depthTop + DEPTH_H - barH, Math.max(1, xNext - x), barH);
		}

		// Gap labels
		for (const [gStart, gEnd] of gaps) {
			const gapMid = xScale((gStart + gEnd) / 2);
			const gapLen = gEnd - gStart + 1;
			ctx.fillStyle = "#a02828";
			ctx.font = `bold 7px "Courier Prime", monospace`;
			ctx.textAlign = "center";
			ctx.fillText(`gap ${fmtBp(gapLen)} bp`, gapMid, depthTop + DEPTH_H + 10);
		}

		// Axis labels
		ctx.fillStyle = "#9a9284";
		ctx.font = `7px "Courier Prime", monospace`;
		ctx.textAlign = "right";
		ctx.fillText("depth", MARGIN.left - 2, depthTop + DEPTH_H / 2 + 3);

	}, [result, selectedIdx]);

	// Click to select primer
	function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
		const container = containerRef.current;
		const canvas = canvasRef.current;
		if (!canvas || !container) return;
		const rect = canvas.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const W = container.clientWidth;
		const plotW = W - MARGIN.left - MARGIN.right;
		const { seqLen } = result;
		const clickedPos = Math.round(((mx - MARGIN.left) / plotW) * seqLen);

		// Find primer closest to click
		let closestIdx = -1;
		let closestDist = Infinity;
		for (let i = 0; i < result.primers.length; i++) {
			const p = result.primers[i]!;
			const mid = p.position + p.seq.length / 2;
			const dist = Math.abs(clickedPos - mid);
			if (dist < closestDist) { closestDist = dist; closestIdx = i; }
		}
		if (closestIdx !== -1) onSelectPrimer(closestIdx);
	}

	return (
		<div ref={containerRef} style={{ width: "100%" }}>
			<canvas
				ref={canvasRef}
				style={{ display: "block", cursor: "pointer" }}
				onClick={handleClick}
			/>
		</div>
	);
}
