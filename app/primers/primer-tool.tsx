"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AssemblyPrimerPair, PrimerCandidate, PrimerPair } from "@shandley/primd";
import { AmpliconHeatmap } from "@/components/primer-viz/amplicon-heatmap";
import { MeltCurve } from "@/components/primer-viz/melt-curve";
import { PairScatter } from "@/components/primer-viz/pair-scatter";
import type { PrimerWorkerRequest, PrimerWorkerResponse } from "@/components/sequence/primer-design.worker";

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = "pcr" | "qpcr" | "assembly";
type AssemblyMethod = "gibson" | "golden_gate";
type PlotTab = "heatmap" | "scatter" | "melt";

type DesignPair = PrimerPair & {
	ampliconTm?: number;
	ampliconDG?: number;
	efficiencyScore?: number;
};

// ── Sequence validation ───────────────────────────────────────────────────────

function cleanSeq(raw: string): string {
	return raw.replace(/\s|\d/g, "").toUpperCase();
}

function validateSeq(seq: string): string | null {
	if (seq.length === 0) return null;
	const invalid = seq.match(/[^ACGTRYMKSWHBVDN]/gi);
	if (invalid) return `Non-DNA characters: ${[...new Set(invalid)].slice(0, 5).join(", ")}`;
	if (seq.length < 50) return "Sequence too short (need ≥ 50 bp)";
	return null;
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function effColor(eff: number) {
	if (eff >= 0.8) return "#1a4731";
	if (eff >= 0.6) return "#b8933a";
	return "#a02828";
}

// ── Small shared sub-components ───────────────────────────────────────────────

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
				<span title="Binding site in secondary structure" style={{ fontSize: "9px", color: "#a02828", lineHeight: 1 }}>
					⚠
				</span>
			)}
			{accessWarn && (
				<span title="Binding site partially structured" style={{ fontSize: "9px", color: "#b8933a", lineHeight: 1 }}>
					~
				</span>
			)}
		</div>
	);
}

function PairCard({
	pair,
	rank,
	tmTarget,
	mode,
	selected,
	onClick,
}: {
	pair: DesignPair;
	rank: number;
	tmTarget: number;
	mode: Mode;
	selected: boolean;
	onClick: () => void;
}) {
	const [copiedPair, setCopiedPair] = useState(false);
	function copyPair(e: React.MouseEvent) {
		e.stopPropagation();
		const text = `Fwd (${pair.fwd.len}bp, Tm ${pair.fwd.tm.toFixed(1)}°C): ${pair.fwd.seq}\nRev (${pair.rev.len}bp, Tm ${pair.rev.tm.toFixed(1)}°C): ${pair.rev.seq}`;
		void navigator.clipboard.writeText(text).then(() => {
			setCopiedPair(true);
			setTimeout(() => setCopiedPair(false), 1500);
		});
	}
	const dimerWarn = pair.heteroDimerDG < -3.0;
	const tmDiffWarn = pair.tmDiff > 2;
	const isBest = rank === 1;
	const eff = pair.efficiencyScore;

	return (
		<div
			onClick={onClick}
			style={{
				padding: "12px 14px",
				borderBottom: "1px solid rgba(221,216,206,0.5)",
				background: selected
					? "rgba(26,71,49,0.08)"
					: isBest
						? "rgba(26,71,49,0.03)"
						: "transparent",
				cursor: "pointer",
				transition: "background 0.1s",
				borderLeft: selected ? "3px solid #1a4731" : "3px solid transparent",
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
				<div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
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
						{pair.productSize} bp
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
					{dimerWarn && <Badge label="dimer" value={pair.heteroDimerDG.toFixed(1)} warn />}
					{pair.ampliconTm !== undefined && (
						<span
							style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#9a9284" }}
							title="Predicted amplicon Tm"
						>
							amp {pair.ampliconTm.toFixed(0)}°
						</span>
					)}
					{mode !== "qpcr" && eff !== undefined && (
						<span
							style={{
								fontFamily: "var(--font-courier)",
								fontSize: "9px",
								color: effColor(eff),
								fontWeight: 700,
							}}
						>
							{(eff * 100).toFixed(0)}%
						</span>
					)}
				</div>
				<button
					type="button"
					onClick={copyPair}
					style={{
						background: "none",
						border: "none",
						cursor: "pointer",
						padding: "0 2px",
						fontFamily: "var(--font-courier)",
						fontSize: "9px",
						color: copiedPair ? "#1a4731" : "#9a9284",
						transition: "color 0.15s",
						flexShrink: 0,
					}}
				>
					{copiedPair ? "copied" : "copy"}
				</button>
			</div>
			<SeqLine dir="→" primer={pair.fwd} tmTarget={tmTarget} />
			<SeqLine dir="←" primer={pair.rev} tmTarget={tmTarget} />
			{mode === "qpcr" && eff !== undefined && (
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
								width: `${eff * 100}%`,
								height: "100%",
								background: effColor(eff),
								borderRadius: "3px",
								transition: "width 0.3s ease",
							}}
						/>
					</div>
					<span
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "9px",
							fontWeight: 700,
							color: effColor(eff),
							flexShrink: 0,
						}}
					>
						{(eff * 100).toFixed(0)}%
					</span>
				</div>
			)}
		</div>
	);
}

function AssemblySeqLine({
	dir,
	tail,
	annealing,
	tm,
	onCopy,
	copied,
}: {
	dir: "→" | "←";
	tail: string;
	annealing: string;
	tm: number;
	onCopy: () => void;
	copied: boolean;
}) {
	return (
		<div
			onClick={onCopy}
			title="Click to copy full sequence"
			style={{
				display: "flex",
				alignItems: "center",
				gap: "5px",
				cursor: "pointer",
				padding: "2px 0",
			}}
		>
			<span style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#9a9284", width: "9px", flexShrink: 0 }}>
				{dir}
			</span>
			<span style={{ fontFamily: "var(--font-courier)", fontSize: "10px", letterSpacing: "0.04em", flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
				<span style={{ color: "#2d7a54", opacity: 0.75 }}>{tail}</span>
				<span style={{ color: copied ? "#1a4731" : "#1c1a16", transition: "color 0.15s" }}>{annealing}</span>
			</span>
			<span style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#9a9284", flexShrink: 0 }}>
				{tm.toFixed(1)}°
			</span>
		</div>
	);
}

function AssemblyPairCard({ pair, rank }: { pair: AssemblyPrimerPair; rank: number }) {
	const [copiedFwd, setCopiedFwd] = useState(false);
	const [copiedRev, setCopiedRev] = useState(false);
	const [copiedAll, setCopiedAll] = useState(false);
	const isBest = rank === 1;

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
	function copyBoth(e: React.MouseEvent) {
		e.stopPropagation();
		const text = `Fwd: ${pair.fwd.fullSeq}\nRev: ${pair.rev.fullSeq}`;
		void navigator.clipboard.writeText(text).then(() => {
			setCopiedAll(true);
			setTimeout(() => setCopiedAll(false), 1500);
		});
	}

	return (
		<div
			style={{
				padding: "12px 14px",
				borderBottom: "1px solid rgba(221,216,206,0.5)",
				background: isBest ? "rgba(26,71,49,0.03)" : "transparent",
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
					<span style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: isBest ? "#1a4731" : "#9a9284", fontWeight: isBest ? 700 : 400 }}>
						#{rank}
					</span>
					<span style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#5a5648" }}>
						{pair.productSize} bp
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
					style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px", fontFamily: "var(--font-courier)", fontSize: "9px", color: copiedAll ? "#1a4731" : "#9a9284", transition: "color 0.15s", flexShrink: 0 }}
				>
					{copiedAll ? "copied" : "copy"}
				</button>
			</div>
			<AssemblySeqLine dir="→" tail={pair.fwd.tail} annealing={pair.fwd.seq} tm={pair.fwd.tm} onCopy={copyFwd} copied={copiedFwd} />
			<AssemblySeqLine dir="←" tail={pair.rev.tail} annealing={pair.rev.seq} tm={pair.rev.tm} onCopy={copyRev} copied={copiedRev} />
		</div>
	);
}

// ── Input section styles ──────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
	fontFamily: "var(--font-courier)",
	fontSize: "9px",
	letterSpacing: "0.1em",
	textTransform: "uppercase",
	color: "#9a9284",
	display: "block",
	marginBottom: "5px",
};

const inputStyle: React.CSSProperties = {
	fontFamily: "var(--font-courier)",
	fontSize: "11px",
	color: "#1c1a16",
	background: "#faf7f2",
	border: "1px solid #ddd8ce",
	borderRadius: "3px",
	padding: "6px 8px",
	outline: "none",
	width: "100%",
	boxSizing: "border-box",
};

// ── Main component ─────────────────────────────────────────────────────────────

export function PrimerTool() {
	// Sequence
	const [rawSeq, setRawSeq] = useState("");
	const seq = cleanSeq(rawSeq);
	const seqError = validateSeq(seq);

	// Region
	const [useFullSeq, setUseFullSeq] = useState(true);
	const [regionStart, setRegionStart] = useState("1");
	const [regionEnd, setRegionEnd] = useState("");

	// Mode
	const [mode, setMode] = useState<Mode>("pcr");
	const [assemblyMethod, setAssemblyMethod] = useState<AssemblyMethod>("gibson");
	const [gibsonOverlap, setGibsonOverlap] = useState(20);
	const [ggEnzyme, setGgEnzyme] = useState<"BsaI" | "BbsI" | "BsmBI">("BsaI");

	// Options
	const [optionsOpen, setOptionsOpen] = useState(false);
	const [tmTarget, setTmTarget] = useState(60);
	const [minLen, setMinLen] = useState(18);
	const [maxLen, setMaxLen] = useState(27);
	const [gcMin, setGcMin] = useState(40);
	const [gcMax, setGcMax] = useState(65);
	const [maxTmDiff, setMaxTmDiff] = useState(3);
	const [qpcrAmpliconMin, setQpcrAmpliconMin] = useState(70);
	const [qpcrAmpliconMax, setQpcrAmpliconMax] = useState(200);

	// Results
	const [pairs, setPairs] = useState<DesignPair[] | null>(null);
	const [assemblyPairs, setAssemblyPairs] = useState<AssemblyPrimerPair[] | null>(null);
	const [warning, setWarning] = useState<string | null>(null);
	const [running, setRunning] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Plot state
	const [selectedPair, setSelectedPair] = useState(0);
	const [activePlot, setActivePlot] = useState<PlotTab>("heatmap");

	const workerRef = useRef<Worker | null>(null);

	useEffect(() => () => { workerRef.current?.terminate(); }, []);

	// When seq changes, reset region end
	useEffect(() => {
		if (seq.length > 0) setRegionEnd(String(seq.length));
	}, [seq.length]);

	const design = useCallback(() => {
		if (!seq || seqError) return;
		// When amplifying the full sequence, inset by ~10% so primers have a
		// substantial search window at each end. Minimum 80 bp, maximum 200 bp.
		const FULL_INSET = Math.min(200, Math.max(80, Math.floor(seq.length * 0.1)));
		const s0 = useFullSeq ? FULL_INSET : Math.max(0, Number(regionStart) - 1);
		const e0 = useFullSeq ? seq.length - FULL_INSET : Math.min(seq.length, Number(regionEnd));
		if (s0 >= e0) {
			setError("Start must be less than end.");
			return;
		}

		workerRef.current?.terminate();
		setRunning(true);
		setPairs(null);
		setAssemblyPairs(null);
		setWarning(null);
		setError(null);
		setSelectedPair(0);

		const worker = new Worker(
			new URL("../../components/sequence/primer-design.worker.ts", import.meta.url),
		);
		workerRef.current = worker;

		const opts = {
			tmTarget,
			primerLenRange: [minLen, maxLen] as [number, number],
			gcRange: [gcMin / 100, gcMax / 100] as [number, number],
			maxTmDiff,
			numReturn: 5,
			...(mode === "qpcr" ? { productSizeRange: [qpcrAmpliconMin, qpcrAmpliconMax] as [number, number] } : {}),
		};

		const assemblyOpts =
			mode === "assembly"
				? {
						method: assemblyMethod,
						gibsonOverlap,
						ggEnzymeSite:
							assemblyMethod === "golden_gate"
								? ({ BsaI: "GGTCTC", BbsI: "GAAGAC", BsmBI: "CGTCTC" } as Record<string, string>)[ggEnzyme]
								: undefined,
					}
				: undefined;

		const req: PrimerWorkerRequest = {
			seq,
			regionStart: s0,
			regionEnd: e0,
			opts,
			assemblyOpts,
			mode,
		};

		worker.onmessage = (e: MessageEvent<PrimerWorkerResponse>) => {
			setRunning(false);
			if (e.data.type === "error") {
				setError(e.data.message);
				return;
			}
			const { result, mode: resultMode } = e.data;
			if (resultMode === "assembly") {
				const ar = result as import("@shandley/primd").AssemblyResult;
				setAssemblyPairs(ar.pairs ?? []);
				setWarning(ar.warning ?? null);
			} else {
				const pr = result as import("@shandley/primd").PCRResult | import("@shandley/primd").QPCRResult;
				setPairs((pr.pairs ?? []) as DesignPair[]);
				setWarning(pr.warning ?? null);
			}
		};
		worker.onerror = (e) => {
			setRunning(false);
			setError(e.message || "Worker error");
		};
		worker.postMessage(req);
	}, [seq, seqError, useFullSeq, regionStart, regionEnd, mode, assemblyMethod, gibsonOverlap, ggEnzyme, tmTarget, minLen, maxLen, gcMin, gcMax, maxTmDiff, qpcrAmpliconMin, qpcrAmpliconMax]);

	const hasPairs = (pairs && pairs.length > 0) || (assemblyPairs && assemblyPairs.length > 0);
	const currentPair = pairs?.[selectedPair] ?? null;

	return (
		<div style={{ minHeight: "100vh", background: "#f5f0e8", display: "flex", flexDirection: "column" }}>
			{/* Header */}
			<header
				style={{
					height: "60px",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					borderBottom: "1px solid #ddd8ce",
					background: "rgba(245,240,232,0.97)",
					backdropFilter: "blur(8px)",
					padding: "0 28px",
					flexShrink: 0,
					position: "sticky",
					top: 0,
					zIndex: 50,
				}}
			>
				<Link
					href="/"
					style={{ textDecoration: "none", display: "flex", alignItems: "baseline", gap: "10px" }}
				>
					<span style={{ fontFamily: "var(--font-playfair)", fontSize: "24px", fontWeight: 400, color: "#1c1a16", letterSpacing: "-0.01em" }}>
						Ori
					</span>
					<span style={{ fontFamily: "var(--font-courier)", fontSize: "9px", fontStyle: "italic", color: "#9a9284", letterSpacing: "0.04em" }}>
						molecular workbench
					</span>
				</Link>
				<nav style={{ display: "flex", alignItems: "center", gap: "28px" }}>
					{(
						[
							["/", "Home"],
							["/library", "Library"],
							["/primers", "Primers"],
						] as const
					).map(([href, label]) => (
						<Link
							key={href}
							href={href}
							style={{
								fontFamily: "var(--font-karla)",
								fontSize: "13px",
								color: href === "/primers" ? "#1a4731" : "#5a5648",
								textDecoration: "none",
								fontWeight: href === "/primers" ? 500 : 400,
								borderBottom: href === "/primers" ? "1px solid #1a4731" : "none",
								paddingBottom: href === "/primers" ? "1px" : "0",
							}}
						>
							{label}
						</Link>
					))}
				</nav>
				<div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
					<Link
						href="/login"
						style={{ fontFamily: "var(--font-karla)", fontSize: "13px", color: "#5a5648", textDecoration: "none" }}
					>
						Sign in
					</Link>
					<Link
						href="/signup"
						style={{
							fontFamily: "var(--font-karla)",
							fontSize: "13px",
							fontWeight: 500,
							background: "#1a4731",
							color: "white",
							textDecoration: "none",
							padding: "7px 18px",
							borderRadius: "3px",
						}}
					>
						Get started
					</Link>
				</div>
			</header>

			{/* Body */}
			<div style={{ flex: 1, display: "grid", gridTemplateColumns: "380px 1fr", minHeight: 0 }}>
				{/* Left: input panel */}
				<div
					style={{
						borderRight: "1px solid #ddd8ce",
						display: "flex",
						flexDirection: "column",
						background: "#faf7f2",
						height: "calc(100vh - 60px)",
						overflowY: "auto",
						position: "sticky",
						top: "60px",
					}}
				>
					{/* Panel header */}
					<div
						style={{
							padding: "18px 20px 14px",
							borderBottom: "1px solid #ddd8ce",
						}}
					>
						<span
							style={{
								fontFamily: "var(--font-courier)",
								fontSize: "9px",
								letterSpacing: "0.16em",
								textTransform: "uppercase",
								color: "#1a4731",
							}}
						>
							Primer Design
						</span>
						<p
							style={{
								fontFamily: "var(--font-karla)",
								fontSize: "12px",
								color: "#9a9284",
								margin: "5px 0 0",
								lineHeight: 1.5,
							}}
						>
							SantaLucia 1998 nearest-neighbor · Owczarzy 2008 Mg²⁺ correction
						</p>
					</div>

					<div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
						{/* Sequence input */}
						<div>
							<label style={labelStyle}>Sequence</label>
							<textarea
								value={rawSeq}
								onChange={(e) => setRawSeq(e.target.value)}
								placeholder="Paste DNA sequence (FASTA or plain)..."
								rows={7}
								style={{
									...inputStyle,
									resize: "vertical",
									lineHeight: 1.5,
									fontSize: "10px",
									letterSpacing: "0.04em",
									fontFamily: "var(--font-courier)",
								}}
							/>
							{seq.length > 0 && (
								<div
									style={{
										marginTop: "4px",
										fontFamily: "var(--font-courier)",
										fontSize: "9px",
										color: seqError ? "#a02828" : "#9a9284",
									}}
								>
									{seqError ?? `${seq.length.toLocaleString()} bp`}
								</div>
							)}
						</div>

						{/* Region */}
						<div>
							<label style={labelStyle}>Target Region</label>
							<label
								style={{
									display: "flex",
									alignItems: "center",
									gap: "7px",
									cursor: "pointer",
									marginBottom: "8px",
								}}
							>
								<input
									type="checkbox"
									checked={useFullSeq}
									onChange={(e) => setUseFullSeq(e.target.checked)}
									style={{ accentColor: "#1a4731" }}
								/>
								<span style={{ fontFamily: "var(--font-courier)", fontSize: "10px", color: "#5a5648" }}>
									Full sequence
								</span>
							</label>
							{!useFullSeq && (
								<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
									<div>
										<span style={{ ...labelStyle, marginBottom: "3px" }}>Start</span>
										<input
											type="number"
											value={regionStart}
											min={1}
											max={seq.length}
											onChange={(e) => setRegionStart(e.target.value)}
											style={inputStyle}
										/>
									</div>
									<div>
										<span style={{ ...labelStyle, marginBottom: "3px" }}>End</span>
										<input
											type="number"
											value={regionEnd}
											min={1}
											max={seq.length}
											onChange={(e) => setRegionEnd(e.target.value)}
											style={inputStyle}
										/>
									</div>
								</div>
							)}
						</div>

						{/* Mode tabs */}
						<div>
							<label style={labelStyle}>Mode</label>
							<div
								style={{
									display: "grid",
									gridTemplateColumns: "1fr 1fr 1fr",
									border: "1px solid #ddd8ce",
									borderRadius: "3px",
									overflow: "hidden",
								}}
							>
								{(["pcr", "qpcr", "assembly"] as const).map((m, i) => (
									<button
										key={m}
										type="button"
										onClick={() => setMode(m)}
										style={{
											fontFamily: "var(--font-courier)",
											fontSize: "9px",
											letterSpacing: "0.08em",
											textTransform: "uppercase",
											padding: "8px 4px",
											background: mode === m ? "#1a4731" : "transparent",
											color: mode === m ? "white" : "#5a5648",
											border: "none",
											borderLeft: i > 0 ? "1px solid #ddd8ce" : "none",
											cursor: "pointer",
											transition: "background 0.15s, color 0.15s",
										}}
									>
										{m === "pcr" ? "PCR" : m === "qpcr" ? "qPCR" : "Assembly"}
									</button>
								))}
							</div>

							{/* Assembly sub-options */}
							{mode === "assembly" && (
								<div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
									<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid #ddd8ce", borderRadius: "3px", overflow: "hidden" }}>
										{(["gibson", "golden_gate"] as const).map((m, i) => (
											<button
												key={m}
												type="button"
												onClick={() => setAssemblyMethod(m)}
												style={{
													fontFamily: "var(--font-courier)",
													fontSize: "9px",
													letterSpacing: "0.06em",
													padding: "6px 4px",
													background: assemblyMethod === m ? "#2d7a54" : "transparent",
													color: assemblyMethod === m ? "white" : "#5a5648",
													border: "none",
													borderLeft: i > 0 ? "1px solid #ddd8ce" : "none",
													cursor: "pointer",
													transition: "background 0.15s",
												}}
											>
												{m === "gibson" ? "Gibson" : "Golden Gate"}
											</button>
										))}
									</div>
									{assemblyMethod === "gibson" ? (
										<div>
											<span style={labelStyle}>Overlap length (bp)</span>
											<input
												type="number"
												value={gibsonOverlap}
												min={10}
												max={40}
												onChange={(e) => setGibsonOverlap(Number(e.target.value))}
												style={inputStyle}
											/>
										</div>
									) : (
										<div>
											<span style={labelStyle}>Restriction enzyme</span>
											<select
												value={ggEnzyme}
												onChange={(e) => setGgEnzyme(e.target.value as "BsaI" | "BbsI" | "BsmBI")}
												style={inputStyle}
											>
												{["BsaI", "BbsI", "BsmBI"].map((e) => (
													<option key={e} value={e}>{e}</option>
												))}
											</select>
										</div>
									)}
								</div>
							)}
						</div>

						{/* Options accordion */}
						<div>
							<button
								type="button"
								onClick={() => setOptionsOpen((o) => !o)}
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									width: "100%",
									background: "none",
									border: "none",
									padding: "0",
									cursor: "pointer",
								}}
							>
								<span style={labelStyle}>Options</span>
								<span style={{ fontFamily: "var(--font-courier)", fontSize: "10px", color: "#9a9284" }}>
									{optionsOpen ? "▲" : "▼"}
								</span>
							</button>

							{optionsOpen && (
								<div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
									<div>
										<span style={labelStyle}>Target Tm (°C)</span>
										<input
											type="number"
											value={tmTarget}
											min={45}
											max={75}
											onChange={(e) => setTmTarget(Number(e.target.value))}
											style={inputStyle}
										/>
									</div>
									<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
										<div>
											<span style={labelStyle}>Min len (bp)</span>
											<input
												type="number"
												value={minLen}
												min={15}
												max={30}
												onChange={(e) => setMinLen(Number(e.target.value))}
												style={inputStyle}
											/>
										</div>
										<div>
											<span style={labelStyle}>Max len (bp)</span>
											<input
												type="number"
												value={maxLen}
												min={18}
												max={35}
												onChange={(e) => setMaxLen(Number(e.target.value))}
												style={inputStyle}
											/>
										</div>
									</div>
									<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
										<div>
											<span style={labelStyle}>GC min (%)</span>
											<input
												type="number"
												value={gcMin}
												min={20}
												max={60}
												onChange={(e) => setGcMin(Number(e.target.value))}
												style={inputStyle}
											/>
										</div>
										<div>
											<span style={labelStyle}>GC max (%)</span>
											<input
												type="number"
												value={gcMax}
												min={40}
												max={80}
												onChange={(e) => setGcMax(Number(e.target.value))}
												style={inputStyle}
											/>
										</div>
									</div>
									<div>
										<span style={labelStyle}>Max ΔTm (°C)</span>
										<input
											type="number"
											value={maxTmDiff}
											min={1}
											max={8}
											step={0.5}
											onChange={(e) => setMaxTmDiff(Number(e.target.value))}
											style={inputStyle}
										/>
									</div>
									{mode === "qpcr" && (
										<div>
											<span style={labelStyle}>Amplicon range (bp)</span>
											<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
												<input
													type="number"
													value={qpcrAmpliconMin}
													min={50}
													max={150}
													onChange={(e) => setQpcrAmpliconMin(Number(e.target.value))}
													style={inputStyle}
													placeholder="Min"
												/>
												<input
													type="number"
													value={qpcrAmpliconMax}
													min={100}
													max={500}
													onChange={(e) => setQpcrAmpliconMax(Number(e.target.value))}
													style={inputStyle}
													placeholder="Max"
												/>
											</div>
										</div>
									)}
								</div>
							)}
						</div>

						{/* Design button */}
						<button
							type="button"
							onClick={design}
							disabled={!seq || !!seqError || running}
							style={{
								fontFamily: "var(--font-karla)",
								fontSize: "13px",
								fontWeight: 500,
								padding: "11px 20px",
								background: !seq || !!seqError || running ? "#9a9284" : "#1a4731",
								color: "white",
								border: "none",
								borderRadius: "3px",
								cursor: !seq || !!seqError || running ? "not-allowed" : "pointer",
								transition: "background 0.15s",
								letterSpacing: "0.02em",
							}}
						>
							{running ? "Designing…" : "Design Primers"}
						</button>

						{/* Info note */}
						<p
							style={{
								fontFamily: "var(--font-courier)",
								fontSize: "9px",
								color: "#b8b0a4",
								lineHeight: 1.6,
								margin: 0,
							}}
						>
							Runs entirely in your browser — no sequence data is sent to a server.
						</p>
					</div>
				</div>

				{/* Right: results */}
				<div style={{ overflowY: "auto", background: "#f5f0e8" }}>
					{/* Empty state */}
					{!running && !hasPairs && !warning && !error && (
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								justifyContent: "center",
								height: "100%",
								minHeight: "400px",
								gap: "14px",
								padding: "40px",
							}}
						>
							<div
								style={{
									fontFamily: "var(--font-playfair)",
									fontSize: "52px",
									color: "#ddd8ce",
									lineHeight: 1,
									userSelect: "none",
								}}
							>
								→←
							</div>
							<p
								style={{
									fontFamily: "var(--font-karla)",
									fontSize: "14px",
									color: "#9a9284",
									textAlign: "center",
									maxWidth: "320px",
									lineHeight: 1.6,
								}}
							>
								Paste a DNA sequence and click Design Primers to get started.
							</p>
							<p
								style={{
									fontFamily: "var(--font-courier)",
									fontSize: "9px",
									color: "#b8b0a4",
									textAlign: "center",
									letterSpacing: "0.06em",
								}}
							>
								PCR · qPCR · Gibson · Golden Gate
							</p>
						</div>
					)}

					{/* Running spinner */}
					{running && (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								height: "200px",
								gap: "10px",
							}}
						>
							<span
								style={{
									width: "16px",
									height: "16px",
									border: "2px solid #ddd8ce",
									borderTopColor: "#1a4731",
									borderRadius: "50%",
									display: "inline-block",
									animation: "spin 0.7s linear infinite",
								}}
							/>
							<span style={{ fontFamily: "var(--font-courier)", fontSize: "10px", color: "#9a9284" }}>
								Evaluating candidates…
							</span>
							<style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
						</div>
					)}

					{/* Error */}
					{error && (
						<div
							style={{
								margin: "24px",
								padding: "14px 16px",
								background: "rgba(160,40,40,0.06)",
								border: "1px solid rgba(160,40,40,0.2)",
								borderRadius: "3px",
								fontFamily: "var(--font-karla)",
								fontSize: "13px",
								color: "#a02828",
							}}
						>
							{error}
						</div>
					)}

					{/* Warning (no pairs found) */}
					{warning && !running && (
						<div
							style={{
								margin: "24px",
								padding: "14px 16px",
								background: "rgba(184,147,58,0.07)",
								border: "1px solid rgba(184,147,58,0.25)",
								borderRadius: "3px",
							}}
						>
							<div style={{ fontFamily: "var(--font-courier)", fontSize: "9px", letterSpacing: "0.1em", color: "#b8933a", marginBottom: "5px" }}>
								NO PAIRS FOUND
							</div>
							<div style={{ fontFamily: "var(--font-karla)", fontSize: "13px", color: "#5a5648", lineHeight: 1.6 }}>
								{warning}
							</div>
						</div>
					)}

					{/* PCR / qPCR results */}
					{pairs && pairs.length > 0 && (
						<div>
							{/* Results header */}
							<div
								style={{
									padding: "14px 20px 10px",
									borderBottom: "1px solid #ddd8ce",
									display: "flex",
									alignItems: "center",
									gap: "10px",
								}}
							>
								<span style={{ fontFamily: "var(--font-courier)", fontSize: "9px", letterSpacing: "0.12em", color: "#1a4731", textTransform: "uppercase" }}>
									{pairs.length} pair{pairs.length !== 1 ? "s" : ""}
								</span>
								<span style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#b8b0a4" }}>
									· click a pair to highlight in plots
								</span>
							</div>

							{/* Pair cards */}
							<div style={{ borderBottom: "1px solid #ddd8ce" }}>
								{pairs.map((pair, i) => (
									<PairCard
										key={i}
										pair={pair}
										rank={i + 1}
										tmTarget={tmTarget}
										mode={mode}
										selected={selectedPair === i}
										onClick={() => setSelectedPair(i)}
									/>
								))}
							</div>

							{/* Plots section */}
							<div style={{ padding: "20px" }}>
								<div
									style={{
										fontFamily: "var(--font-courier)",
										fontSize: "9px",
										letterSpacing: "0.12em",
										color: "#9a9284",
										textTransform: "uppercase",
										marginBottom: "12px",
									}}
								>
									Plots
								</div>

								{/* Plot tabs */}
								<div style={{ display: "flex", gap: "0", marginBottom: "16px", borderBottom: "1px solid #ddd8ce" }}>
									{(
										[
											["heatmap", "Amplicon Structure"],
											["scatter", "Pair Overview"],
											...(mode === "qpcr" ? [["melt", "Melt Curve"] as const] : []),
										] as [PlotTab, string][]
									).map(([tab, label]) => (
										<button
											key={tab}
											type="button"
											onClick={() => setActivePlot(tab)}
											style={{
												fontFamily: "var(--font-courier)",
												fontSize: "9px",
												letterSpacing: "0.08em",
												textTransform: "uppercase",
												padding: "7px 14px",
												background: "none",
												border: "none",
												borderBottom: activePlot === tab ? "2px solid #1a4731" : "2px solid transparent",
												color: activePlot === tab ? "#1a4731" : "#9a9284",
												cursor: "pointer",
												marginBottom: "-1px",
												transition: "color 0.15s",
											}}
										>
											{label}
										</button>
									))}
								</div>

								{/* Plot canvases */}
								<div style={{ background: "#faf7f2", borderRadius: "3px", border: "1px solid #ddd8ce", padding: "12px", display: "inline-block" }}>
									{activePlot === "heatmap" && currentPair && (
										<AmpliconHeatmap
											pair={currentPair}
											seq={seq}
											temperature={tmTarget - 5}
										/>
									)}
									{activePlot === "scatter" && (
										<PairScatter pairs={pairs} mode={mode === "qpcr" ? "qpcr" : "pcr"} />
									)}
									{activePlot === "melt" && mode === "qpcr" && (
										<MeltCurve pairs={pairs} seq={seq} highlightIndex={selectedPair} />
									)}
								</div>
							</div>
						</div>
					)}

					{/* Assembly results */}
					{assemblyPairs && assemblyPairs.length > 0 && (
						<div>
							<div
								style={{
									padding: "14px 20px 10px",
									borderBottom: "1px solid #ddd8ce",
									display: "flex",
									alignItems: "center",
									gap: "10px",
								}}
							>
								<span style={{ fontFamily: "var(--font-courier)", fontSize: "9px", letterSpacing: "0.12em", color: "#1a4731", textTransform: "uppercase" }}>
									{assemblyPairs.length} pair{assemblyPairs.length !== 1 ? "s" : ""}
								</span>
								<span style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#b8b0a4" }}>
									· {assemblyMethod === "gibson" ? `${gibsonOverlap}bp Gibson overlap` : `${ggEnzyme} Golden Gate`}
								</span>
							</div>
							{assemblyPairs.map((pair, i) => (
								<AssemblyPairCard key={i} pair={pair} rank={i + 1} />
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
