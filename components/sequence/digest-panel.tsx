"use client";

import { useMemo, useState } from "react";
import { simulateDigest, enzymesCuttingSeq, type DigestFragment } from "@/lib/bio/digest";

// ── Gel constants ───────────────────────────────────────────────────────────
const GEL_W = 200;
const GEL_H = 300;
const WELL_H = 16;
const PAD_B = 24;
const USABLE_H = GEL_H - WELL_H - PAD_B;
const LADDER_X = 14;
const LADDER_W = 28;
const SAMPLE_X = 80;
const SAMPLE_W = 52;
const LABEL_X = SAMPLE_X + SAMPLE_W + 6;
const MIN_BP = 80;
const MAX_BP = 12000;

const LADDER_MARKERS = [100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000, 8000, 10000];
// Bright markers get labels
const LABELED_MARKERS = new Set([100, 500, 1000, 2000, 3000, 5000, 10000]);

function bpToY(bp: number): number {
	const clamped = Math.max(MIN_BP, Math.min(MAX_BP, bp));
	const t = (Math.log10(MAX_BP) - Math.log10(clamped)) / (Math.log10(MAX_BP) - Math.log10(MIN_BP));
	return WELL_H + t * USABLE_H;
}

function formatBp(bp: number): string {
	if (bp >= 1000) return `${(bp / 1000).toFixed(bp >= 10000 ? 0 : 1)}kb`;
	return `${bp}bp`;
}

function GelSVG({ fragments }: { fragments: DigestFragment[] }) {
	// Group fragments by size for band stacking (same-size = same band)
	const bandMap = new Map<number, number>();
	for (const f of fragments) {
		bandMap.set(f.size, (bandMap.get(f.size) ?? 0) + 1);
	}
	const bands = [...bandMap.entries()].sort((a, b) => b[0] - a[0]);

	return (
		<svg
			viewBox={`0 0 ${GEL_W} ${GEL_H}`}
			width="100%"
			style={{ display: "block", borderRadius: "4px" }}
		>
			<defs>
				{/* Glow filter for sample bands */}
				<filter id="glow" x="-50%" y="-200%" width="200%" height="500%">
					<feGaussianBlur stdDeviation="2" result="blur" />
					<feMerge>
						<feMergeNode in="blur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
				{/* Subtle noise texture */}
				<filter id="noise">
					<feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="noiseOut" />
					<feColorMatrix type="saturate" values="0" in="noiseOut" result="grayNoise" />
					<feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" result="blend" />
					<feComposite in="blend" in2="SourceGraphic" operator="in" />
				</filter>
			</defs>

			{/* Gel background */}
			<rect width={GEL_W} height={GEL_H} fill="#09150b" rx="4" />
			{/* Subtle texture overlay */}
			<rect width={GEL_W} height={GEL_H} fill="rgba(255,255,255,0.012)" rx="4" filter="url(#noise)" />

			{/* Faint lane guides */}
			<rect x={LADDER_X - 2} y={WELL_H} width={LADDER_W + 4} height={USABLE_H} fill="rgba(255,255,255,0.018)" rx="1" />
			<rect x={SAMPLE_X - 2} y={WELL_H} width={SAMPLE_W + 4} height={USABLE_H} fill="rgba(255,255,255,0.018)" rx="1" />

			{/* Wells */}
			<rect x={LADDER_X} y={4} width={LADDER_W} height={10} fill="#1a2e1c" rx="2" />
			<rect x={SAMPLE_X} y={4} width={SAMPLE_W} height={10} fill="#1a2e1c" rx="2" />

			{/* Lane labels */}
			<text x={LADDER_X + LADDER_W / 2} y={GEL_H - 6} textAnchor="middle"
				fill="rgba(160,200,160,0.5)" fontSize="7" fontFamily="monospace" letterSpacing="0.05em">
				LADDER
			</text>
			<text x={SAMPLE_X + SAMPLE_W / 2} y={GEL_H - 6} textAnchor="middle"
				fill="rgba(160,200,160,0.5)" fontSize="7" fontFamily="monospace" letterSpacing="0.05em">
				DIGEST
			</text>

			{/* ── Ladder bands ── */}
			{LADDER_MARKERS.map((bp) => {
				const y = bpToY(bp);
				const bright = LABELED_MARKERS.has(bp);
				return (
					<g key={bp}>
						<rect
							x={LADDER_X} y={y - 1.5}
							width={LADDER_W} height={bright ? 3 : 2}
							fill={bright ? "rgba(140,220,160,0.85)" : "rgba(100,170,120,0.55)"}
							rx="0.5"
						/>
						{bright && (
							<text x={LABEL_X - 4} y={y + 3.5}
								textAnchor="start" fill="rgba(160,210,170,0.7)"
								fontSize="7.5" fontFamily="monospace">
								{formatBp(bp)}
							</text>
						)}
					</g>
				);
			})}

			{/* ── Sample bands ── */}
			{bands.map(([size, count]) => {
				const y = bpToY(size);
				const outOfRange = size < MIN_BP || size > MAX_BP;
				const intensity = Math.min(1, 0.75 + count * 0.1);
				const bandH = Math.min(5, 3 + count * 0.5);
				return (
					<g key={size}>
						{/* Glow halo */}
						<rect
							x={SAMPLE_X} y={y - bandH / 2 - 2}
							width={SAMPLE_W} height={bandH + 4}
							fill={`rgba(100,230,140,${0.12 * intensity})`}
							rx="1"
						/>
						{/* Band */}
						<rect
							x={SAMPLE_X} y={y - bandH / 2}
							width={SAMPLE_W} height={bandH}
							fill={outOfRange
								? `rgba(220,180,80,${intensity})`   // amber = out of ladder range
								: `rgba(100,230,140,${intensity})`
							}
							rx="0.5"
							filter="url(#glow)"
						/>
						{/* Size label */}
						<text
							x={LABEL_X} y={y + 3}
							textAnchor="start"
							fill={outOfRange ? "rgba(220,190,100,0.8)" : "rgba(120,230,155,0.9)"}
							fontSize="7.5" fontFamily="monospace"
						>
							{outOfRange && size > MAX_BP ? ">" : ""}{outOfRange && size < MIN_BP ? "<" : ""}{formatBp(size)}
							{count > 1 ? ` ×${count}` : ""}
						</text>
					</g>
				);
			})}
		</svg>
	);
}

// ── Enzyme selector ──────────────────────────────────────────────────────────

interface EnzymeSelectorProps {
	available: { name: string; count: number }[];
	selected: Set<string>;
	onToggle: (name: string) => void;
	onSelectAll: () => void;
	onSelectNone: () => void;
}

function EnzymeSelector({ available, selected, onToggle, onSelectAll, onSelectNone }: EnzymeSelectorProps) {
	const singles = available.filter((e) => e.count === 1);
	const doubles = available.filter((e) => e.count === 2);
	const multiples = available.filter((e) => e.count >= 3);

	const groups = [
		{ label: "Cuts once", enzymes: singles },
		{ label: "Cuts twice", enzymes: doubles },
		{ label: `Cuts 3+ times`, enzymes: multiples },
	].filter((g) => g.enzymes.length > 0);

	if (available.length === 0) {
		return (
			<p style={{ fontFamily: "var(--font-courier)", fontSize: "10px", color: "#9a9284", padding: "12px", letterSpacing: "0.03em" }}>
				No restriction sites found
			</p>
		);
	}

	return (
		<div>
			<div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", padding: "6px 12px", borderBottom: "1px solid rgba(221,216,206,0.4)" }}>
				{(["all", "none"] as const).map((action) => (
					<button key={action} onClick={action === "all" ? onSelectAll : onSelectNone}
						style={{ fontFamily: "var(--font-courier)", fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#5a5648", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}>
						{action}
					</button>
				))}
			</div>
			{groups.map((group) => (
				<div key={group.label}>
					<div style={{ fontFamily: "var(--font-courier)", fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9284", padding: "6px 12px 3px" }}>
						{group.label}
					</div>
					<div style={{ display: "flex", flexWrap: "wrap", gap: "4px", padding: "2px 12px 6px" }}>
						{group.enzymes.map(({ name, count }) => {
							const active = selected.has(name);
							return (
								<button key={name} onClick={() => onToggle(name)}
									style={{
										fontFamily: "var(--font-courier)", fontSize: "9px", letterSpacing: "0.04em",
										padding: "3px 7px", borderRadius: "2px", cursor: "pointer",
										border: `1px solid ${active ? "rgba(26,71,49,0.5)" : "#ddd8ce"}`,
										background: active ? "rgba(26,71,49,0.08)" : "transparent",
										color: active ? "#1a4731" : "#5a5648",
										transition: "all 0.1s",
									}}>
									{name}
									<span style={{ marginLeft: "4px", opacity: 0.6 }}>{count}×</span>
								</button>
							);
						})}
					</div>
				</div>
			))}
		</div>
	);
}

// ── Fragment table ───────────────────────────────────────────────────────────

function FragmentTable({ fragments }: { fragments: DigestFragment[] }) {
	return (
		<table style={{ width: "100%", borderCollapse: "collapse" }}>
			<thead>
				<tr>
					{["Size", "Left", "Right"].map((h) => (
						<th key={h} style={{ fontFamily: "var(--font-courier)", fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9284", fontWeight: 400, padding: "4px 12px", textAlign: "left", borderBottom: "1px solid rgba(221,216,206,0.5)" }}>
							{h}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{fragments.map((f, i) => (
					<tr key={i}>
						<td style={{ fontFamily: "var(--font-courier)", fontSize: "10px", color: "#1c1a16", padding: "4px 12px", borderBottom: "1px solid rgba(221,216,206,0.3)" }}>
							{f.size.toLocaleString()} bp
						</td>
						<td style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#5a5648", padding: "4px 12px", borderBottom: "1px solid rgba(221,216,206,0.3)" }}>
							{f.leftEnzyme}
						</td>
						<td style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#5a5648", padding: "4px 12px", borderBottom: "1px solid rgba(221,216,206,0.3)" }}>
							{f.rightEnzyme}
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

// ── Main panel ───────────────────────────────────────────────────────────────

interface DigestPanelProps {
	seq: string;
	topology: "circular" | "linear";
}

export function DigestPanel({ seq, topology }: DigestPanelProps) {
	const available = useMemo(() => enzymesCuttingSeq(seq, topology), [seq, topology]);

	// Default: select all enzymes that cut once (typical for diagnostic digest)
	const [selected, setSelected] = useState<Set<string>>(() =>
		new Set(available.filter((e) => e.count === 1).map((e) => e.enzyme.name))
	);

	const result = useMemo(
		() => simulateDigest(seq, topology, [...selected]),
		[seq, topology, selected],
	);

	function toggle(name: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			next.has(name) ? next.delete(name) : next.add(name);
			return next;
		});
	}

	const selectorData = available.map((e) => ({ name: e.enzyme.name, count: e.count }));

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
			{/* Enzyme selector */}
			<div style={{ flexShrink: 0, overflowY: "auto", maxHeight: "180px", borderBottom: "1px solid #ddd8ce" }}>
				<EnzymeSelector
					available={selectorData}
					selected={selected}
					onToggle={toggle}
					onSelectAll={() => setSelected(new Set(selectorData.map((e) => e.name)))}
					onSelectNone={() => setSelected(new Set())}
				/>
			</div>

			{/* Gel + table */}
			<div style={{ flex: 1, overflowY: "auto" }}>
				{result.error ? (
					<p style={{ fontFamily: "var(--font-courier)", fontSize: "10px", color: "#9a9284", padding: "16px 12px", letterSpacing: "0.03em" }}>
						{result.error}
					</p>
				) : (
					<>
						{/* Gel */}
						<div style={{ padding: "12px 10px 4px" }}>
							<GelSVG fragments={result.fragments} />
						</div>

						{/* Summary */}
						<div style={{ padding: "4px 12px 8px", fontFamily: "var(--font-courier)", fontSize: "9px", color: "#9a9284", letterSpacing: "0.04em" }}>
							{result.fragments.length} fragment{result.fragments.length !== 1 ? "s" : ""} · {result.cutSites.length} cut{result.cutSites.length !== 1 ? "s" : ""}
						</div>

						{/* Fragment table */}
						<FragmentTable fragments={result.fragments} />
					</>
				)}
			</div>
		</div>
	);
}
