"use client";

import type { PrimerCandidate, PrimerPair } from "@shandley/primd";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PrimerWorkerResponse } from "./primer-design.worker";

interface PrimerPanelProps {
	seq: string;
	seqLen: number;
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
function PairCard({ pair, rank, tmTarget }: { pair: PrimerPair; rank: number; tmTarget: number }) {
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

export function PrimerPanel({
	seq,
	seqLen,
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
	const [pairs, setPairs] = useState<PrimerPair[] | null>(null);
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
	const runDesign = useCallback(
		(s: number, e: number) => {
			if (Number.isNaN(s) || Number.isNaN(e) || s < 1 || e > seqLen || s >= e) {
				setError("Enter a valid start/end range (1-indexed).");
				return;
			}
			setError(null);
			setWarning(null);
			setRunning(true);
			onPrimersDesigned?.(null);

			workerRef.current?.terminate();

			const worker = new Worker(new URL("./primer-design.worker.ts", import.meta.url));
			workerRef.current = worker;

			const regionLen = e - s;
			worker.postMessage({
				seq,
				regionStart: s - 1,
				regionEnd: e,
				opts: {
					productSizeRange: [regionLen + 36, regionLen + 500] as [number, number],
					tmTarget,
					primerLenRange: [minLen, maxLen] as [number, number],
					gcRange: [gcMin / 100, gcMax / 100] as [number, number],
				},
			});

			worker.onmessage = (ev: MessageEvent<PrimerWorkerResponse>) => {
				worker.terminate();
				workerRef.current = null;
				const msg = ev.data;
				if (msg.type === "success") {
					setPairs(msg.result.pairs);
					onPrimersDesigned?.(msg.result.pairs[0] ?? null);
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
		[seq, seqLen, onPrimersDesigned, tmTarget, minLen, maxLen, gcMin, gcMax],
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
	const regionLen = !Number.isNaN(s) && !Number.isNaN(e) && e > s ? e - s + 1 : null;

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
							Region: <span style={{ color: "#5a5648" }}>{formatLen(regionLen)}</span> · primers
							flank selection
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
					{running ? "Designing…" : "Design Primers"}
				</button>
			</div>

			{/* Results */}
			<div style={{ flex: 1, overflowY: "auto" }}>
				{pairs === null && !running && (
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
										{pairs.length} ranked · click seq to copy
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
