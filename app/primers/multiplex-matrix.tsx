"use client";

import { useEffect, useRef, useState } from "react";
import type { MultiplexResult, CompatibilityStatus } from "./multiplex.worker";

// ── Colors ────────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<CompatibilityStatus, string> = {
	ok: "#1a4731",
	warn: "#b8933a",
	fail: "#a02828",
};

const STATUS_BG: Record<CompatibilityStatus, string> = {
	ok: "rgba(26,71,49,0.12)",
	warn: "rgba(184,147,58,0.14)",
	fail: "rgba(160,40,40,0.14)",
};

// ── Component ─────────────────────────────────────────────────────────────────

interface MultiplexMatrixProps {
	result: MultiplexResult;
}

export function MultiplexMatrix({ result }: MultiplexMatrixProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [hovered, setHovered] = useState<{ i: number; j: number } | null>(null);
	const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

	const { pairs, matrix, compatibleSet } = result;
	const N = pairs.length;

	useEffect(() => {
		const container = containerRef.current;
		const canvas = canvasRef.current;
		if (!canvas || !container || N === 0) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Cell size: fit N cells in available width, min 36px max 72px
		const availW = container.clientWidth - 80; // leave room for row labels
		const CELL = Math.max(36, Math.min(72, Math.floor(availW / N)));
		const LABEL_W = 80;
		const HEADER_H = LABEL_W; // rotated column labels use same space
		const W = LABEL_W + N * CELL;
		const H = HEADER_H + N * CELL;

		const dpr = window.devicePixelRatio || 1;
		canvas.width = W * dpr;
		canvas.height = H * dpr;
		canvas.style.width = `${W}px`;
		canvas.style.height = `${H}px`;
		ctx.scale(dpr, dpr);

		ctx.fillStyle = "#faf7f2";
		ctx.fillRect(0, 0, W, H);

		// Column headers (rotated target names)
		for (let j = 0; j < N; j++) {
			const cx = LABEL_W + j * CELL + CELL / 2;
			ctx.save();
			ctx.translate(cx, HEADER_H - 6);
			ctx.rotate(-Math.PI / 4);
			ctx.textAlign = "left";
			ctx.fillStyle = "#5a5648";
			ctx.font = `9px "Courier Prime", monospace`;
			const label = pairs[j]?.targetName ?? `T${j + 1}`;
			ctx.fillText(label.length > 12 ? label.slice(0, 11) + "…" : label, 0, 0);
			ctx.restore();
		}

		// Row labels + cells
		for (let i = 0; i < N; i++) {
			const cy = HEADER_H + i * CELL + CELL / 2;

			// Row label
			ctx.fillStyle = "#5a5648";
			ctx.font = `9px "Courier Prime", monospace`;
			ctx.textAlign = "right";
			const rowLabel = pairs[i]?.targetName ?? `T${i + 1}`;
			ctx.fillText(rowLabel.length > 10 ? rowLabel.slice(0, 9) + "…" : rowLabel, LABEL_W - 4, cy + 3);

			for (let j = 0; j < N; j++) {
				const cx = LABEL_W + j * CELL;
				const cy2 = HEADER_H + i * CELL;
				const cell = matrix[i]?.[j];
				if (!cell) continue;

				const isHovered = hovered?.i === i && hovered?.j === j;
				const inCompatSet = compatibleSet.includes(i) && compatibleSet.includes(j);

				if (i === j) {
					// Diagonal — target name abbreviated
					ctx.fillStyle = "#ece6d8";
					ctx.fillRect(cx + 1, cy2 + 1, CELL - 2, CELL - 2);
					ctx.fillStyle = "#9a9284";
					ctx.font = `bold 8px "Courier Prime", monospace`;
					ctx.textAlign = "center";
					const diag = (pairs[i]?.targetName ?? `T${i + 1}`).slice(0, 4);
					ctx.fillText(diag, cx + CELL / 2, cy2 + CELL / 2 + 3);
				} else {
					const color = STATUS_COLOR[cell.status];
					const bgAlpha = isHovered ? 0.3 : inCompatSet && cell.status === "ok" ? 0.25 : 0.14;
					// Cell background
					ctx.fillStyle = color + Math.round(bgAlpha * 255).toString(16).padStart(2, "0");
					ctx.fillRect(cx + 1, cy2 + 1, CELL - 2, CELL - 2);

					// Status icon
					ctx.fillStyle = color;
					ctx.font = `bold ${CELL > 48 ? 14 : 11}px sans-serif`;
					ctx.textAlign = "center";
					const icon = cell.status === "ok" ? "✓" : cell.status === "warn" ? "~" : "✗";
					ctx.fillText(icon, cx + CELL / 2, cy2 + CELL / 2 + 5);

					// ΔTm label if cell is large enough
					if (CELL >= 48) {
						ctx.font = `7px "Courier Prime", monospace`;
						ctx.fillStyle = color;
						ctx.fillText(`ΔTm ${cell.tmDiff.toFixed(1)}°`, cx + CELL / 2, cy2 + CELL - 6);
					}

					// Hovered ring
					if (isHovered) {
						ctx.strokeStyle = color;
						ctx.lineWidth = 2;
						ctx.strokeRect(cx + 1, cy2 + 1, CELL - 2, CELL - 2);
					}

					// Compatible-set highlight ring
					if (inCompatSet && i !== j && cell.status !== "fail") {
						ctx.strokeStyle = STATUS_COLOR.ok + "88";
						ctx.lineWidth = 1;
						ctx.setLineDash([3, 2]);
						ctx.strokeRect(cx + 1, cy2 + 1, CELL - 2, CELL - 2);
						ctx.setLineDash([]);
					}
				}
			}
		}

		// Compatible set bracket — draw a subtle border around the subset
		if (compatibleSet.length >= 2) {
			const minIdx = Math.min(...compatibleSet);
			const maxIdx = Math.max(...compatibleSet);
			ctx.strokeStyle = STATUS_COLOR.ok;
			ctx.lineWidth = 1.5;
			ctx.setLineDash([]);
			const bx = LABEL_W + minIdx * CELL;
			const by = HEADER_H + minIdx * CELL;
			const bw = (maxIdx - minIdx + 1) * CELL;
			ctx.strokeRect(bx, by, bw, bw);
		}

	}, [result, hovered, pairs, matrix, compatibleSet, N]);

	function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
		const container = containerRef.current;
		const canvas = canvasRef.current;
		if (!canvas || !container || N === 0) return;
		const rect = canvas.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;

		const availW = container.clientWidth - 80;
		const CELL = Math.max(36, Math.min(72, Math.floor(availW / N)));
		const LABEL_W = 80;
		const HEADER_H = LABEL_W;

		const j = Math.floor((mx - LABEL_W) / CELL);
		const i = Math.floor((my - HEADER_H) / CELL);

		if (i >= 0 && i < N && j >= 0 && j < N && i !== j) {
			setHovered({ i, j });
			setTooltipPos({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 8 });
		} else {
			setHovered(null);
		}
	}

	const hoveredCell = hovered ? matrix[hovered.i]?.[hovered.j] : null;

	return (
		<div ref={containerRef} style={{ position: "relative", width: "100%" }}>
			<canvas
				ref={canvasRef}
				style={{ display: "block", cursor: hovered ? "pointer" : "default" }}
				onMouseMove={handleMouseMove}
				onMouseLeave={() => setHovered(null)}
			/>
			{/* Hover tooltip */}
			{hovered && hoveredCell && hovered.i !== hovered.j && (
				<div
					style={{
						position: "absolute",
						left: tooltipPos.x,
						top: tooltipPos.y,
						background: "rgba(245,240,232,0.97)",
						border: `1px solid ${STATUS_COLOR[hoveredCell.status]}`,
						borderRadius: "3px",
						padding: "6px 10px",
						fontFamily: "var(--font-courier)",
						fontSize: "9px",
						color: "#1c1a16",
						pointerEvents: "none",
						zIndex: 10,
						whiteSpace: "nowrap",
						lineHeight: 1.7,
					}}
				>
					<div style={{ fontWeight: 700, color: STATUS_COLOR[hoveredCell.status], marginBottom: "3px" }}>
						{pairs[hovered.i]?.targetName} × {pairs[hovered.j]?.targetName}
					</div>
					<div>ΔTm: {hoveredCell.tmDiff.toFixed(1)}°C</div>
					<div>Worst dimer: {hoveredCell.worstDimerDG.toFixed(1)} kcal/mol ({hoveredCell.dimerDetail})</div>
					<div style={{ color: STATUS_COLOR[hoveredCell.status], marginTop: "3px" }}>
						{hoveredCell.status === "ok" ? "✓ Compatible" : hoveredCell.status === "warn" ? "~ Borderline" : "✗ Incompatible"}
					</div>
				</div>
			)}
		</div>
	);
}
