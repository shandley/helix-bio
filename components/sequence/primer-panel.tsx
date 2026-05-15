"use client";

import type { AssemblyPrimerPair, PrimerCandidate, PrimerPair } from "@shandley/primd";
import { useCallback, useEffect, useRef, useState } from "react";
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
}

function Badge({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
	const color = warn ? "#b8933a" : "#1a4731";
	const bg = warn ? "rgba(184,147,58,0.08)" : "rgba(26,71,49,0.06)";
	const border = warn ? "rgba(184,147,58,0.25)" : "rgba(26,71,49,0.2)";
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
			<span style={{ opacity: 0.6 }}>access</span>
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
function PairCard({ pair, rank, tmTarget }: { pair: DesignPair; rank: number; tmTarget: number }) {
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
					const color = eff >= 0.8 ? "#1a4731" : eff >= 0.6 ? "#b8933a" : "#a02828";
					const bg =
						eff >= 0.8
							? "rgba(26,71,49,0.08)"
							: eff >= 0.6
								? "rgba(184,147,58,0.08)"
								: "rgba(160,40,40,0.07)";
					const border =
						eff >= 0.8
							? "rgba(26,71,49,0.2)"
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
			style={{
				padding: "10px 12px",
				borderBottom: "1px solid rgba(221,216,206,0.5)",
				background: isBest ? "rgba(26,71,49,0.04)" : "transparent",
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
							color: isBest ? "#1a4731" : "#9a9284",
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
					{effBadge}
					{pair.ampliconTm !== undefined && (
						<span style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#9a9284" }}>
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
						color: highlight ? "#1a4731" : "#9a9284",
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
		copied,
		onCopy,
	}: {
		dir: "→" | "←";
		tail: string;
		annealing: string;
		tm: number;
		copied: boolean;
		onCopy: () => void;
	}) {
		return (
			<div
				onClick={onCopy}
				title={`Click to copy full primer · ${tail}${annealing}`}
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
					{tm.toFixed(1)}°
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
							color: isBest ? "#1a4731" : "#9a9284",
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
				copied={copiedFwd}
				onCopy={copyFwd}
			/>
			<AssemblySeqLine
				dir="←"
				tail={pair.rev.tail}
				annealing={pair.rev.seq}
				tm={pair.rev.tm}
				copied={copiedRev}
				onCopy={copyRev}
			/>
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
	const [pairs, setPairs] = useState<DesignPair[] | null>(null);
	const [assemblyPairs, setAssemblyPairs] = useState<AssemblyPrimerPair[] | null>(null);
	const [warning, setWarning] = useState<string | null>(null);
	const [running, setRunning] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const workerRef = useRef<Worker | null>(null);

	// Design parameters — shown in collapsible Options section
	const [optionsOpen, setOptionsOpen] = useState(false);
	const [indivOpen, setIndivOpen] = useState(false);
	const [tmTarget, setTmTarget] = useState(60);
	const [minLen, setMinLen] = useState(18);
	const [maxLen, setMaxLen] = useState(27);
	const [gcMin, setGcMin] = useState(40);
	const [gcMax, setGcMax] = useState(65);

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

	// Core worker launch — accepts explicit 1-indexed coords so annotation auto-run
	// can bypass state (which may not yet reflect the latest selectionStart/End props).
	// Handles circular origin-spanning selections by rotating the sequence.
	const runDesign = useCallback(
		(s: number, e: number) => {
			// Allow s > e on circular plasmids (selection wraps the origin)
			const isWrapping = topology === "circular" && s > e && s >= 1 && e >= 1;
			if (Number.isNaN(s) || Number.isNaN(e) || s < 1 || e > seqLen || (s >= e && !isWrapping)) {
				setError("Enter a valid start/end range (1-indexed).");
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
					tmTarget,
					primerLenRange: [minLen, maxLen] as [number, number],
					gcRange: [gcMin / 100, gcMax / 100] as [number, number],
				},
				...(mode === "assembly"
					? {
							assemblyOpts: {
								method: assemblyMethod,
								annealingLenRange: [minLen, maxLen] as [number, number],
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
					setError("Primer design failed. Check your sequence.");
					onPrimersDesigned?.(null);
				}
				setRunning(false);
			};

			worker.onerror = () => {
				worker.terminate();
				workerRef.current = null;
				setError("Primer design failed. Check your sequence.");
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
		],
	);

	// Stable ref so the annotation effect always calls the latest runDesign
	const runDesignRef = useRef(runDesign);
	runDesignRef.current = runDesign;

	const design = useCallback(() => {
		const s = parseInt(start, 10);
		const e = parseInt(end, 10);
		runDesign(s, e);
	}, [start, end, runDesign]);

	// Auto-design when an annotation is clicked — use prop coords directly to avoid
	// the timing gap between selectionStart/End props updating and start/end state settling.
	useEffect(() => {
		if (!annotationName || selectionStart === undefined || selectionEnd === undefined) return;
		// selectionStart/End are 0-indexed from SeqViz; runDesign expects 1-indexed
		runDesignRef.current(selectionStart + 1, selectionEnd + 1);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [annotationName, selectionStart, selectionEnd]);

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
							fontFamily: "var(--font-playfair)",
							fontSize: "15px",
							color: "#1c1a16",
							letterSpacing: "-0.01em",
						}}
					>
						Primers
					</span>
					{annotationName ? (
						<span
							style={{
								fontFamily: "var(--font-courier)",
								fontSize: "9px",
								color: "#1a4731",
								background: "rgba(26,71,49,0.07)",
								border: "1px solid rgba(26,71,49,0.2)",
								borderRadius: "2px",
								padding: "1px 6px",
								letterSpacing: "0.04em",
							}}
						>
							{annotationName}
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
								setMode(m);
								setPairs(null);
								setAssemblyPairs(null);
								setWarning(null);
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
							70–200 bp
						</span>
					)}
					{mode === "assembly" && (
						<div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "4px" }}>
							{/* Gibson / Golden Gate toggle */}
							{(["gibson", "golden_gate"] as const).map((m) => (
								<button
									key={m}
									type="button"
									onClick={() => setAssemblyMethod(m)}
									style={{
										fontFamily: "var(--font-courier)",
										fontSize: "8px",
										letterSpacing: "0.06em",
										textTransform: "uppercase",
										color: assemblyMethod === m ? "#1a4731" : "#9a9284",
										background: assemblyMethod === m ? "rgba(26,71,49,0.08)" : "none",
										border: `1px solid ${assemblyMethod === m ? "#1a4731" : "#ddd8ce"}`,
										borderRadius: "2px",
										padding: "2px 6px",
										cursor: "pointer",
									}}
								>
									{m === "gibson" ? "Gibson" : "Golden Gate"}
								</button>
							))}
						</div>
					)}
				</div>

				{/* Assembly-specific controls */}
				{mode === "assembly" && (
					<div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
						{assemblyMethod === "gibson" ? (
							<div style={{ flex: 1 }}>
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
									Overlap (bp)
								</div>
								<input
									type="number"
									value={gibsonOverlap}
									min={10}
									max={40}
									step={1}
									onChange={(e) =>
										setGibsonOverlap(Math.max(10, Math.min(40, Number(e.target.value))))
									}
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
						) : (
							<div style={{ flex: 1 }}>
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
									Enzyme
								</div>
								<select
									value={ggEnzyme}
									onChange={(e) => setGgEnzyme(e.target.value as "BsaI" | "BbsI" | "BsmBI")}
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
								>
									<option value="BsaI">BsaI (GGTCTC)</option>
									<option value="BbsI">BbsI (GAAGAC)</option>
									<option value="BsmBI">BsmBI (CGTCTC)</option>
								</select>
							</div>
						)}
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
							{!isWrapping && " · primers flank selection"}
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
										<span style={labelStyle}>Tm target</span>
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
										<span style={labelStyle}>Length</span>
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
										<span style={labelStyle}>GC %</span>
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

				<button
					type="button"
					onClick={design}
					disabled={running}
					style={{
						width: "100%",
						padding: "8px",
						background: running ? "#2d7a54" : "#1a4731",
						color: "white",
						fontFamily: "var(--font-courier)",
						fontSize: "9px",
						letterSpacing: "0.12em",
						textTransform: "uppercase",
						border: "none",
						borderRadius: "3px",
						cursor: running ? "not-allowed" : "pointer",
						opacity: running ? 0.7 : 1,
						transition: "opacity 0.15s",
					}}
				>
					{running
						? "Designing…"
						: mode === "qpcr"
							? "Design qPCR Primers"
							: mode === "assembly"
								? "Design Assembly Primers"
								: "Design Primers"}
				</button>
			</div>

			{/* Results */}
			<div style={{ flex: 1, overflowY: "auto" }}>
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
					<div
						style={{
							margin: "10px 12px 0",
							padding: "6px 10px",
							background: "rgba(184,147,58,0.08)",
							border: "1px solid rgba(184,147,58,0.25)",
							borderRadius: "3px",
							fontFamily: "var(--font-courier)",
							fontSize: "9px",
							color: "#b8933a",
						}}
					>
						{warning}
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
									<PairCard key={i} pair={pair} rank={i + 1} tmTarget={tmTarget} />
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
			</div>
		</div>
	);
}
