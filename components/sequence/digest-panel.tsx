"use client";

import type { PrimerPair } from "@shandley/primd";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { type DigestFragment, enzymesCuttingSeq, simulateDigest } from "@/lib/bio/digest";

// ── Ladder definitions ────────────────────────────────────────────────────────

const LADDERS = {
	"1kb": {
		label: "1 kb",
		markers: [10000, 8000, 6000, 5000, 4000, 3000, 2000, 1500, 1000, 750, 500, 250],
		labeled: new Set([10000, 5000, 3000, 2000, 1000, 500, 250]),
		minBp: 100,
		maxBp: 12000,
	},
	"100bp": {
		label: "100 bp",
		markers: [1000, 900, 800, 700, 600, 500, 400, 300, 200, 100],
		labeled: new Set([1000, 500, 200, 100]),
		minBp: 50,
		maxBp: 1500,
	},
	"hyperladder-1kb": {
		label: "HyperLadder 1kb",
		markers: [10000, 8000, 6000, 5000, 4000, 3000, 2500, 2000, 1500, 1000, 800, 600, 400, 200],
		labeled: new Set([10000, 5000, 3000, 2000, 1000, 500, 200]),
		minBp: 100,
		maxBp: 12000,
	},
	"hyperladder-100bp": {
		label: "HyperLadder 100bp",
		markers: [1000, 800, 600, 500, 400, 300, 200, 100, 50],
		labeled: new Set([1000, 500, 200, 100, 50]),
		minBp: 40,
		maxBp: 1200,
	},
} as const;

type LadderKey = keyof typeof LADDERS;

// ── Gel geometry ──────────────────────────────────────────────────────────────

const GEL_H = 310;
const WELL_H = 16;
const PAD_B = 22;
const USABLE_H = GEL_H - WELL_H - PAD_B;
const PAD_L = 10;
const LADDER_W = 30;
const LANE_W = 44;
const LANE_GAP = 8;
const LABEL_W = 52;

function gelWidth(nLanes: number) {
	return PAD_L + LADDER_W + LANE_GAP + nLanes * (LANE_W + LANE_GAP) + LABEL_W;
}

function bpToY(bp: number, minBp: number, maxBp: number): number {
	const clamped = Math.max(minBp, Math.min(maxBp, bp));
	const t = (Math.log10(maxBp) - Math.log10(clamped)) / (Math.log10(maxBp) - Math.log10(minBp));
	return WELL_H + t * USABLE_H;
}

function formatBp(bp: number): string {
	if (bp >= 1000) return `${(bp / 1000).toFixed(bp >= 10000 ? 0 : 1)}kb`;
	return `${bp}bp`;
}

// ── Gel SVG ───────────────────────────────────────────────────────────────────

interface LaneData {
	label: string;
	fragments: DigestFragment[];
	color?: string; // default green; PCR lane uses a different color
}

interface GelSVGProps {
	ladder: LadderKey;
	lanes: LaneData[];
	svgRef?: React.RefObject<SVGSVGElement | null>;
}

function GelSVG({ ladder, lanes, svgRef }: GelSVGProps) {
	const { markers, labeled, minBp, maxBp } = LADDERS[ladder];
	const W = gelWidth(lanes.length);
	const filterId = useId().replace(/:/g, "");

	return (
		<svg
			ref={svgRef}
			viewBox={`0 0 ${W} ${GEL_H}`}
			width="100%"
			style={{ display: "block", borderRadius: "4px" }}
		>
			<defs>
				<filter id={`glow-${filterId}`} x="-50%" y="-200%" width="200%" height="500%">
					<feGaussianBlur stdDeviation="1.8" result="blur" />
					<feMerge>
						<feMergeNode in="blur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
				<filter id={`noise-${filterId}`}>
					<feTurbulence
						type="fractalNoise"
						baseFrequency="0.65"
						numOctaves="3"
						stitchTiles="stitch"
						result="n"
					/>
					<feColorMatrix type="saturate" values="0" in="n" result="g" />
					<feBlend in="SourceGraphic" in2="g" mode="multiply" result="b" />
					<feComposite in="b" in2="SourceGraphic" operator="in" />
				</filter>
			</defs>

			{/* Gel background */}
			<rect width={W} height={GEL_H} fill="#09150b" rx="4" />
			<rect
				width={W}
				height={GEL_H}
				fill="rgba(255,255,255,0.01)"
				rx="4"
				filter={`url(#noise-${filterId})`}
			/>

			{/* Lane guides */}
			<rect
				x={PAD_L - 1}
				y={WELL_H}
				width={LADDER_W + 2}
				height={USABLE_H}
				fill="rgba(255,255,255,0.015)"
				rx="1"
			/>
			{lanes.map((_, i) => {
				const lx = PAD_L + LADDER_W + LANE_GAP + i * (LANE_W + LANE_GAP);
				return (
					<rect
						key={i}
						x={lx - 1}
						y={WELL_H}
						width={LANE_W + 2}
						height={USABLE_H}
						fill="rgba(255,255,255,0.015)"
						rx="1"
					/>
				);
			})}

			{/* Wells */}
			<rect x={PAD_L} y={4} width={LADDER_W} height={10} fill="#1a2e1c" rx="2" />
			{lanes.map((_, i) => {
				const lx = PAD_L + LADDER_W + LANE_GAP + i * (LANE_W + LANE_GAP);
				return <rect key={i} x={lx} y={4} width={LANE_W} height={10} fill="#1a2e1c" rx="2" />;
			})}

			{/* Lane labels */}
			<text
				x={PAD_L + LADDER_W / 2}
				y={GEL_H - 5}
				textAnchor="middle"
				fill="rgba(160,200,160,0.45)"
				fontSize="6.5"
				fontFamily="monospace"
				letterSpacing="0.04em"
			>
				LADDER
			</text>
			{lanes.map((lane, i) => {
				const lx = PAD_L + LADDER_W + LANE_GAP + i * (LANE_W + LANE_GAP);
				return (
					<text
						key={i}
						x={lx + LANE_W / 2}
						y={GEL_H - 5}
						textAnchor="middle"
						fill="rgba(160,200,160,0.45)"
						fontSize="6.5"
						fontFamily="monospace"
						letterSpacing="0.04em"
					>
						{lane.label.toUpperCase()}
					</text>
				);
			})}

			{/* Ladder bands */}
			{markers.map((bp) => {
				const y = bpToY(bp, minBp, maxBp);
				const bright = labeled.has(bp as never);
				return (
					<g key={bp}>
						<rect
							x={PAD_L}
							y={y - 1.5}
							width={LADDER_W}
							height={bright ? 3 : 2}
							fill={bright ? "rgba(140,220,160,0.85)" : "rgba(100,170,120,0.5)"}
							rx="0.5"
						/>
						{bright && (
							<text
								x={PAD_L + LADDER_W + 3}
								y={y + 3.5}
								textAnchor="start"
								fill="rgba(155,210,165,0.65)"
								fontSize="7"
								fontFamily="monospace"
							>
								{formatBp(bp)}
							</text>
						)}
					</g>
				);
			})}

			{/* Sample lanes */}
			{lanes.map((lane, laneIdx) => {
				const lx = PAD_L + LADDER_W + LANE_GAP + laneIdx * (LANE_W + LANE_GAP);
				const bandColor = lane.color ?? "rgba(100,230,140,1)";
				const glowColor = lane.color ? "rgba(100,180,255,0.14)" : "rgba(100,230,140,0.12)";

				const bandMap = new Map<number, number>();
				for (const f of lane.fragments) bandMap.set(f.size, (bandMap.get(f.size) ?? 0) + 1);
				const bands = [...bandMap.entries()].sort((a, b) => b[0] - a[0]);

				return (
					<g key={laneIdx}>
						{bands.map(([size, count]) => {
							const y = bpToY(size, minBp, maxBp);
							const outOfRange = size < minBp || size > maxBp;
							const intensity = Math.min(1, 0.75 + count * 0.1);
							const bandH = Math.min(5, 3 + count * 0.5);
							const fillColor = outOfRange
								? `rgba(220,180,80,${intensity})`
								: bandColor.replace("1)", `${intensity})`);
							const haloColor = outOfRange ? "rgba(220,180,80,0.12)" : glowColor;

							return (
								<g key={size}>
									<rect
										x={lx}
										y={y - bandH / 2 - 2}
										width={LANE_W}
										height={bandH + 4}
										fill={haloColor}
										rx="1"
									/>
									<rect
										x={lx}
										y={y - bandH / 2}
										width={LANE_W}
										height={bandH}
										fill={fillColor}
										rx="0.5"
										filter={`url(#glow-${filterId})`}
									/>
									{/* Size label — only show on last (rightmost) lane to avoid clutter */}
									{laneIdx === lanes.length - 1 && (
										<text
											x={lx + LANE_W + 3}
											y={y + 3}
											textAnchor="start"
											fill={outOfRange ? "rgba(220,190,100,0.8)" : "rgba(120,230,155,0.85)"}
											fontSize="7"
											fontFamily="monospace"
										>
											{outOfRange && size > maxBp ? ">" : ""}
											{outOfRange && size < minBp ? "<" : ""}
											{formatBp(size)}
											{count > 1 ? ` ×${count}` : ""}
										</text>
									)}
								</g>
							);
						})}
					</g>
				);
			})}
		</svg>
	);
}

// ── Enzyme selector ───────────────────────────────────────────────────────────

function EnzymeSelector({
	available,
	selected,
	onToggle,
	onSelectAll,
	onSelectNone,
}: {
	available: { name: string; count: number }[];
	selected: Set<string>;
	onToggle: (name: string) => void;
	onSelectAll: () => void;
	onSelectNone: () => void;
}) {
	const singles = available.filter((e) => e.count === 1);
	const doubles = available.filter((e) => e.count === 2);
	const multiples = available.filter((e) => e.count >= 3);
	const groups = [
		{ label: "Cuts once", enzymes: singles },
		{ label: "Cuts twice", enzymes: doubles },
		{ label: "Cuts 3+", enzymes: multiples },
	].filter((g) => g.enzymes.length > 0);

	if (available.length === 0) {
		return (
			<p
				style={{
					fontFamily: "var(--font-courier)",
					fontSize: "10px",
					color: "#9a9284",
					padding: "10px 12px",
				}}
			>
				No sites found
			</p>
		);
	}

	return (
		<div>
			<div
				style={{
					display: "flex",
					justifyContent: "flex-end",
					gap: "10px",
					padding: "4px 12px 4px",
					borderBottom: "1px solid rgba(221,216,206,0.4)",
				}}
			>
				{(["all", "none"] as const).map((a) => (
					<button
						key={a}
						type="button"
						onClick={a === "all" ? onSelectAll : onSelectNone}
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "8px",
							letterSpacing: "0.1em",
							textTransform: "uppercase",
							color: "#5a5648",
							background: "none",
							border: "none",
							cursor: "pointer",
						}}
					>
						{a}
					</button>
				))}
			</div>
			{groups.map((group) => (
				<div key={group.label}>
					<div
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "7.5px",
							letterSpacing: "0.1em",
							textTransform: "uppercase",
							color: "#9a9284",
							padding: "5px 12px 2px",
						}}
					>
						{group.label}
					</div>
					<div style={{ display: "flex", flexWrap: "wrap", gap: "3px", padding: "2px 12px 5px" }}>
						{group.enzymes.map(({ name, count }) => {
							const active = selected.has(name);
							return (
								<button
									key={name}
									type="button"
									onClick={() => onToggle(name)}
									style={{
										fontFamily: "var(--font-courier)",
										fontSize: "8.5px",
										letterSpacing: "0.04em",
										padding: "2px 6px",
										borderRadius: "2px",
										cursor: "pointer",
										border: `1px solid ${active ? "rgba(26,71,49,0.5)" : "#ddd8ce"}`,
										background: active ? "rgba(26,71,49,0.08)" : "transparent",
										color: active ? "#1a4731" : "#5a5648",
										transition: "all 0.1s",
									}}
								>
									{name}
									<span style={{ marginLeft: "3px", opacity: 0.55 }}>{count}×</span>
								</button>
							);
						})}
					</div>
				</div>
			))}
		</div>
	);
}

// ── Fragment table ────────────────────────────────────────────────────────────

function FragmentTable({ lanes }: { lanes: { label: string; fragments: DigestFragment[] }[] }) {
	const cellStyle: React.CSSProperties = {
		fontFamily: "var(--font-courier)",
		fontSize: "9px",
		padding: "3px 8px",
		borderBottom: "1px solid rgba(221,216,206,0.3)",
	};
	const headStyle: React.CSSProperties = {
		...cellStyle,
		fontSize: "7.5px",
		letterSpacing: "0.1em",
		textTransform: "uppercase",
		color: "#9a9284",
		fontWeight: 400,
	};

	return (
		<div style={{ overflowX: "auto" }}>
			{lanes.map((lane) => (
				<div key={lane.label}>
					{lanes.length > 1 && (
						<div
							style={{
								fontFamily: "var(--font-courier)",
								fontSize: "8px",
								letterSpacing: "0.1em",
								textTransform: "uppercase",
								color: "#5a5648",
								padding: "6px 8px 2px",
							}}
						>
							{lane.label}
						</div>
					)}
					<table style={{ width: "100%", borderCollapse: "collapse" }}>
						<thead>
							<tr>
								{["Size", "Left", "Right"].map((h) => (
									<th key={h} style={{ ...headStyle, textAlign: "left" }}>
										{h}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{lane.fragments.map((f, i) => (
								<tr key={i}>
									<td style={{ ...cellStyle, color: "#1c1a16" }}>{f.size.toLocaleString()} bp</td>
									<td style={{ ...cellStyle, color: "#5a5648" }}>{f.leftEnzyme}</td>
									<td style={{ ...cellStyle, color: "#5a5648" }}>{f.rightEnzyme}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			))}
		</div>
	);
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface DigestPanelProps {
	seq: string;
	topology: "circular" | "linear";
	primerPair?: PrimerPair | null;
}

export function DigestPanel({ seq, topology, primerPair }: DigestPanelProps) {
	const available = useMemo(() => enzymesCuttingSeq(seq, topology), [seq, topology]);
	const defaultSelected = useMemo(
		() => new Set(available.filter((e) => e.count === 1).map((e) => e.enzyme.name)),
		[available],
	);

	const [ladder, setLadder] = useState<LadderKey>("1kb");
	const [lane1, setLane1] = useState<Set<string>>(defaultSelected);
	const [lane2, setLane2] = useState<Set<string>>(new Set<string>());
	const [showLane2, setShowLane2] = useState(false);
	const svgRef = useRef<SVGSVGElement | null>(null);

	const selectorData = available.map((e) => ({ name: e.enzyme.name, count: e.count }));

	const result1 = useMemo(() => simulateDigest(seq, topology, [...lane1]), [seq, topology, lane1]);
	const result2 = useMemo(() => simulateDigest(seq, topology, [...lane2]), [seq, topology, lane2]);

	// Build lane data for the gel
	const gelLanes: LaneData[] = useMemo(() => {
		const ls: LaneData[] = [{ label: "Digest 1", fragments: result1.fragments }];
		if (showLane2 && lane2.size > 0) ls.push({ label: "Digest 2", fragments: result2.fragments });
		if (primerPair) {
			ls.push({
				label: "PCR",
				fragments: [
					{
						size: primerPair.productSize,
						start: 0,
						end: primerPair.productSize,
						leftEnzyme: "5′",
						rightEnzyme: "3′",
					},
				],
				color: "rgba(100,180,255,1)",
			});
		}
		return ls;
	}, [result1, result2, showLane2, lane2, primerPair]);

	// Export gel as PNG
	const exportGel = useCallback(() => {
		const svg = svgRef.current;
		if (!svg) return;
		const w = 600,
			h = Math.round(600 * (GEL_H / gelWidth(gelLanes.length)));
		const xml = new XMLSerializer().serializeToString(svg);
		const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = w;
			canvas.height = h;
			const ctx = canvas.getContext("2d")!;
			ctx.drawImage(img, 0, 0, w, h);
			URL.revokeObjectURL(url);
			const link = document.createElement("a");
			link.download = "gel_digest.png";
			link.href = canvas.toDataURL("image/png");
			link.click();
		};
		img.src = url;
	}, [gelLanes.length]);

	const btnStyle: React.CSSProperties = {
		fontFamily: "var(--font-courier)",
		fontSize: "8px",
		letterSpacing: "0.08em",
		textTransform: "uppercase",
		color: "#5a5648",
		background: "none",
		border: "1px solid #ddd8ce",
		borderRadius: "2px",
		padding: "2px 8px",
		cursor: "pointer",
		flexShrink: 0,
	};

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
			{/* Controls row */}
			<div
				style={{
					flexShrink: 0,
					padding: "6px 10px",
					borderBottom: "1px solid #ddd8ce",
					display: "flex",
					alignItems: "center",
					gap: "6px",
					flexWrap: "wrap",
				}}
			>
				{/* Ladder selector */}
				<select
					value={ladder}
					onChange={(e) => setLadder(e.target.value as LadderKey)}
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "8px",
						letterSpacing: "0.04em",
						color: "#5a5648",
						background: "#f5f0e8",
						border: "1px solid #ddd8ce",
						borderRadius: "2px",
						padding: "2px 6px",
						cursor: "pointer",
					}}
				>
					{(Object.keys(LADDERS) as LadderKey[]).map((k) => (
						<option key={k} value={k}>
							{LADDERS[k].label}
						</option>
					))}
				</select>

				{/* Compare lane toggle */}
				<button
					type="button"
					style={{
						...btnStyle,
						color: showLane2 ? "#1a4731" : "#5a5648",
						borderColor: showLane2 ? "rgba(26,71,49,0.4)" : "#ddd8ce",
						background: showLane2 ? "rgba(26,71,49,0.06)" : "none",
					}}
					onClick={() => setShowLane2((v) => !v)}
				>
					{showLane2 ? "− Lane 2" : "+ Lane 2"}
				</button>

				{/* PCR indicator */}
				{primerPair && (
					<span
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "8px",
							color: "#3b82f6",
							background: "rgba(59,130,246,0.08)",
							border: "1px solid rgba(59,130,246,0.25)",
							borderRadius: "2px",
							padding: "2px 6px",
							letterSpacing: "0.04em",
						}}
					>
						PCR {primerPair.productSize} bp
					</span>
				)}

				{/* Export */}
				<button type="button" style={{ ...btnStyle, marginLeft: "auto" }} onClick={exportGel}>
					PNG ↓
				</button>
			</div>

			{/* Enzyme selectors */}
			<div
				style={{
					flexShrink: 0,
					overflowY: "auto",
					maxHeight: showLane2 ? "140px" : "180px",
					borderBottom: "1px solid #ddd8ce",
				}}
			>
				{showLane2 && (
					<div
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "7.5px",
							letterSpacing: "0.1em",
							textTransform: "uppercase",
							color: "#5a5648",
							padding: "5px 12px 2px",
							background: "rgba(26,71,49,0.04)",
						}}
					>
						Digest 1
					</div>
				)}
				<EnzymeSelector
					available={selectorData}
					selected={lane1}
					onToggle={(n) =>
						setLane1((p) => {
							const s = new Set(p);
							s.has(n) ? s.delete(n) : s.add(n);
							return s;
						})
					}
					onSelectAll={() => setLane1(new Set(selectorData.map((e) => e.name)))}
					onSelectNone={() => setLane1(new Set())}
				/>
				{showLane2 && (
					<>
						<div
							style={{
								fontFamily: "var(--font-courier)",
								fontSize: "7.5px",
								letterSpacing: "0.1em",
								textTransform: "uppercase",
								color: "#5a5648",
								padding: "5px 12px 2px",
								background: "rgba(59,130,246,0.04)",
								borderTop: "1px solid #ddd8ce",
							}}
						>
							Digest 2
						</div>
						<EnzymeSelector
							available={selectorData}
							selected={lane2}
							onToggle={(n) =>
								setLane2((p) => {
									const s = new Set(p);
									s.has(n) ? s.delete(n) : s.add(n);
									return s;
								})
							}
							onSelectAll={() => setLane2(new Set(selectorData.map((e) => e.name)))}
							onSelectNone={() => setLane2(new Set())}
						/>
					</>
				)}
			</div>

			{/* Gel + table */}
			<div style={{ flex: 1, overflowY: "auto" }}>
				{result1.error ? (
					<p
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "10px",
							color: "#9a9284",
							padding: "16px 12px",
						}}
					>
						{result1.error}
					</p>
				) : (
					<>
						<div style={{ padding: "10px 8px 4px" }}>
							<GelSVG ladder={ladder} lanes={gelLanes} svgRef={svgRef} />
						</div>
						<div
							style={{
								padding: "2px 12px 8px",
								fontFamily: "var(--font-courier)",
								fontSize: "9px",
								color: "#9a9284",
								letterSpacing: "0.04em",
							}}
						>
							{result1.fragments.length} fragment{result1.fragments.length !== 1 ? "s" : ""} ·{" "}
							{result1.cutSites.length} cut{result1.cutSites.length !== 1 ? "s" : ""}
							{showLane2 && lane2.size > 0 && ` · Lane 2: ${result2.fragments.length} fragments`}
							{primerPair && ` · PCR: ${primerPair.productSize} bp`}
						</div>
						<FragmentTable
							lanes={[
								{ label: "Digest 1", fragments: result1.fragments },
								...(showLane2 && lane2.size > 0
									? [{ label: "Digest 2", fragments: result2.fragments }]
									: []),
							]}
						/>
					</>
				)}
			</div>
		</div>
	);
}
