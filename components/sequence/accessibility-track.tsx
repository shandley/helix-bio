"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { calcAccessibilityProfile } from "primd";
import type { PrimerPair } from "primd";

const BAR_HEIGHT = 28;

// Gradient: red-brown → amber → emerald (app palette)
function scoreToRGB(score: number): [number, number, number] {
	if (score <= 0.5) {
		const t = score * 2; // 0 → 1
		return [
			Math.round(175 + 9 * t),   // 175 → 184
			Math.round(42 + 105 * t),  // 42 → 147
			Math.round(42 + 16 * t),   // 42 → 58
		];
	}
	const t = (score - 0.5) * 2; // 0 → 1
	return [
		Math.round(184 - 158 * t),    // 184 → 26
		Math.round(147 - 76 * t),     // 147 → 71
		Math.round(58 - 9 * t),       // 58 → 49
	];
}

function interpretScore(score: number): { label: string; color: string } {
	if (score >= 0.75) return { label: "Accessible",  color: "#1a4731" };
	if (score >= 0.4)  return { label: "Marginal",    color: "#b8933a" };
	return                    { label: "Structured",  color: "#a02828" };
}

// Primer band height in CSS pixels — drawn at top (fwd) and bottom (rev) of the track
const PRIMER_BAND = 5;

function renderCanvas(
	canvas: HTMLCanvasElement,
	profile: Float32Array,
	seqLen: number,
	selection: { start: number; end: number } | null | undefined,
	primerPair: PrimerPair | null | undefined,
) {
	const dpr = window.devicePixelRatio ?? 1;
	const w = canvas.offsetWidth;
	if (w === 0) return;

	const pw = Math.round(w * dpr);
	const ph = Math.round(BAR_HEIGHT * dpr);

	canvas.width = pw;
	canvas.height = ph;
	canvas.style.width = `${w}px`;
	canvas.style.height = `${BAR_HEIGHT}px`;

	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	// Pixel-by-pixel heat map via ImageData (fastest approach)
	const img = ctx.createImageData(pw, ph);
	for (let px = 0; px < pw; px++) {
		const seqPos = Math.round((px / (pw - 1)) * (profile.length - 1));
		const score = profile[Math.max(0, Math.min(seqPos, profile.length - 1))] ?? 1;
		const [r, g, b] = scoreToRGB(score);
		for (let py = 0; py < ph; py++) {
			const i = (py * pw + px) * 4;
			img.data[i]     = r;
			img.data[i + 1] = g;
			img.data[i + 2] = b;
			img.data[i + 3] = 255;
		}
	}
	ctx.putImageData(img, 0, 0);

	ctx.save();
	ctx.scale(dpr, dpr);

	// Primer binding sites — fwd at top, rev at bottom, drawn before selection
	if (primerPair) {
		const { fwd, rev } = primerPair;

		// Forward primer — top PRIMER_BAND px, sky-blue
		const fx1 = (fwd.start / seqLen) * w;
		const fx2 = (fwd.end / seqLen) * w;
		ctx.fillStyle = "rgba(59,130,246,0.65)";
		ctx.fillRect(fx1, 0, Math.max(fx2 - fx1, 2), PRIMER_BAND);
		// 5′ end marker (left edge, since fwd reads left→right)
		ctx.fillStyle = "rgba(59,130,246,0.95)";
		ctx.fillRect(fx1, 0, 2, PRIMER_BAND);

		// Reverse primer — bottom PRIMER_BAND px, violet
		const rx1 = (rev.start / seqLen) * w;
		const rx2 = (rev.end / seqLen) * w;
		ctx.fillStyle = "rgba(168,85,247,0.65)";
		ctx.fillRect(rx1, BAR_HEIGHT - PRIMER_BAND, Math.max(rx2 - rx1, 2), PRIMER_BAND);
		// 5′ end marker (right edge, since rev reads right→left on the template)
		ctx.fillStyle = "rgba(168,85,247,0.95)";
		ctx.fillRect(Math.max(rx2 - 2, rx1), BAR_HEIGHT - PRIMER_BAND, 2, PRIMER_BAND);
	}

	// Selection highlight — drawn on top of primer bands
	if (selection && selection.end > selection.start) {
		const x1 = (selection.start / seqLen) * w;
		const x2 = (selection.end / seqLen) * w;
		ctx.fillStyle = "rgba(255,255,255,0.28)";
		ctx.fillRect(x1, 0, Math.max(x2 - x1, 1.5), BAR_HEIGHT);
		ctx.strokeStyle = "rgba(255,255,255,0.65)";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(x1, 0); ctx.lineTo(x1, BAR_HEIGHT);
		ctx.moveTo(x2, 0); ctx.lineTo(x2, BAR_HEIGHT);
		ctx.stroke();
	}

	ctx.restore();
}

export interface AccessibilityTrackProps {
	seq: string;
	annealTempC?: number;
	selection?: { start: number; end: number } | null;
	primerPair?: PrimerPair | null;
}

export function AccessibilityTrack({
	seq,
	annealTempC = 55,
	selection,
	primerPair,
}: AccessibilityTrackProps) {
	const canvasRef   = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const profileRef  = useRef<Float32Array | null>(null);
	const [ready, setReady] = useState(false);
	const [tooltip, setTooltip] = useState<{
		cx: number; cy: number; pos: number; score: number;
	} | null>(null);

	// Compute profile asynchronously so the loading shimmer has time to paint
	useEffect(() => {
		setReady(false);
		profileRef.current = null;
		let cancelled = false;

		const id = setTimeout(() => {
			if (cancelled) return;
			// windowExtra: 10 (40 bp window) balances speed vs. accuracy for overview
			const p = calcAccessibilityProfile(seq, 20, { annealTempC, windowExtra: 10 });
			if (!cancelled) {
				profileRef.current = p;
				setReady(true);
			}
		}, 0);

		return () => { cancelled = true; clearTimeout(id); };
	}, [seq, annealTempC]);

	// Redraw whenever profile is ready, selection changes, or container resizes
	const draw = useCallback(() => {
		const canvas = canvasRef.current;
		const profile = profileRef.current;
		if (!canvas || !profile) return;
		renderCanvas(canvas, profile, seq.length, selection, primerPair);
	}, [seq.length, selection, primerPair]);

	useEffect(() => {
		if (ready) draw();
	}, [ready, draw]);

	// ResizeObserver keeps the canvas sharp after layout changes
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const ro = new ResizeObserver(draw);
		ro.observe(el);
		return () => ro.disconnect();
	}, [draw]);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			const profile = profileRef.current;
			if (!profile) return;
			const rect = e.currentTarget.getBoundingClientRect();
			const x    = e.clientX - rect.left;
			const pos  = Math.round((x / rect.width) * (profile.length - 1));
			const score = profile[Math.max(0, Math.min(pos, profile.length - 1))] ?? 1;
			setTooltip({ cx: e.clientX, cy: e.clientY, pos, score });
		},
		[],
	);

	const tip = tooltip ? interpretScore(tooltip.score) : null;

	return (
		<div style={{
			flexShrink: 0,
			borderTop: "1px solid #ddd8ce",
			padding: "7px 12px 9px",
			background: "#f5f0e8",
		}}>
			{/* Header row */}
			<div style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				marginBottom: "5px",
			}}>
				<span style={{
					fontFamily: "var(--font-courier)",
					fontSize: "8.5px",
					letterSpacing: "0.1em",
					textTransform: "uppercase",
					color: "#9a9284",
				}}>
					Template Accessibility · {annealTempC}°C
				</span>

				{/* Legend */}
				<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
					{(["Structured", "Marginal", "Accessible"] as const).map((lbl) => {
						const c = lbl === "Accessible" ? "#1a4731"
							    : lbl === "Marginal"   ? "#b8933a"
							    :                        "#a02828";
						return (
							<div key={lbl} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
								<div style={{
									width: "14px", height: "5px",
									background: c, borderRadius: "1px", opacity: 0.85,
								}} />
								<span style={{
									fontFamily: "var(--font-courier)",
									fontSize: "7.5px",
									letterSpacing: "0.04em",
									color: "#9a9284",
								}}>
									{lbl}
								</span>
							</div>
						);
					})}
					{primerPair && (
						<>
							<span style={{ color: "#ddd8ce", fontSize: "9px" }}>·</span>
							{([["→F", "rgba(59,130,246,0.8)"], ["←R", "rgba(168,85,247,0.8)"]] as const).map(([lbl, c]) => (
								<div key={lbl} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
									<div style={{
										width: "14px", height: "5px",
										background: c, borderRadius: "1px",
									}} />
									<span style={{
										fontFamily: "var(--font-courier)",
										fontSize: "7.5px",
										letterSpacing: "0.04em",
										color: "#9a9284",
									}}>
										{lbl}
									</span>
								</div>
							))}
						</>
					)}
				</div>
			</div>

			{/* Canvas / shimmer */}
			<div
				ref={containerRef}
				style={{
					position: "relative",
					borderRadius: "3px",
					overflow: "hidden",
					boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)",
				}}
			>
				{!ready ? (
					<div
						className="access-shimmer"
						style={{ height: BAR_HEIGHT, borderRadius: "3px" }}
					/>
				) : (
					<canvas
						ref={canvasRef}
						style={{
							display: "block",
							width: "100%",
							height: BAR_HEIGHT,
							cursor: "crosshair",
						}}
						onMouseMove={handleMouseMove}
						onMouseLeave={() => setTooltip(null)}
					/>
				)}
			</div>

			{/* Tooltip — fixed to viewport so it clears the canvas bounds */}
			{tooltip && tip && (
				<div style={{
					position: "fixed",
					left: tooltip.cx + 14,
					top:  tooltip.cy - 52,
					background: "rgba(22,16,10,0.93)",
					borderRadius: "5px",
					padding: "6px 10px",
					pointerEvents: "none",
					zIndex: 9999,
					boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
					whiteSpace: "nowrap",
				}}>
					<div style={{
						fontFamily: "var(--font-courier)",
						fontSize: "9px",
						color: "#7a7268",
						letterSpacing: "0.05em",
						marginBottom: "2px",
					}}>
						pos {tooltip.pos + 1}
					</div>
					<div style={{
						fontFamily: "var(--font-courier)",
						fontSize: "11px",
						fontWeight: 700,
						color: tip.color,
					}}>
						{tip.label}
					</div>
					<div style={{
						fontFamily: "var(--font-courier)",
						fontSize: "10px",
						color: "#c4bfb4",
						marginTop: "1px",
					}}>
						{(tooltip.score * 100).toFixed(0)}% open
					</div>
				</div>
			)}
		</div>
	);
}
