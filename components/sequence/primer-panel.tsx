"use client";

import type { AssemblyPrimerPair, PrimerCandidate, PrimerPair } from "@shandley/primd";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PrimerPlotsData } from "@/components/primer-viz/primer-plots-drawer";
import type { PrimerWorkerRequest, PrimerWorkerResponse } from "./primer-design.worker";

// Golden Gate enzyme recognition sites (Type IIS)
const GG_ENZYME_SITES: Record<string, string> = {
	BsaI: "GGTCTC",
	BbsI: "GAAGAC",
	BsmBI: "CGTCTC",
};

// PCR pair augmented with optional qPCR-specific fields
type DesignPair = PrimerPair & {
	ampliconTm?: number;
	ampliconDG?: number;
	efficiencyScore?: number;
};

interface PrimerPanelProps {
	seq: string;
	seqLen: number;
	topology?: "circular" | "linear";
	selectionStart?: number;
	selectionEnd?: number;
	onPrimersDesigned?: (pair: PrimerPair | null) => void;
	/** Set when an annotation was clicked — triggers auto-design and shows the name */
	annotationName?: string | null;
	/** Plasmid name sent as context to the PCR diagnosis endpoint. */
	sequenceName?: string;
	/** Called when user opens the Plots drawer. */
	onShowPlots?: (data: PrimerPlotsData) => void;
	/** Called when user clicks the edit button on the annotation name badge. */
	onEditAnnotation?: () => void;
}

function Badge({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
	const color = warn ? "#b8933a" : "#2d7a54";
	const bg = warn ? "rgba(184,147,58,0.08)" : "rgba(45,122,84,0.06)";
	const border = warn ? "rgba(184,147,58,0.25)" : "rgba(45,122,84,0.2)";
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: "3px",
				fontFamily: "var(--font-courier)",
				fontSize: "9px",
				letterSpacing: "0.04em",
				color,
				background: bg,
				border: `1px solid ${border}`,
				borderRadius: "2px",
				padding: "1px 5px",
			}}
		>
			<span style={{ opacity: 0.6 }}>{label}</span>
			{value && <span style={{ fontWeight: 700 }}>{value}</span>}
		</span>
	);
}

function AccessBadge({ score }: { score: number }) {
	// Mirrors the heat map legend thresholds
	if (score >= 0.75) return null; // Accessible — no badge needed
	const warn = score >= 0.4;
	const label = warn ? "marginal" : "structured";
	const color = warn ? "#b8933a" : "#a02828";
	const bg = warn ? "rgba(184,147,58,0.08)" : "rgba(160,40,40,0.07)";
	const border = warn ? "rgba(184,147,58,0.25)" : "rgba(160,40,40,0.25)";
	const pct = Math.round(score * 100);
	const tooltip = warn
		? `Binding site ${pct}% likely single-stranded at the annealing temperature. Some secondary structure present — primer may have reduced efficiency. See the heat map strip below the sequence.`
		: `Binding site only ${pct}% likely single-stranded — the template is significantly structured here. Primers in structured regions have notably lower efficiency. Consider shifting the binding position or raising the annealing temperature. See the heat map strip below.`;
	return (
		<span
			title={tooltip}
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: "3px",
				fontFamily: "var(--font-courier)",
				fontSize: "9px",
				letterSpacing: "0.04em",
				color,
				background: bg,
				border: `1px solid ${border}`,
				borderRadius: "2px",
				padding: "1px 5px",
				cursor: "help",
			}}
		>
			<span style={{ opacity: 0.6 }}>site</span>
			<span style={{ fontWeight: 700 }}>{label}</span>
		</span>
	);
}

// Compact single-line sequence row used inside PairCard
function SeqLine({
	dir,
	primer,
	tmTarget,
}: {
	dir: "→" | "←";
	primer: PrimerCandidate;
	tmTarget: number;
}) {
	const [copied, setCopied] = useState(false);
	function copy() {
		void navigator.clipboard.writeText(primer.seq).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1200);
		});
	}
	const tmWarn = Math.abs(primer.tm - tmTarget) > 4;
	const accessBad = primer.templateAccessibility < 0.4;
	const accessWarn = !accessBad && primer.templateAccessibility < 0.75;
	return (
		<div
			onClick={copy}
			title={`Click to copy · ${primer.seq}`}
			style={{
				display: "flex",
				alignItems: "center",
				gap: "5px",
				cursor: "pointer",
				padding: "2px 0",
			}}
		>
			<span
				style={{
					fontFamily: "var(--font-courier)",
					fontSize: "8px",
					color: "#9a9284",
					width: "9px",
					flexShrink: 0,
				}}
			>
				{dir}
			</span>
			<span
				style={{
					fontFamily: "var(--font-courier)",
					fontSize: "10px",
					letterSpacing: "0.04em",
					color: copied ? "#1a4731" : "#1c1a16",
					flex: 1,
					overflow: "hidden",
					whiteSpace: "nowrap",
					textOverflow: "ellipsis",
					transition: "color 0.15s",
				}}
			>
				{primer.seq}
			</span>
			<span
				style={{
					fontFamily: "var(--font-courier)",
					fontSize: "8px",
					color: tmWarn ? "#b8933a" : "#9a9284",
					flexShrink: 0,
				}}
			>
				{primer.tm.toFixed(1)}°
			</span>
			{accessBad && (
				<span
					title="Binding site in secondary structure"
					style={{ fontSize: "9px", color: "#a02828", lineHeight: 1 }}
				>
					⚠
				</span>
			)}
			{accessWarn && (
				<span
					title="Binding site partially structured"
					style={{ fontSize: "9px", color: "#b8933a", lineHeight: 1 }}
				>
					~
				</span>
			)}
		</div>
	);
}

// Ranked pair card — primary result view
function PairCard({ pair, rank, tmTarget, mode, focused }: { pair: DesignPair; rank: number; tmTarget: number; mode?: string; focused?: boolean }) {
	const [copied, setCopied] = useState(false);
	function copyPair() {
		const text = `Fwd (${pair.fwd.len}bp, Tm ${pair.fwd.tm.toFixed(1)}°C): ${pair.fwd.seq}\nRev (${pair.rev.len}bp, Tm ${pair.rev.tm.toFixed(1)}°C): ${pair.rev.seq}`;
		void navigator.clipboard.writeText(text).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		});
	}
	const dimerWarn = pair.heteroDimerDG < -3.0;
	const tmDiffWarn = pair.tmDiff > 2;

	// qPCR efficiency badge
	const eff = pair.efficiencyScore;
	const effBadge =
		eff !== undefined
			? (() => {
					const color = eff >= 0.8 ? "#2d7a54" : eff >= 0.6 ? "#b8933a" : "#a02828";
					const bg =
						eff >= 0.8
							? "rgba(45,122,84,0.08)"
							: eff >= 0.6
								? "rgba(184,147,58,0.08)"
								: "rgba(160,40,40,0.07)";
					const border =
						eff >= 0.8
							? "rgba(45,122,84,0.2)"
							: eff >= 0.6
								? "rgba(184,147,58,0.25)"
								: "rgba(160,40,40,0.25)";
					return (
						<span
							title={`qPCR efficiency score ${(eff * 100).toFixed(0)}% — composite of amplicon size, GC%, and secondary structure`}
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: "3px",
								fontFamily: "var(--font-courier)",
								fontSize: "9px",
								letterSpacing: "0.04em",
								color,
								background: bg,
								border: `1px solid ${border}`,
								borderRadius: "2px",
								padding: "1px 5px",
								cursor: "help",
							}}
						>
							<span style={{ opacity: 0.6 }}>eff</span>
							<span style={{ fontWeight: 700 }}>{(eff * 100).toFixed(0)}%</span>
						</span>
					);
				})()
			: null;
	const isBest = rank === 1;
	return (
		<div
			id={`pair-card-${rank - 1}`}
			style={{
				padding: "10px 12px",
				borderBottom: "1px solid rgba(221,216,206,0.5)",
				background: isBest ? "rgba(26,71,49,0.04)" : "transparent",
				outline: focused ? "1px solid rgba(26,71,49,0.35)" : "none",
				outlineOffset: "-1px",
			}}
		>
			{/* Metrics row */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: "6px",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
					<span
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "9px",
							letterSpacing: "0.1em",
							color: isBest ? "#2d7a54" : "#9a9284",
							fontWeight: isBest ? 700 : 400,
						}}
					>
						#{rank}
					</span>
					<span style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#5a5648" }}>
						{formatLen(pair.productSize)}
					</span>
					<span style={{ color: "#ddd8ce" }}>·</span>
					<span
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "9px",
							color: tmDiffWarn ? "#b8933a" : "#9a9284",
						}}
					>
						ΔTm {pair.tmDiff.toFixed(1)}°
					</span>
					{dimerWarn && <Badge label="dimer" value={`${pair.heteroDimerDG.toFixed(1)}`} warn />}
					{/* Show eff badge only in PCR/non-qPCR mode; qPCR gets a full bar below */}
					{mode !== "qpcr" && effBadge}
					{pair.ampliconTm !== undefined && (
						<span
							style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#9a9284" }}
							title="Predicted melting temperature of the amplicon product"
						>
							amp {pair.ampliconTm.toFixed(0)}°
						</span>
					)}
				</div>
				<button
					type="button"
					onClick={copyPair}
					title="Copy pair (Fwd + Rev sequences)"
					style={{
						background: "none",
						border: "none",
						cursor: "pointer",
						padding: "0 2px",
						fontFamily: "var(--font-courier)",
						fontSize: "9px",
						color: copied ? "#1a4731" : "#9a9284",
						transition: "color 0.15s",
					}}
				>
					{copied ? "copied" : "copy"}
				</button>
			</div>
			{/* Sequences */}
			<SeqLine dir="→" primer={pair.fwd} tmTarget={tmTarget} />
			<SeqLine dir="←" primer={pair.rev} tmTarget={tmTarget} />

			{/* qPCR efficiency bar — replaces the small badge with a visual row */}
			{mode === "qpcr" && pair.efficiencyScore !== undefined && (
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						marginTop: "7px",
						paddingTop: "6px",
						borderTop: "1px solid rgba(221,216,206,0.5)",
					}}
				>
					<span
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "8px",
							letterSpacing: "0.06em",
							color: "#9a9284",
							flexShrink: 0,
						}}
					>
						Efficiency
					</span>
					<div
						style={{
							flex: 1,
							height: "5px",
							background: "#ede9e0",
							borderRadius: "3px",
							overflow: "hidden",
						}}
					>
						<div
							style={{
								width: `${pair.efficiencyScore * 100}%`,
								height: "100%",
								borderRadius: "3px",
								background:
									pair.efficiencyScore >= 0.8
										? "#2d7a54"
										: pair.efficiencyScore >= 0.6
											? "#b8933a"
											: "#a02828",
								transition: "none",
							}}
						/>
					</div>
					<span
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "9px",
							fontWeight: 700,
							flexShrink: 0,
							color:
								pair.efficiencyScore >= 0.8
									? "#2d7a54"
									: pair.efficiencyScore >= 0.6
										? "#b8933a"
										: "#a02828",
						}}
						title={
							pair.efficiencyScore >= 0.8
								? "Excellent — standard PCR efficiency, reliable quantification"
								: pair.efficiencyScore >= 0.6
									? "Acceptable — monitor for accuracy; validate with standard curve"
									: "Poor — consider redesigning primers or adjusting amplicon region"
						}
					>
						{(pair.efficiencyScore * 100).toFixed(0)}%
					</span>
					{pair.ampliconDG !== undefined && pair.ampliconDG < -3.0 && (
						<span
							title={`Amplicon ΔG: ${pair.ampliconDG.toFixed(1)} kcal/mol — secondary structure may reduce qPCR efficiency`}
							style={{ fontSize: "10px", color: "#b8933a", cursor: "help", flexShrink: 0 }}
						>
							⚠
						</span>
					)}
				</div>
			)}
		</div>
	);
}

// Detailed individual primer card — shown in the collapsible section
function PrimerCard({
	primer,
	rank,
	highlight,
	tmTarget,
}: {
	primer: PrimerCandidate;
	rank: number;
	highlight: boolean;
	tmTarget: number;
}) {
	const [copied, setCopied] = useState(false);
	function copy() {
		void navigator.clipboard.writeText(primer.seq).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		});
	}
	const tmWarn = Math.abs(primer.tm - tmTarget) > 4;
	const gcWarn = primer.gc < 0.42 || primer.gc > 0.62;
	const hairpinWarn = primer.hairpinDG < -1.0;
	const selfDimerWarn = primer.selfDimerDG < -3.0;
	return (
		<div
			onClick={copy}
			title="Click to copy sequence"
			style={{
				padding: "8px 12px",
				borderBottom: "1px solid rgba(221,216,206,0.5)",
				cursor: "pointer",
				background: highlight ? "rgba(26,71,49,0.04)" : "transparent",
				transition: "background 0.1s",
			}}
			onMouseEnter={(e) => {
				(e.currentTarget as HTMLDivElement).style.background = "rgba(26,71,49,0.07)";
			}}
			onMouseLeave={(e) => {
				(e.currentTarget as HTMLDivElement).style.background = highlight
					? "rgba(26,71,49,0.04)"
					: "transparent";
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: "4px",
				}}
			>
				<span
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "8px",
						letterSpacing: "0.1em",
						color: highlight ? "#2d7a54" : "#9a9284",
						fontWeight: highlight ? 700 : 400,
					}}
				>
					#{rank}
				</span>
				<span
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "8px",
						color: "#9a9284",
						opacity: copied ? 1 : 0,
						transition: "opacity 0.2s",
					}}
				>
					copied
				</span>
			</div>
			{/* Sequence — smaller font so 22-char primers fit on one line */}
			<div
				style={{
					fontFamily: "var(--font-courier)",
					fontSize: "10px",
					color: "#1c1a16",
					letterSpacing: "0.04em",
					marginBottom: "5px",
					wordBreak: "break-all",
					lineHeight: 1.4,
				}}
			>
				{primer.seq}
			</div>
			<div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
				<Badge label="Tm" value={`${primer.tm.toFixed(1)}°`} warn={tmWarn} />
				<Badge label="GC" value={`${(primer.gc * 100).toFixed(0)}%`} warn={gcWarn} />
				<Badge label={`${primer.len}bp`} value="" />
				{!primer.gcClamp && <Badge label="clamp" value="weak" warn />}
				{hairpinWarn && <Badge label="hairpin" value={`${primer.hairpinDG.toFixed(1)}`} warn />}
				{selfDimerWarn && (
					<Badge label="3′ dimer" value={`${primer.selfDimerDG.toFixed(1)}`} warn />
				)}
				{primer.offTarget > 0 && <Badge label="off-target" value={`${primer.offTarget}`} warn />}
				<AccessBadge score={primer.templateAccessibility} />
			</div>
		</div>
	);
}

function formatLen(bp: number): string {
	if (bp >= 1000) return `${(bp / 1000).toFixed(1)} kb`;
	return `${bp} bp`;
}

// Assembly pair card — shows tail + annealing sequence with visual distinction
function AssemblyPairCard({ pair, rank }: { pair: AssemblyPrimerPair; rank: number }) {
	const [copiedFwd, setCopiedFwd] = useState(false);
	const [copiedRev, setCopiedRev] = useState(false);
	const [copiedAll, setCopiedAll] = useState(false);

	function copyFwd() {
		void navigator.clipboard.writeText(pair.fwd.fullSeq).then(() => {
			setCopiedFwd(true);
			setTimeout(() => setCopiedFwd(false), 1200);
		});
	}
	function copyRev() {
		void navigator.clipboard.writeText(pair.rev.fullSeq).then(() => {
			setCopiedRev(true);
			setTimeout(() => setCopiedRev(false), 1200);
		});
	}
	function copyBoth() {
		const text = `Fwd (${pair.fwd.fullSeq.length}bp total, ann Tm ${pair.fwd.tm.toFixed(1)}°C): ${pair.fwd.fullSeq}\nRev (${pair.rev.fullSeq.length}bp total, ann Tm ${pair.rev.tm.toFixed(1)}°C): ${pair.rev.fullSeq}`;
		void navigator.clipboard.writeText(text).then(() => {
			setCopiedAll(true);
			setTimeout(() => setCopiedAll(false), 1500);
		});
	}

	const isBest = rank === 1;

	function AssemblySeqLine({
		dir,
		tail,
		annealing,
		tm,
		fullPrimerTm,
		copied,
		onCopy,
	}: {
		dir: "→" | "←";
		tail: string;
		annealing: string;
		tm: number;
		fullPrimerTm: number;
		copied: boolean;
		onCopy: () => void;
	}) {
		return (
			<div
				onClick={onCopy}
				title={`Click to copy · ann ${tm.toFixed(1)}° · full ${fullPrimerTm.toFixed(1)}° · ${tail}${annealing}`}
				style={{
					display: "flex",
					alignItems: "center",
					gap: "5px",
					cursor: "pointer",
					padding: "2px 0",
				}}
			>
				<span
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "8px",
						color: "#9a9284",
						width: "9px",
						flexShrink: 0,
					}}
				>
					{dir}
				</span>
				<span
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "10px",
						letterSpacing: "0.04em",
						flex: 1,
						overflow: "hidden",
						whiteSpace: "nowrap",
						textOverflow: "ellipsis",
					}}
				>
					<span style={{ color: copied ? "#1a4731" : "#b8b0a4" }}>{tail}</span>
					<span style={{ color: copied ? "#1a4731" : "#1c1a16" }}>{annealing}</span>
				</span>
				<span
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "8px",
						color: "#9a9284",
						flexShrink: 0,
					}}
				>
					{fullPrimerTm.toFixed(1)}°
				</span>
			</div>
		);
	}

	return (
		<div
			style={{
				padding: "10px 12px",
				borderBottom: "1px solid rgba(221,216,206,0.5)",
				background: isBest ? "rgba(26,71,49,0.04)" : "transparent",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: "6px",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
					<span
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "9px",
							letterSpacing: "0.1em",
							color: isBest ? "#2d7a54" : "#9a9284",
							fontWeight: isBest ? 700 : 400,
						}}
					>
						#{rank}
					</span>
					<span style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#5a5648" }}>
						{formatLen(pair.productSize)}
					</span>
					<span style={{ color: "#ddd8ce" }}>·</span>
					<span style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#9a9284" }}>
						ann {pair.annealingTm.toFixed(1)}°
					</span>
					<span style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#b8b0a4" }}>
						{pair.fwd.tail.length}bp overlap
					</span>
				</div>
				<button
					type="button"
					onClick={copyBoth}
					style={{
						background: "none",
						border: "none",
						cursor: "pointer",
						padding: "0 2px",
						fontFamily: "var(--font-courier)",
						fontSize: "9px",
						color: copiedAll ? "#1a4731" : "#9a9284",
						transition: "color 0.15s",
					}}
				>
					{copiedAll ? "copied" : "copy"}
				</button>
			</div>
			<AssemblySeqLine
				dir="→"
				tail={pair.fwd.tail}
				annealing={pair.fwd.seq}
				tm={pair.fwd.tm}
				fullPrimerTm={pair.fwd.fullPrimerTm}
				copied={copiedFwd}
				onCopy={copyFwd}
			/>
			<AssemblySeqLine
				dir="←"
				tail={pair.rev.tail}
				annealing={pair.rev.seq}
				tm={pair.rev.tm}
				fullPrimerTm={pair.rev.fullPrimerTm}
				copied={copiedRev}
				onCopy={copyRev}
			/>
		</div>
	);
}

// ── PCR diagnosis helpers ─────────────────────────────────────────────────────

type DiagnoseState =
	| { status: "idle" }
	| { status: "running"; explanation: string }
	| { status: "done"; explanation: string }
	| { status: "error"; message: string };

function renderInline(text: string): React.ReactNode[] {
	return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, j) => {
		if (part.startsWith("**") && part.endsWith("**"))
			return <strong key={j}>{part.slice(2, -2)}</strong>;
		if (part.startsWith("`") && part.endsWith("`"))
			return (
				<code
					key={j}
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "10px",
						background: "rgba(26,71,49,0.08)",
						padding: "1px 3px",
						borderRadius: "2px",
					}}
				>
					{part.slice(1, -1)}
				</code>
			);
		return part;
	});
}

function renderDiagnoseMarkdown(text: string): React.ReactNode[] {
	const nodes: React.ReactNode[] = [];
	const lines = text.split("\n");
	let i = 0;
	while (i < lines.length) {
		const line = lines[i]!;
		// Strip markdown headings — render as a small label instead
		if (line.startsWith("## ") || line.startsWith("### ")) {
			const content = line.replace(/^#{2,3}\s+/, "");
			nodes.push(
				<p
					key={i}
					style={{
						margin: "10px 0 4px",
						fontFamily: "var(--font-courier)",
						fontSize: "8px",
						letterSpacing: "0.1em",
						textTransform: "uppercase",
						color: "#5a5648",
					}}
				>
					{content}
				</p>,
			);
			i++;
			continue;
		}
		// Bullet list lines
		if (line.startsWith("- ") || line.startsWith("* ")) {
			const items: React.ReactNode[] = [];
			while (i < lines.length && (lines[i]!.startsWith("- ") || lines[i]!.startsWith("* "))) {
				items.push(
					<li key={i} style={{ marginBottom: "2px" }}>
						{renderInline(lines[i]!.slice(2))}
					</li>,
				);
				i++;
			}
			nodes.push(
				<ul key={`ul-${i}`} style={{ paddingLeft: "16px", margin: "4px 0" }}>
					{items}
				</ul>,
			);
			continue;
		}
		// Empty line
		if (line.trim() === "") {
			nodes.push(<span key={i} style={{ display: "block", height: "6px" }} />);
			i++;
			continue;
		}
		// Regular paragraph line
		nodes.push(
			<p
				key={i}
				style={{
					margin: "0 0 8px",
					fontFamily: "var(--font-karla)",
					fontSize: "12px",
					color: "#1c1a16",
					lineHeight: 1.65,
				}}
			>
				{renderInline(line)}
			</p>,
		);
		i++;
	}
	return nodes;
}

function DiagnoseTypingDots() {
	return (
		<span style={{ display: "inline-flex", gap: "3px", alignItems: "center", padding: "4px 0" }}>
			{[0, 1, 2].map((i) => (
				<span
					key={i}
					style={{
						width: "4px",
						height: "4px",
						borderRadius: "50%",
						background: "#9a9284",
						display: "inline-block",
						animation: `diagnosePulse 1.2s ease-in-out ${i * 0.2}s infinite`,
					}}
				/>
			))}
		</span>
	);
}

function DiagnoseResultCard({
	state,
}: {
	state: Extract<DiagnoseState, { status: "running" | "done" }>;
}) {
	return (
		<div style={{ padding: "12px 14px" }}>
			<div
				style={{
					fontFamily: "var(--font-courier)",
					fontSize: "8px",
					letterSpacing: "0.1em",
					textTransform: "uppercase",
					color: "#5a5648",
					marginBottom: "10px",
				}}
			>
				PCR Diagnosis
			</div>
			<div>
				{state.explanation ? renderDiagnoseMarkdown(state.explanation) : <DiagnoseTypingDots />}
			</div>
		</div>
	);
}

export function PrimerPanel({
	seq,
	seqLen,
	topology = "linear",
	selectionStart,
	selectionEnd,
	onPrimersDesigned,
	annotationName,
	sequenceName,
	onShowPlots,
	onEditAnnotation,
}: PrimerPanelProps) {
	const [start, setStart] = useState<string>(
		selectionStart !== undefined ? String(selectionStart + 1) : String(Math.floor(seqLen / 3) + 1),
	);
	const [end, setEnd] = useState<string>(
		selectionEnd !== undefined
			? String(selectionEnd + 1)
			: String(Math.floor((seqLen * 2) / 3) + 1),
	);
	const [mode, setMode] = useState<"pcr" | "qpcr" | "assembly">("pcr");
	const [assemblyMethod, setAssemblyMethod] = useState<"gibson" | "golden_gate">("gibson");
	const [gibsonOverlap, setGibsonOverlap] = useState(20);
	const [ggEnzyme, setGgEnzyme] = useState<"BsaI" | "BbsI" | "BsmBI">("BsaI");
	const [assemblySearchExt, setAssemblySearchExt] = useState(200); // bp beyond region to search
	const [pairs, setPairs] = useState<DesignPair[] | null>(null);
	const [assemblyPairs, setAssemblyPairs] = useState<AssemblyPrimerPair[] | null>(null);
	const [focusedPairIndex, setFocusedPairIndex] = useState(0);
	const [warning, setWarning] = useState<string | null>(null);
	const [running, setRunning] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// Per-mode result cache — switching modes saves current results and restores the new
	// mode's last results instead of clearing. Design run clears and replaces.
	type PrimerMode = "pcr" | "qpcr" | "assembly";
	type ModeResult = { pairs: DesignPair[] | null; assemblyPairs: AssemblyPrimerPair[] | null; warning: string | null };
	const [modeResultCache, setModeResultCache] = useState<Partial<Record<PrimerMode, ModeResult>>>({});
	// Which mode generated the currently displayed results
	const [resultsMode, setResultsMode] = useState<PrimerMode | null>(null);
	const workerRef = useRef<Worker | null>(null);

	// Design parameters — shown in collapsible Options section
	const [optionsOpen, setOptionsOpen] = useState(false);
	const [indivOpen, setIndivOpen] = useState(false);
	const [tmTarget, setTmTarget] = useState(60);
	const [minLen, setMinLen] = useState(18);
	const [maxLen, setMaxLen] = useState(27);
	const [gcMin, setGcMin] = useState(40);
	const [gcMax, setGcMax] = useState(65);
	// qPCR-specific parameters
	const [qpcrAmpliconMin, setQpcrAmpliconMin] = useState(70);
	const [qpcrAmpliconMax, setQpcrAmpliconMax] = useState(200);
	// Shared: max Tm difference between fwd and rev primers (stricter for qPCR)
	const [maxTmDiff, setMaxTmDiff] = useState(3);
	const [diagnoseState, setDiagnoseState] = useState<DiagnoseState>({ status: "idle" });
	const abortDiagnoseRef = useRef<AbortController | null>(null);
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			abortDiagnoseRef.current?.abort();
		};
	}, []);

	useEffect(() => {
		if (selectionStart !== undefined) setStart(String(selectionStart + 1));
	}, [selectionStart]);
	useEffect(() => {
		if (selectionEnd !== undefined) setEnd(String(selectionEnd + 1));
	}, [selectionEnd]);

	// Terminate any in-flight worker on unmount
	useEffect(
		() => () => {
			workerRef.current?.terminate();
		},
		[],
	);

	// Keyboard shortcuts:
	//   ↑/↓  — navigate ranked primer pairs (when not in an input)
	//   Escape — clear results
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			const el = document.activeElement as HTMLElement | null;
			const tag = el?.tagName?.toUpperCase();
			const inInput =
				tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
				el?.contentEditable === "true" ||
				!!el?.closest('[contenteditable="true"]');

			if (e.key === "Escape" && !inInput) {
				if (running) {
					workerRef.current?.terminate();
					workerRef.current = null;
					setRunning(false);
					setError(null);
				} else {
					setPairs(null);
					setAssemblyPairs(null);
					setWarning(null);
					setFocusedPairIndex(0);
				}
				return;
			}

			const pairCount = pairs?.length ?? 0;
			if (pairCount === 0 || inInput) return;

			if (e.key === "ArrowDown") {
				e.preventDefault();
				setFocusedPairIndex((i) => {
					const next = Math.min(i + 1, pairCount - 1);
					document.getElementById(`pair-card-${next}`)?.scrollIntoView({ block: "nearest" });
					return next;
				});
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setFocusedPairIndex((i) => {
					const next = Math.max(i - 1, 0);
					document.getElementById(`pair-card-${next}`)?.scrollIntoView({ block: "nearest" });
					return next;
				});
			}
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [pairs, running]);

	// Core worker launch — accepts explicit 1-indexed coords so annotation auto-run
	// can bypass state (which may not yet reflect the latest selectionStart/End props).
	// Handles circular origin-spanning selections by rotating the sequence.
	const runDesign = useCallback(
		(s: number, e: number, overrides?: { maxTmDiff?: number; qpcrAmpliconMin?: number; qpcrAmpliconMax?: number }) => {
			// Always clear any previous diagnosis when a new design is attempted
			setDiagnoseState({ status: "idle" });
			abortDiagnoseRef.current?.abort();

			// Allow s > e on circular plasmids (selection wraps the origin)
			const isWrapping = topology === "circular" && s > e && s >= 1 && e >= 1;
			if (Number.isNaN(s) || Number.isNaN(e) || s < 1) {
				setError("Enter a valid start/end (1-indexed).");
				return;
			}
			if (e > seqLen) {
				setError(
					topology === "circular"
						? "End exceeds sequence length. For origin-spanning regions, set Start > End (e.g. Start 2500, End 100)."
						: "End exceeds sequence length.",
				);
				return;
			}
			if (s >= e && !isWrapping) {
				setError(
					topology === "circular"
						? "Start must be less than End, or use Start > End for origin-spanning regions."
						: "Start must be less than End.",
				);
				return;
			}
			setError(null);
			setWarning(null);
			setRunning(true);
			onPrimersDesigned?.(null);

			workerRef.current?.terminate();

			// Rotation for circular origin-spanning selections:
			// Rotate the sequence so the wrapped region becomes contiguous,
			// then un-rotate primer positions in the onmessage handler.
			let workSeq = seq;
			let workRegionStart = s - 1; // 0-indexed
			let workRegionEnd = e; // 0-indexed half-open
			let regionLen = e - s;
			let rotPoint = 0;

			if (isWrapping) {
				// Region: [s-1 .. seqLen-1] ++ [0 .. e-1]
				regionLen = seqLen - (s - 1) + e;
				// Rotate so there's ~500 bp of flanking before the region start
				const flank = Math.min(500, Math.floor((seqLen - regionLen) / 2));
				rotPoint = (s - 1 - flank + seqLen) % seqLen;
				workSeq = seq.slice(rotPoint) + seq.slice(0, rotPoint);
				workRegionStart = flank;
				workRegionEnd = flank + regionLen;
			}

			// Capture rotation info in closure for un-rotation in onmessage
			const capturedRotPoint = rotPoint;
			const capturedSeqLen = seqLen;

			const worker = new Worker(new URL("./primer-design.worker.ts", import.meta.url));
			workerRef.current = worker;

			const req: PrimerWorkerRequest = {
				seq: workSeq,
				regionStart: workRegionStart,
				regionEnd: workRegionEnd,
				mode,
				opts: {
					...(mode === "pcr"
						? { productSizeRange: [regionLen + 36, regionLen + 500] as [number, number] }
						: {}),
					...(mode === "qpcr"
						? {
								productSizeRange: [
									overrides?.qpcrAmpliconMin ?? qpcrAmpliconMin,
									overrides?.qpcrAmpliconMax ?? qpcrAmpliconMax,
								] as [number, number],
								maxTmDiff: overrides?.maxTmDiff ?? maxTmDiff,
							}
						: {}),
					tmTarget,
					primerLenRange: [minLen, maxLen] as [number, number],
					gcRange: [gcMin / 100, gcMax / 100] as [number, number],
				},
				...(mode === "assembly"
					? {
							assemblyOpts: {
								method: assemblyMethod,
								annealingLenRange: [minLen, maxLen] as [number, number],
								productSizeRange: [
									Math.max(100, regionLen + 10),
									regionLen + assemblySearchExt,
								] as [number, number],
								...(assemblyMethod === "gibson"
									? { gibsonOverlap }
									: { ggEnzymeSite: GG_ENZYME_SITES[ggEnzyme] }),
							},
						}
					: {}),
			};
			worker.postMessage(req);

			worker.onmessage = (ev: MessageEvent<PrimerWorkerResponse>) => {
				worker.terminate();
				workerRef.current = null;
				const msg = ev.data;
				if (msg.type === "success") {
					setResultsMode(mode);
					setFocusedPairIndex(0);
					if (msg.mode === "assembly") {
						// Assembly results — no position un-rotation needed (tails don't affect coords)
						const asmPairs = msg.result.pairs as AssemblyPrimerPair[];
						setAssemblyPairs(asmPairs);
						onPrimersDesigned?.(
							asmPairs[0]
								? { ...asmPairs[0].fwd, ...asmPairs[0], heteroDimerDG: 0, tmDiff: 0, penalty: 0 }
								: null,
						);
					} else {
						// PCR / qPCR — un-rotate primer positions back to original coordinate space
						let resultPairs = msg.result.pairs as DesignPair[];
						if (capturedRotPoint !== 0) {
							const unrotate = (pos: number) => (pos + capturedRotPoint) % capturedSeqLen;
							resultPairs = resultPairs.map((pair) => ({
								...pair,
								fwd: { ...pair.fwd, start: unrotate(pair.fwd.start), end: unrotate(pair.fwd.end) },
								rev: { ...pair.rev, start: unrotate(pair.rev.start), end: unrotate(pair.rev.end) },
							}));
						}
						setPairs(resultPairs);
						onPrimersDesigned?.(resultPairs[0] ?? null);
					}
					if (msg.result.warning) setWarning(msg.result.warning);
				} else {
					// msg.message carries the actual primd error — show it directly
					// when it's short and user-readable (e.g. input validation),
					// otherwise compose a context-rich fallback.
					const modeLabel = mode === "qpcr" ? "qPCR" : mode === "assembly" ? "Assembly" : "PCR";
					const regionStr = `region ${s}–${e}`;
					const hint =
						mode === "qpcr"
							? "Try increasing Max ΔTm or widening the amplicon range in Options."
							: mode === "assembly"
								? "Try increasing Search ± or check that the template is complete."
								: "Try widening GC %, relaxing Tm target, or selecting a larger region.";
					const reason =
						msg.message && msg.message.length < 200 && !msg.message.includes("at ")
							? msg.message
							: `${modeLabel} design failed for ${regionStr}. ${hint}`;
					setError(reason);
					onPrimersDesigned?.(null);
				}
				setRunning(false);
			};

			worker.onerror = () => {
				worker.terminate();
				workerRef.current = null;
				setError("Primer worker crashed. Try a shorter region, or reload the page if the problem persists.");
				onPrimersDesigned?.(null);
				setRunning(false);
			};
		},
		[
			seq,
			seqLen,
			topology,
			mode,
			onPrimersDesigned,
			tmTarget,
			minLen,
			maxLen,
			gcMin,
			gcMax,
			assemblyMethod,
			gibsonOverlap,
			ggEnzyme,
			assemblySearchExt,
		],
	);

	// Stable ref so the annotation effect always calls the latest runDesign
	const runDesignRef = useRef(runDesign);
	runDesignRef.current = runDesign;

	const design = useCallback((overrides?: { maxTmDiff?: number; qpcrAmpliconMin?: number; qpcrAmpliconMax?: number }) => {
		const s = parseInt(start, 10);
		const e = parseInt(end, 10);
		runDesign(s, e, overrides);
	}, [start, end, runDesign]);

	// Auto-design when an annotation is clicked — use prop coords directly to avoid
	// the timing gap between selectionStart/End props updating and start/end state settling.
	useEffect(() => {
		if (!annotationName || selectionStart === undefined || selectionEnd === undefined) return;
		// selectionStart/End are 0-indexed from SeqViz; runDesign expects 1-indexed
		runDesignRef.current(selectionStart + 1, selectionEnd + 1);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [annotationName, selectionStart, selectionEnd]);

	const runDiagnosis = useCallback(async () => {
		const best = pairs?.[0];
		const bestAsm = assemblyPairs?.[0];
		if (!best && !bestAsm) return;

		abortDiagnoseRef.current?.abort();
		setDiagnoseState({ status: "running", explanation: "" });

		const ac = new AbortController();
		abortDiagnoseRef.current = ac;

		try {
			const res = await fetch("/api/diagnose-pcr", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(
					best
						? {
								mode,
								tmTarget,
								fwd: {
									seq: best.fwd.seq,
									tm: best.fwd.tm,
									gc: best.fwd.gc,
									len: best.fwd.len,
									hairpinDG: best.fwd.hairpinDG,
									selfDimerDG: best.fwd.selfDimerDG,
									accessibility: best.fwd.templateAccessibility,
									start: best.fwd.start,
								},
								rev: {
									seq: best.rev.seq,
									tm: best.rev.tm,
									gc: best.rev.gc,
									len: best.rev.len,
									hairpinDG: best.rev.hairpinDG,
									selfDimerDG: best.rev.selfDimerDG,
									accessibility: best.rev.templateAccessibility,
									start: best.rev.start,
								},
								productSize: best.productSize,
								tmDiff: best.tmDiff,
								heteroDimerDG: best.heteroDimerDG,
								context: {
									sequenceName: sequenceName ?? "Sequence",
									seqLen,
									topology,
									regionLen: (() => {
										const s = parseInt(start, 10);
										const e = parseInt(end, 10);
										if (Number.isNaN(s) || Number.isNaN(e)) return 0;
										if (topology === "circular" && s > e && s >= 1 && e >= 1)
											return seqLen - (s - 1) + e;
										return e > s ? e - s : 0;
									})(),
								},
							}
						: {
								mode: "assembly",
								tmTarget,
								fwd: {
									seq: bestAsm!.fwd.tail + bestAsm!.fwd.seq,
									tm: bestAsm!.fwd.tm,
									gc: 0.5,
									len: (bestAsm!.fwd.tail + bestAsm!.fwd.seq).length,
									hairpinDG: 0,
									selfDimerDG: 0,
									accessibility: 1,
									start: 0,
								},
								rev: {
									seq: bestAsm!.rev.tail + bestAsm!.rev.seq,
									tm: bestAsm!.rev.tm,
									gc: 0.5,
									len: (bestAsm!.rev.tail + bestAsm!.rev.seq).length,
									hairpinDG: 0,
									selfDimerDG: 0,
									accessibility: 1,
									start: 0,
								},
								productSize: bestAsm!.productSize,
								tmDiff: 0,
								heteroDimerDG: 0,
								context: {
									sequenceName: sequenceName ?? "Sequence",
									seqLen,
									topology,
									regionLen: (() => {
										const s = parseInt(start, 10);
										const e = parseInt(end, 10);
										if (Number.isNaN(s) || Number.isNaN(e)) return 0;
										if (topology === "circular" && s > e && s >= 1 && e >= 1)
											return seqLen - (s - 1) + e;
										return e > s ? e - s : 0;
									})(),
								},
							},
				),
				signal: ac.signal,
			});

			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			if (!res.body) throw new Error("No response body");

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let text = "";
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				text += decoder.decode(value, { stream: true });
				if (mountedRef.current) setDiagnoseState({ status: "running", explanation: text });
			}
			if (mountedRef.current) setDiagnoseState({ status: "done", explanation: text });
		} catch (e) {
			if ((e as Error).name === "AbortError") return;
			if (mountedRef.current)
				setDiagnoseState({ status: "error", message: (e as Error).message });
		}
	}, [pairs, assemblyPairs, mode, tmTarget, sequenceName, seqLen, topology, start, end]);

	const s = parseInt(start, 10);
	const e = parseInt(end, 10);
	const isWrapping =
		topology === "circular" && !Number.isNaN(s) && !Number.isNaN(e) && s > e && s >= 1 && e >= 1;
	const regionLen =
		!Number.isNaN(s) && !Number.isNaN(e)
			? isWrapping
				? seqLen - (s - 1) + e // wrapping: [s..seqLen] + [1..e]
				: e > s
					? e - s + 1
					: null
			: null;

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
			{/* Controls */}
			<div style={{ padding: "14px 16px 12px", borderBottom: "1px solid #ddd8ce", flexShrink: 0 }}>
				<div
					style={{
						display: "flex",
						alignItems: "baseline",
						justifyContent: "space-between",
						marginBottom: "12px",
					}}
				>
					<span
						style={{
							fontFamily: "var(--font-karla)",
							fontSize: "14px",
							fontWeight: 600,
							color: "#1c1a16",
							letterSpacing: "normal",
						}}
					>
						Primers
					</span>
					{annotationName ? (
						<span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
							<span
								style={{
									fontFamily: "var(--font-courier)",
									fontSize: "9px",
									color: "#2d7a54",
									background: "rgba(45,122,84,0.07)",
									border: "1px solid rgba(45,122,84,0.2)",
									borderRadius: "2px",
									padding: "1px 6px",
									letterSpacing: "0.04em",
								}}
							>
								{annotationName}
							</span>
							{onEditAnnotation && (
								<button
									type="button"
									onClick={onEditAnnotation}
									title="Edit this annotation"
									aria-label="Edit this annotation"
									style={{
										fontFamily: "var(--font-courier)",
										fontSize: "10px",
										color: "#9a9284",
										background: "none",
										border: "none",
										cursor: "pointer",
										padding: "0 1px",
										lineHeight: 1,
										flexShrink: 0,
									}}
								>
									✎
								</button>
							)}
						</span>
					) : selectionStart !== undefined ? (
						<span style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#9a9284" }}>
							from selection
						</span>
					) : null}
				</div>

				{/* Mode toggle: PCR / qPCR / Assembly */}
				<div style={{ display: "flex", gap: "3px", marginBottom: "10px" }}>
					{(["pcr", "qpcr", "assembly"] as const).map((m) => (
						<button
							key={m}
							type="button"
							onClick={() => {
								// Save current mode's results before leaving
								setModeResultCache(prev => ({
									...prev,
									[mode]: { pairs, assemblyPairs, warning },
								}));
								// Restore the new mode's cached results (null if never run)
								const cached = modeResultCache[m];
								setPairs(cached?.pairs ?? null);
								setAssemblyPairs(cached?.assemblyPairs ?? null);
								setWarning(cached?.warning ?? null);
								setMode(m);
								setError(null);
								setDiagnoseState({ status: "idle" });
								abortDiagnoseRef.current?.abort();
								// Auto-open Options in Assembly mode so overlap/enzyme/search
								// controls are visible without an extra click
								if (m === "assembly") setOptionsOpen(true);
							}}
							style={{
								padding: "3px 10px",
								fontFamily: "var(--font-courier)",
								fontSize: "8px",
								letterSpacing: "0.1em",
								textTransform: "uppercase",
								background: mode === m ? "#1a4731" : "transparent",
								color: mode === m ? "white" : "#9a9284",
								border: `1px solid ${mode === m ? "#1a4731" : "#ddd8ce"}`,
								borderRadius: "2px",
								cursor: "pointer",
								transition: "background 0.12s, color 0.12s",
							}}
						>
							{m === "qpcr" ? "qPCR" : m === "assembly" ? "Assembly" : "PCR"}
						</button>
					))}
					{mode === "qpcr" && (
						<span
							style={{
								fontFamily: "var(--font-courier)",
								fontSize: "8px",
								color: "#9a9284",
								alignSelf: "center",
								marginLeft: "4px",
							}}
						>
							{qpcrAmpliconMin}–{qpcrAmpliconMax} bp
						</span>
					)}
				</div>

				{/* Assembly method toggle — primary choice, always visible in Assembly mode */}
				{mode === "assembly" && (
					<div
						style={{
							display: "flex",
							gap: "0",
							marginBottom: "8px",
							border: "1px solid #ddd8ce",
							borderRadius: "3px",
							overflow: "hidden",
						}}
					>
						{(["gibson", "golden_gate"] as const).map((m) => (
							<button
								key={m}
								type="button"
								onClick={() => setAssemblyMethod(m)}
								style={{
									flex: 1,
									fontFamily: "var(--font-courier)",
									fontSize: "9px",
									letterSpacing: "0.08em",
									textTransform: "uppercase",
									color: assemblyMethod === m ? "white" : "#9a9284",
									background: assemblyMethod === m ? "#1a4731" : "transparent",
									border: "none",
									cursor: "pointer",
									padding: "6px 0",
									transition: "background 0.12s, color 0.12s",
								}}
							>
								{m === "gibson" ? "Gibson" : "Golden Gate"}
							</button>
						))}
					</div>
				)}


				<div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
					{[
						["Start", start, setStart],
						["End", end, setEnd],
					].map(([label, val, setter]) => (
						<div key={label as string} style={{ flex: 1 }}>
							<div
								style={{
									fontFamily: "var(--font-courier)",
									fontSize: "8px",
									letterSpacing: "0.1em",
									textTransform: "uppercase",
									color: "#9a9284",
									marginBottom: "4px",
								}}
							>
								{label as string}
							</div>
							<input
								type="number"
								value={val as string}
								min={1}
								max={seqLen}
								onChange={(ev) => (setter as (v: string) => void)(ev.target.value)}
								onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); design(); } }}
								style={{
									width: "100%",
									padding: "5px 8px",
									fontFamily: "var(--font-courier)",
									fontSize: "11px",
									color: "#1c1a16",
									background: "#f5f0e8",
									border: "1px solid #ddd8ce",
									borderRadius: "3px",
									outline: "none",
								}}
							/>
						</div>
					))}
				</div>

				<div
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "9px",
						color: "#9a9284",
						marginBottom: "8px",
					}}
				>
					{regionLen !== null ? (
						<>
							Region: <span style={{ color: "#5a5648" }}>{formatLen(regionLen)}</span>
							{isWrapping && (
								<span
									title="This selection crosses position 0 on the circular plasmid. The sequence will be rotated internally so primers can be placed correctly."
									style={{ color: "#b8933a", cursor: "help" }}
								>
									{" "}
									· wraps origin ↻
								</span>
							)}
							{!isWrapping && (mode === "qpcr"
							? ` · amplicon ${qpcrAmpliconMin}–${qpcrAmpliconMax} bp within region`
							: " · primers flank selection")}
						</>
					) : (
						<span style={{ color: "#b8b0a4" }}>
							Primers will be placed flanking the selected region
						</span>
					)}
				</div>

				{/* Collapsible options */}
				<div style={{ marginBottom: "8px" }}>
					<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
						<button
							type="button"
							onClick={() => setOptionsOpen((o) => !o)}
							style={{
								display: "flex",
								alignItems: "center",
								gap: "4px",
								background: "none",
								border: "none",
								cursor: "pointer",
								fontFamily: "var(--font-courier)",
								fontSize: "8px",
								letterSpacing: "0.1em",
								textTransform: "uppercase",
								color: optionsOpen ? "#5a5648" : "#9a9284",
								padding: "2px 0",
							}}
						>
							<span
								style={{
									fontSize: "7px",
									transition: "transform 0.15s",
									display: "inline-block",
									transform: optionsOpen ? "rotate(90deg)" : "rotate(0deg)",
								}}
							>
								▶
							</span>
							Options
						</button>
						{optionsOpen && (
							<button
								type="button"
								onClick={() => {
									setTmTarget(60);
									setMinLen(18);
									setMaxLen(27);
									setGcMin(40);
									setGcMax(65);
									setMaxTmDiff(3);
									setQpcrAmpliconMin(70);
									setQpcrAmpliconMax(200);
								}}
								style={{
									background: "none",
									border: "none",
									cursor: "pointer",
									fontFamily: "var(--font-courier)",
									fontSize: "8px",
									color: "#9a9284",
									letterSpacing: "0.04em",
									padding: "2px 0",
								}}
							>
								reset
							</button>
						)}
					</div>

					{optionsOpen &&
						(() => {
							const numStyle: React.CSSProperties = {
								width: "44px",
								padding: "3px 5px",
								fontFamily: "var(--font-courier)",
								fontSize: "11px",
								color: "#1c1a16",
								background: "#f5f0e8",
								border: "1px solid #ddd8ce",
								borderRadius: "3px",
								outline: "none",
								textAlign: "center",
							};
							const labelStyle: React.CSSProperties = {
								fontFamily: "var(--font-courier)",
								fontSize: "8px",
								letterSpacing: "0.06em",
								color: "#9a9284",
								minWidth: "52px",
							};
							const unitStyle: React.CSSProperties = {
								fontFamily: "var(--font-courier)",
								fontSize: "8px",
								color: "#b8b0a4",
							};
							const rowStyle: React.CSSProperties = {
								display: "flex",
								alignItems: "center",
								gap: "6px",
								marginTop: "6px",
							};
							return (
								<div style={{ paddingTop: "2px" }}>
									{/* Tm target */}
									<div style={rowStyle}>
										<span style={labelStyle} title="Target melting temperature for primer hybridization. Higher Tm means more stable binding. Standard PCR: 58–62°C. Default: 60°C.">Tm target</span>
										<input
											type="number"
											value={tmTarget}
											min={50}
											max={72}
											step={1}
											onChange={(e) =>
												setTmTarget(Math.max(50, Math.min(72, parseInt(e.target.value, 10) || 60)))
											}
											style={numStyle}
										/>
										<span style={unitStyle}>°C</span>
									</div>
									{/* Primer length */}
									<div style={rowStyle}>
										<span style={labelStyle} title="Primer length range in bases. Shorter primers bind less specifically; longer primers can form hairpins. Default: 18–27 bp.">Length</span>
										<input
											type="number"
											value={minLen}
											min={15}
											max={35}
											step={1}
											onChange={(e) =>
												setMinLen(
													Math.max(15, Math.min(parseInt(e.target.value, 10) || 18, maxLen)),
												)
											}
											style={numStyle}
										/>
										<span style={unitStyle}>–</span>
										<input
											type="number"
											value={maxLen}
											min={15}
											max={35}
											step={1}
											onChange={(e) =>
												setMaxLen(
													Math.min(35, Math.max(parseInt(e.target.value, 10) || 27, minLen)),
												)
											}
											style={numStyle}
										/>
										<span style={unitStyle}>bp</span>
									</div>
									{/* GC range */}
									<div style={rowStyle}>
										<span style={labelStyle} title="GC content range (fraction of G and C bases). Higher GC raises Tm and binding stability; very high GC increases hairpin risk. Default: 40–65%.">GC %</span>
										<input
											type="number"
											value={gcMin}
											min={10}
											max={90}
											step={5}
											onChange={(e) =>
												setGcMin(
													Math.max(10, Math.min(parseInt(e.target.value, 10) || 40, gcMax - 5)),
												)
											}
											style={numStyle}
										/>
										<span style={unitStyle}>–</span>
										<input
											type="number"
											value={gcMax}
											min={10}
											max={90}
											step={5}
											onChange={(e) =>
												setGcMax(
													Math.min(90, Math.max(parseInt(e.target.value, 10) || 65, gcMin + 5)),
												)
											}
											style={numStyle}
										/>
										<span style={unitStyle}>%</span>
									</div>
									{/* Max ΔTm — shown for all modes (stricter for qPCR) */}
									<div style={rowStyle}>
										<span style={labelStyle} title="Maximum allowed melting temperature difference between forward and reverse primers. Large ΔTm causes uneven annealing and reduces efficiency. Default: 3°C.">Max ΔTm</span>
										<input
											type="number"
											value={maxTmDiff}
											min={0.5}
											max={10}
											step={0.5}
											onChange={(e) =>
												setMaxTmDiff(
													Math.max(0.5, Math.min(10, parseFloat(e.target.value) || 3)),
												)
											}
											style={numStyle}
										/>
										<span style={unitStyle}>°C</span>
									</div>
									{/* qPCR-specific: amplicon size range */}
									{mode === "qpcr" && (
										<div style={rowStyle}>
											<span style={labelStyle} title="Target amplicon size for qPCR. Smaller amplicons (70–150 bp) give more reliable quantification and work better across GC extremes. Default: 70–200 bp.">Amplicon</span>
											<input
												type="number"
												value={qpcrAmpliconMin}
												min={50}
												max={300}
												step={10}
												onChange={(e) =>
													setQpcrAmpliconMin(
														Math.max(50, Math.min(parseInt(e.target.value, 10) || 70, qpcrAmpliconMax - 20)),
													)
												}
												style={numStyle}
											/>
											<span style={unitStyle}>–</span>
											<input
												type="number"
												value={qpcrAmpliconMax}
												min={50}
												max={300}
												step={10}
												onChange={(e) =>
													setQpcrAmpliconMax(
														Math.min(300, Math.max(parseInt(e.target.value, 10) || 200, qpcrAmpliconMin + 20)),
													)
												}
												style={numStyle}
											/>
											<span style={unitStyle}>bp</span>
										</div>
									)}
									{/* Assembly: overlap/enzyme and search extension */}
									{mode === "assembly" && (
										<>
											{assemblyMethod === "gibson" ? (
												<div style={rowStyle}>
													<span style={labelStyle} title="Length of shared sequence between adjacent fragments in Gibson Assembly. Longer overlaps (≥20 bp) improve ligation efficiency; keep below 40 bp to avoid recombination artifacts. Default: 20 bp.">Overlap</span>
													<input
														type="number"
														value={gibsonOverlap}
														min={10}
														max={40}
														step={1}
														onChange={(e) => setGibsonOverlap(Math.max(10, Math.min(40, Number(e.target.value))))}
														style={numStyle}
													/>
													<span style={unitStyle}>bp</span>
												</div>
											) : (
												<div style={rowStyle}>
													<span style={labelStyle} title="Type IIS restriction enzyme for Golden Gate cloning. BsaI (GGTCTC) is most common; choose BbsI or BsmBI if your insert contains internal BsaI sites.">Enzyme</span>
													<select
														value={ggEnzyme}
														onChange={(e) => setGgEnzyme(e.target.value as "BsaI" | "BbsI" | "BsmBI")}
														style={{
															padding: "3px 5px",
															fontFamily: "var(--font-courier)",
															fontSize: "11px",
															color: "#1c1a16",
															background: "#f5f0e8",
															border: "1px solid #ddd8ce",
															borderRadius: "3px",
															outline: "none",
														}}
													>
														<option value="BsaI">BsaI</option>
														<option value="BbsI">BbsI</option>
														<option value="BsmBI">BsmBI</option>
													</select>
												</div>
											)}
											<div style={rowStyle}>
												<span style={labelStyle} title="Extra flanking sequence beyond the target region to search for primer annealing sites. Increase if AT-rich flanking prevents primers from landing within range. Default: 200 bp.">Search ±</span>
												<input
													type="number"
													value={assemblySearchExt}
													min={100}
													max={2000}
													step={100}
													onChange={(e) => setAssemblySearchExt(Math.max(100, Math.min(2000, Number(e.target.value))))}
													style={{ ...numStyle, width: "52px" }}
												/>
												<span style={unitStyle}>bp</span>
											</div>
										</>
									)}
								</div>
							);
						})()}
				</div>

				{error && (
					<div
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "10px",
							color: "#8b3a2a",
							background: "rgba(139,58,42,0.06)",
							border: "1px solid rgba(139,58,42,0.2)",
							borderRadius: "3px",
							padding: "6px 8px",
							marginBottom: "8px",
						}}
					>
						{error}
					</div>
				)}

				{running ? (
					<button
						type="button"
						onClick={() => {
							workerRef.current?.terminate();
							workerRef.current = null;
							setRunning(false);
							setError(null);
						}}
						style={{
							width: "100%",
							padding: "8px",
							background: "rgba(184,147,58,0.06)",
							color: "#b8933a",
							fontFamily: "var(--font-courier)",
							fontSize: "9px",
							letterSpacing: "0.12em",
							textTransform: "uppercase",
							border: "1px solid rgba(184,147,58,0.35)",
							borderRadius: "3px",
							cursor: "pointer",
							transition: "background 0.1s",
						}}
					>
						× Cancel
					</button>
				) : (
					<button
						type="button"
						onClick={() => design()}
						style={{
							width: "100%",
							padding: "8px",
							background: "#1a4731",
							color: "white",
							fontFamily: "var(--font-courier)",
							fontSize: "9px",
							letterSpacing: "0.12em",
							textTransform: "uppercase",
							border: "none",
							borderRadius: "3px",
							cursor: "pointer",
							transition: "opacity 0.15s",
						}}
					>
						{mode === "qpcr"
							? "Design qPCR Primers"
							: mode === "assembly"
								? "Design Assembly Primers"
								: "Design Primers"}
					</button>
				)}
				<div
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "7.5px",
						color: "#5a5648",
						letterSpacing: "0.04em",
						textAlign: "right",
						marginTop: "4px",
					}}
				>
					⏎ design · ↑↓ navigate · Esc cancel/clear
				</div>
			</div>

			{/* Results — or diagnosis card when active */}
			<div style={{ flex: 1, overflowY: "auto" }}>
				{/* Stale results banner — shown when cached results are from a different mode */}
				{diagnoseState.status === "idle" && resultsMode !== null && resultsMode !== mode && !!(pairs?.length ?? assemblyPairs?.length) && (
					<div
						style={{
							padding: "7px 12px",
							background: "rgba(184,147,58,0.06)",
							borderBottom: "1px solid rgba(184,147,58,0.18)",
							fontFamily: "var(--font-courier)",
							fontSize: "8px",
							color: "#b8933a",
							letterSpacing: "0.04em",
						}}
					>
						{resultsMode === "qpcr" ? "qPCR" : resultsMode === "assembly" ? "Assembly" : "PCR"} results cached · click Design to run {mode === "qpcr" ? "qPCR" : mode === "assembly" ? "Assembly" : "PCR"}
					</div>
				)}
				{diagnoseState.status !== "idle" ? (
					diagnoseState.status === "error" ? (
						<div
							style={{
								padding: "16px 12px",
								fontFamily: "var(--font-courier)",
								fontSize: "9px",
								color: "#a02828",
								lineHeight: 1.6,
							}}
						>
							{diagnoseState.message}
						</div>
					) : (
						<DiagnoseResultCard state={diagnoseState} />
					)
				) : (
				<>
				{assemblyPairs !== null && assemblyPairs.length > 0 && (
					<>
						<div
							style={{
								padding: "6px 12px 4px",
								background: "#f5f0e8",
								borderBottom: "1px solid #ddd8ce",
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
							}}
						>
							<span
								style={{
									fontFamily: "var(--font-courier)",
									fontSize: "8px",
									letterSpacing: "0.12em",
									textTransform: "uppercase",
									color: "#5a5648",
								}}
							>
								Pairs
							</span>
							<span
								style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#9a9284" }}
							>
								{assemblyPairs.length} · muted ={" "}
								{assemblyMethod === "gibson" ? `${gibsonOverlap}bp overlap` : `${ggEnzyme} site`}
							</span>
						</div>
						{assemblyPairs.map((pair, i) => (
							<AssemblyPairCard key={i} pair={pair} rank={i + 1} />
						))}
					</>
				)}

				{pairs === null && assemblyPairs === null && !running && (
					<div
						style={{
							padding: "28px 16px",
							fontFamily: "var(--font-courier)",
							fontSize: "10px",
							color: "#9a9284",
							textAlign: "center",
							lineHeight: 1.7,
						}}
					>
						Select a region in the viewer
						<br />
						or enter coordinates above,
						<br />
						then click Design Primers.
					</div>
				)}

				{warning && (
					<div style={{ margin: "10px 12px 0" }}>
						<div
							style={{
								padding: "6px 10px",
								background: "rgba(184,147,58,0.08)",
								border: "1px solid rgba(184,147,58,0.25)",
								borderRadius: "3px",
								fontFamily: "var(--font-courier)",
								fontSize: "9px",
								color: "#b8933a",
								lineHeight: 1.5,
							}}
						>
							{mode === "assembly" && warning.includes("no compatible pairs")
								? `No primer sites found within ${assemblySearchExt} bp of the target boundaries — the flanking sequence may be AT-rich. Try increasing the Search ± range in Options.`
								: mode === "qpcr" && warning.includes("product size range")
									? warning
											.replace("maxTmDiff", "Max ΔTm")
											.replace("product size range", "Amplicon size range")
									: warning}
						</div>
						{/* qPCR quick-fix buttons — appear when primd can't find compatible pairs */}
						{mode === "qpcr" && warning.includes("no compatible pairs") && (
							<div
								style={{
									display: "flex",
									gap: "6px",
									marginTop: "6px",
								}}
							>
								<button
									type="button"
									onClick={() => {
										const next = maxTmDiff + 1;
										setMaxTmDiff(next);
										design({ maxTmDiff: next });
									}}
									style={{
										flex: 1,
										fontFamily: "var(--font-courier)",
										fontSize: "8px",
										letterSpacing: "0.06em",
										textTransform: "uppercase",
										background: "rgba(184,147,58,0.1)",
										border: "1px solid rgba(184,147,58,0.35)",
										borderRadius: "2px",
										color: "#b8933a",
										cursor: "pointer",
										padding: "4px 0",
									}}
									title={`Increase Max ΔTm from ${maxTmDiff}° to ${maxTmDiff + 1}° and retry`}
								>
									Relax ΔTm (+1°)
								</button>
								<button
									type="button"
									onClick={() => {
										const nextMin = Math.max(50, qpcrAmpliconMin - 20);
										const nextMax = Math.min(300, qpcrAmpliconMax + 50);
										setQpcrAmpliconMin(nextMin);
										setQpcrAmpliconMax(nextMax);
										design({ qpcrAmpliconMin: nextMin, qpcrAmpliconMax: nextMax });
									}}
									style={{
										flex: 1,
										fontFamily: "var(--font-courier)",
										fontSize: "8px",
										letterSpacing: "0.06em",
										textTransform: "uppercase",
										background: "rgba(184,147,58,0.1)",
										border: "1px solid rgba(184,147,58,0.35)",
										borderRadius: "2px",
										color: "#b8933a",
										cursor: "pointer",
										padding: "4px 0",
									}}
									title={`Widen amplicon range to ${Math.max(50, qpcrAmpliconMin - 20)}–${Math.min(300, qpcrAmpliconMax + 50)} bp and retry`}
								>
									Widen Amplicon
								</button>
							</div>
						)}
					</div>
				)}

				{pairs !== null &&
					pairs.length > 0 &&
					(() => {
						// Collect unique fwd/rev for the individual view
						const seenFwd = new Set<string>(),
							seenRev = new Set<string>();
						const fwdList: PrimerCandidate[] = [],
							revList: PrimerCandidate[] = [];
						for (const pair of pairs) {
							if (!seenFwd.has(pair.fwd.seq)) {
								seenFwd.add(pair.fwd.seq);
								fwdList.push(pair.fwd);
							}
							if (!seenRev.has(pair.rev.seq)) {
								seenRev.add(pair.rev.seq);
								revList.push(pair.rev);
							}
						}
						const bestFwd = pairs[0].fwd.seq,
							bestRev = pairs[0].rev.seq;
						return (
							<>
								{/* ── Pairs section (primary) ── */}
								<div
									style={{
										padding: "6px 12px 4px",
										background: "#f5f0e8",
										borderBottom: "1px solid #ddd8ce",
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
									}}
								>
									<span
										style={{
											fontFamily: "var(--font-courier)",
											fontSize: "8px",
											letterSpacing: "0.12em",
											textTransform: "uppercase",
											color: "#5a5648",
										}}
									>
										Pairs
									</span>
									<span
										style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#9a9284" }}
									>
										{pairs.length} ranked ·{" "}
										{mode === "qpcr" ? "by efficiency" : "click seq to copy"}
									</span>
								</div>
								{pairs.map((pair, i) => (
									<PairCard key={i} pair={pair} rank={i + 1} tmTarget={tmTarget} mode={mode} focused={i === focusedPairIndex} />
								))}

								{/* ── Individual primers (collapsible) ── */}
								<button
									type="button"
									onClick={() => setIndivOpen((o) => !o)}
									style={{
										width: "100%",
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										padding: "7px 12px",
										background: "#f5f0e8",
										border: "none",
										borderTop: "1px solid #ddd8ce",
										borderBottom: indivOpen ? "1px solid #ddd8ce" : "none",
										cursor: "pointer",
									}}
								>
									<span
										style={{
											fontFamily: "var(--font-courier)",
											fontSize: "8px",
											letterSpacing: "0.12em",
											textTransform: "uppercase",
											color: "#5a5648",
										}}
									>
										<span
											style={{
												marginRight: "5px",
												display: "inline-block",
												transition: "transform 0.15s",
												transform: indivOpen ? "rotate(90deg)" : "rotate(0)",
											}}
										>
											▶
										</span>
										Individual primers
									</span>
									<span
										style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#9a9284" }}
									>
										{fwdList.length}F · {revList.length}R
									</span>
								</button>

								{indivOpen && (
									<>
										<div
											style={{
												padding: "5px 12px 2px",
												background: "#f5f0e8",
												borderBottom: "1px solid rgba(221,216,206,0.5)",
											}}
										>
											<span
												style={{
													fontFamily: "var(--font-courier)",
													fontSize: "7.5px",
													letterSpacing: "0.1em",
													textTransform: "uppercase",
													color: "#9a9284",
												}}
											>
												→ Forward
											</span>
										</div>
										{fwdList.map((p, i) => (
											<PrimerCard
												key={p.seq}
												primer={p}
												rank={i + 1}
												highlight={p.seq === bestFwd}
												tmTarget={tmTarget}
											/>
										))}
										<div
											style={{
												padding: "5px 12px 2px",
												background: "#f5f0e8",
												borderBottom: "1px solid rgba(221,216,206,0.5)",
												borderTop: "1px solid #ddd8ce",
											}}
										>
											<span
												style={{
													fontFamily: "var(--font-courier)",
													fontSize: "7.5px",
													letterSpacing: "0.1em",
													textTransform: "uppercase",
													color: "#9a9284",
												}}
											>
												← Reverse
											</span>
										</div>
										{revList.map((p, i) => (
											<PrimerCard
												key={p.seq}
												primer={p}
												rank={i + 1}
												highlight={p.seq === bestRev}
												tmTarget={tmTarget}
											/>
										))}
									</>
								)}
							</>
						);
					})()}
				</>
				)}
			</div>

			{/* Bottom action bar — appears when primers are ready */}
			{(pairs?.length || assemblyPairs?.length) && (
				<div
					style={{
						flexShrink: 0,
						padding: "8px 12px",
						borderTop: "1px solid #ddd8ce",
						display: "flex",
						gap: "8px",
					}}
				>
					{diagnoseState.status !== "idle" ? (
						<button
							type="button"
							onClick={() => setDiagnoseState({ status: "idle" })}
							style={{
								flex: 1,
								fontFamily: "var(--font-courier)",
								fontSize: "9px",
								letterSpacing: "0.08em",
								textTransform: "uppercase",
								background: "none",
								border: "1px solid #ddd8ce",
								borderRadius: "2px",
								color: "#5a5648",
								cursor: "pointer",
								padding: "5px 10px",
							}}
						>
							← Back to primers
						</button>
					) : (
						<>
							<button
								type="button"
								onClick={() => void runDiagnosis()}
								title="AI-powered PCR failure analysis"
								style={{
									fontFamily: "var(--font-courier)",
									fontSize: "9px",
									letterSpacing: "0.08em",
									textTransform: "uppercase",
									background: "#f5f0e8",
									color: "#5a5648",
									border: "1px solid #ddd8ce",
									borderRadius: "2px",
									cursor: "pointer",
									padding: "5px 12px",
								}}
							>
								Diagnose
							</button>
							{onShowPlots && (
								<button
									type="button"
									onClick={() =>
										onShowPlots({
											pairs: pairs ?? [],
											seq,
											mode: mode as "pcr" | "qpcr",
											tmTarget,
										})
									}
									title="View melt curve, amplicon structure, and pair overview"
									style={{
										fontFamily: "var(--font-courier)",
										fontSize: "9px",
										letterSpacing: "0.08em",
										textTransform: "uppercase",
										background: "none",
										border: "1px solid #ddd8ce",
										borderRadius: "2px",
										color: "#5a5648",
										cursor: "pointer",
										padding: "5px 10px",
									}}
								>
									Plots
								</button>
							)}
						</>
					)}
				</div>
			)}
			<style>{`
				@keyframes diagnosePulse {
					0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
					40% { opacity: 1; transform: scale(1); }
				}
			`}</style>

			{/* Persistent Plots + Diagnose affordance — visible before design runs */}
			{(mode === "pcr" || mode === "qpcr") && onShowPlots && !(pairs && pairs.length > 0) && (
				<div
					style={{
						padding: "7px 12px",
						borderTop: "1px solid rgba(221,216,206,0.5)",
						flexShrink: 0,
					}}
				>
					<span
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "8px",
							color: "#b8b0a4",
							letterSpacing: "0.04em",
						}}
						title="After a design run: view melt curve, amplicon structure, and pair overview (Plots); or run AI-powered PCR failure analysis (Diagnose)"
					>
						After design: Diagnose with AI · view Plots
					</span>
				</div>
			)}
		</div>
	);
}
