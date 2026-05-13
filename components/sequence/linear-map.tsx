"use client";

/**
 * LinearMap — overview panel for linear sequences.
 *
 * Renders a fixed-height canvas showing the full construct at a glance:
 *   - Sequence ruler with tick marks and position labels
 *   - Feature arrows/blocks scaled to fill the full width
 *   - Multi-track layout to avoid overlapping features
 *   - Click anywhere to jump to that position (fires onPositionSelect)
 *
 * This gives linear sequences the same at-a-glance spatial overview that
 * the circular diagram provides for circular sequences.
 */

import { useEffect, useRef, useCallback } from "react";
import type { BioAnnotation } from "@/lib/bio/parse-genbank";

interface LinearMapProps {
	seq: string;
	annotations: BioAnnotation[];
	onPositionSelect?: (pos: number) => void;
}

// Track assignment: pack features into the fewest non-overlapping tracks
function assignTracks(annotations: BioAnnotation[]): Map<BioAnnotation, number> {
	const sorted = [...annotations].sort((a, b) => a.start - b.start);
	const trackEnds: number[] = [];
	const map = new Map<BioAnnotation, number>();
	for (const ann of sorted) {
		let track = trackEnds.findIndex((end) => end <= ann.start);
		if (track === -1) {
			track = trackEnds.length;
			trackEnds.push(0);
		}
		trackEnds[track] = ann.end;
		map.set(ann, track);
	}
	return map;
}

const RULER_H   = 22;   // ruler strip height
const TRACK_H   = 18;   // height of each annotation track
const TRACK_GAP = 3;    // gap between tracks
const ARROW_W   = 8;    // arrowhead width
const MIN_LABEL = 30;   // min feature px-width to show label
const FONT      = "9px 'Courier Prime', monospace";
const FONT_BOLD = "bold 9px 'Courier Prime', monospace";

export function LinearMap({ seq, annotations, onPositionSelect }: LinearMapProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const seqLen = seq.length;

	// Filter out very short features unlikely to be useful in the overview
	const visible = annotations.filter((a) => a.end - a.start >= 5);
	const tracks  = assignTracks(visible);
	const nTracks = visible.length > 0 ? Math.max(...[...tracks.values()]) + 1 : 1;
	const height  = RULER_H + nTracks * (TRACK_H + TRACK_GAP) + 8;

	const draw = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas || seqLen === 0) return;
		const W = canvas.width;
		const H = canvas.height;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const toX = (pos: number) => (pos / seqLen) * W;

		// Background
		ctx.fillStyle = "#f5f0e8";
		ctx.fillRect(0, 0, W, H);

		// ── Ruler ─────────────────────────────────────────────────────────────
		ctx.fillStyle = "#ede8df";
		ctx.fillRect(0, 0, W, RULER_H);

		// Choose tick interval based on visible width
		const minTickPx = 50;
		const rawInterval = (seqLen / W) * minTickPx;
		const magnitudes = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
		const interval = magnitudes.find((m) => m >= rawInterval) ?? magnitudes[magnitudes.length - 1]!;

		ctx.strokeStyle = "#b8b0a4";
		ctx.lineWidth = 1;
		ctx.fillStyle = "#9a9284";
		ctx.font = FONT;
		ctx.textAlign = "center";

		for (let pos = 0; pos <= seqLen; pos += interval) {
			const x = toX(pos);
			const isMajor = pos % (interval * 5) === 0 || interval >= 1000;
			ctx.beginPath();
			ctx.moveTo(x, isMajor ? 6 : 10);
			ctx.lineTo(x, RULER_H);
			ctx.strokeStyle = isMajor ? "#9a9284" : "#c8c0b8";
			ctx.stroke();
			if (isMajor) {
				const label = pos >= 1000 ? `${(pos / 1000).toFixed(pos % 1000 === 0 ? 0 : 1)}k` : String(pos);
				ctx.fillText(label, x, 8);
			}
		}

		// Baseline
		ctx.strokeStyle = "#c8c0b8";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(0, RULER_H);
		ctx.lineTo(W, RULER_H);
		ctx.stroke();

		// ── Feature arrows ─────────────────────────────────────────────────────
		ctx.font = FONT;

		for (const ann of visible) {
			const track = tracks.get(ann) ?? 0;
			const x1 = toX(ann.start);
			const x2 = toX(ann.end);
			const pw  = x2 - x1;                         // pixel width
			const y0  = RULER_H + track * (TRACK_H + TRACK_GAP) + TRACK_GAP;
			const yMid = y0 + TRACK_H / 2;
			const dir  = ann.direction;

			// Choose arrow shape
			const color = ann.color ?? "#6b7280";
			ctx.fillStyle = color;
			ctx.strokeStyle = color;

			if (pw < 4) {
				// Too narrow for arrow — just a tick mark
				ctx.fillRect(x1, y0 + 2, Math.max(2, pw), TRACK_H - 4);
				continue;
			}

			// Arrow body + head
			ctx.beginPath();
			const arrowW = Math.min(ARROW_W, pw * 0.4);

			if (dir === 1) {
				// Forward arrow →
				ctx.moveTo(x1, y0 + 3);
				ctx.lineTo(x2 - arrowW, y0 + 3);
				ctx.lineTo(x2, yMid);
				ctx.lineTo(x2 - arrowW, y0 + TRACK_H - 3);
				ctx.lineTo(x1, y0 + TRACK_H - 3);
			} else if (dir === -1) {
				// Reverse arrow ←
				ctx.moveTo(x2, y0 + 3);
				ctx.lineTo(x1 + arrowW, y0 + 3);
				ctx.lineTo(x1, yMid);
				ctx.lineTo(x1 + arrowW, y0 + TRACK_H - 3);
				ctx.lineTo(x2, y0 + TRACK_H - 3);
			} else {
				// No direction — rectangle
				ctx.rect(x1, y0 + 3, pw, TRACK_H - 6);
			}
			ctx.closePath();

			// Semi-transparent fill + opaque stroke
			ctx.globalAlpha = 0.85;
			ctx.fill();
			ctx.globalAlpha = 1;
			ctx.lineWidth = 0.5;
			ctx.stroke();

			// Label — only if the feature is wide enough
			if (pw >= MIN_LABEL) {
				ctx.fillStyle = "#fff";
				ctx.font = pw >= 60 ? FONT_BOLD : FONT;
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				const label = ann.name.length > 20 ? ann.name.slice(0, 18) + "…" : ann.name;
				// Clip text to feature bounds
				ctx.save();
				ctx.beginPath();
				ctx.rect(x1 + 2, y0, pw - 4, TRACK_H);
				ctx.clip();
				ctx.fillText(label, x1 + pw / 2, yMid + 1);
				ctx.restore();
			}
		}

		// Border
		ctx.strokeStyle = "#ddd8ce";
		ctx.lineWidth = 1;
		ctx.strokeRect(0, 0, W, H);
	}, [seqLen, visible, tracks]);

	// Draw on mount and resize
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ro = new ResizeObserver(() => {
			canvas.width  = canvas.offsetWidth;
			canvas.height = canvas.offsetHeight;
			draw();
		});
		ro.observe(canvas);
		return () => ro.disconnect();
	}, [draw]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		canvas.width  = canvas.offsetWidth;
		canvas.height = canvas.offsetHeight;
		draw();
	}, [draw]);

	const handleClick = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			if (!onPositionSelect || seqLen === 0) return;
			const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
			const x = e.clientX - rect.left;
			const pos = Math.round((x / rect.width) * seqLen);
			onPositionSelect(Math.max(0, Math.min(seqLen, pos)));
		},
		[onPositionSelect, seqLen],
	);

	return (
		<canvas
			ref={canvasRef}
			onClick={handleClick}
			title="Click to jump to position"
			style={{
				width: "100%",
				height: `${height}px`,
				display: "block",
				cursor: "crosshair",
				flexShrink: 0,
			}}
		/>
	);
}
