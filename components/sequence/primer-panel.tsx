"use client";

import { useState, useCallback, useEffect } from "react";
import { designPrimers, type PrimerCandidate, type PrimerPair } from "@/lib/bio/primer-design";

interface PrimerPanelProps {
	seq: string;
	seqLen: number;
	selectionStart?: number;
	selectionEnd?: number;
}

function Badge({ label, value, warn, bad }: { label: string; value: string; warn?: boolean; bad?: boolean }) {
	const color = bad ? "#8b3a2a" : warn ? "#b8933a" : "#1a4731";
	const bg = bad ? "rgba(139,58,42,0.07)" : warn ? "rgba(184,147,58,0.08)" : "rgba(26,71,49,0.06)";
	const border = bad ? "rgba(139,58,42,0.25)" : warn ? "rgba(184,147,58,0.25)" : "rgba(26,71,49,0.2)";
	return (
		<span style={{
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
		}}>
			<span style={{ opacity: 0.6 }}>{label}</span>
			<span style={{ fontWeight: 700 }}>{value}</span>
		</span>
	);
}

function PrimerCard({
	primer,
	rank,
	highlight,
}: {
	primer: PrimerCandidate;
	rank: number;
	highlight: boolean;
}) {
	const [copied, setCopied] = useState(false);

	function copy() {
		void navigator.clipboard.writeText(primer.seq).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		});
	}

	const tmWarn = Math.abs(primer.tm - 60) > 4;
	const tmBad = Math.abs(primer.tm - 60) > 8;
	const gcWarn = primer.gc < 0.42 || primer.gc > 0.62;
	const hairpinWarn = primer.hairpin >= 4;
	const hairpinBad = primer.hairpin >= 6;
	const dimerWarn = primer.selfDimer >= 3;

	return (
		<div
			onClick={copy}
			title="Click to copy sequence"
			style={{
				padding: "10px 12px",
				borderBottom: "1px solid rgba(221,216,206,0.5)",
				cursor: "pointer",
				background: highlight ? "rgba(26,71,49,0.04)" : "transparent",
				transition: "background 0.1s",
				position: "relative",
			}}
			onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(26,71,49,0.07)"; }}
			onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = highlight ? "rgba(26,71,49,0.04)" : "transparent"; }}
		>
			{/* Rank + copy feedback */}
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
				<span style={{
					fontFamily: "var(--font-courier)",
					fontSize: "9px",
					letterSpacing: "0.1em",
					color: highlight ? "#1a4731" : "#9a9284",
					fontWeight: highlight ? 700 : 400,
				}}>
					#{rank}
				</span>
				<span style={{
					fontFamily: "var(--font-courier)",
					fontSize: "9px",
					color: "#9a9284",
					opacity: copied ? 1 : 0,
					transition: "opacity 0.2s",
				}}>
					copied
				</span>
			</div>

			{/* Sequence */}
			<div style={{
				fontFamily: "var(--font-courier)",
				fontSize: "11px",
				color: "#1c1a16",
				letterSpacing: "0.08em",
				wordBreak: "break-all",
				marginBottom: "7px",
				lineHeight: 1.5,
			}}>
				{primer.seq}
			</div>

			{/* Quality badges */}
			<div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
				<Badge
					label="Tm"
					value={`${primer.tm.toFixed(1)}°`}
					warn={tmWarn && !tmBad}
					bad={tmBad}
				/>
				<Badge
					label="GC"
					value={`${(primer.gc * 100).toFixed(0)}%`}
					warn={gcWarn}
				/>
				<Badge
					label={primer.len + "bp"}
					value=""
				/>
				{!primer.gcClamp && (
					<Badge label="clamp" value="weak" warn />
				)}
				{hairpinWarn && (
					<Badge label="hairpin" value={`${primer.hairpin}bp`} warn={!hairpinBad} bad={hairpinBad} />
				)}
				{dimerWarn && (
					<Badge label="3′ dimer" value={`${primer.selfDimer}bp`} warn />
				)}
				{primer.offTarget > 0 && (
					<Badge label="off-target" value={`${primer.offTarget}`} bad />
				)}
			</div>
		</div>
	);
}

function formatLen(bp: number): string {
	if (bp >= 1000) return `${(bp / 1000).toFixed(1)} kb`;
	return `${bp} bp`;
}

export function PrimerPanel({ seq, seqLen, selectionStart, selectionEnd }: PrimerPanelProps) {
	const [start, setStart] = useState<string>(
		selectionStart !== undefined ? String(selectionStart + 1) : "1",
	);
	const [end, setEnd] = useState<string>(
		selectionEnd !== undefined ? String(selectionEnd + 1) : String(Math.min(seqLen, 500)),
	);
	const [pairs, setPairs] = useState<PrimerPair[] | null>(null);
	const [running, setRunning] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Sync coordinate fields when viewer selection changes
	useEffect(() => {
		if (selectionStart !== undefined) setStart(String(selectionStart + 1));
	}, [selectionStart]);
	useEffect(() => {
		if (selectionEnd !== undefined) setEnd(String(selectionEnd + 1));
	}, [selectionEnd]);

	const design = useCallback(() => {
		const s = parseInt(start, 10);
		const e = parseInt(end, 10);
		if (isNaN(s) || isNaN(e) || s < 1 || e > seqLen || s >= e) {
			setError("Enter a valid start/end range (1-indexed).");
			return;
		}
		setError(null);
		setRunning(true);
		// Run async so the UI can re-render with "running" state before the compute
		setTimeout(() => {
			try {
				const result = designPrimers(seq, s - 1, e - 1);
				setPairs(result);
				if (result.length === 0) setError("No valid primer pairs found. Target region may be too short or have extreme GC content — try ≥ 200 bp.");
			} catch {
				setError("Primer design failed. Check your sequence.");
			}
			setRunning(false);
		}, 0);
	}, [start, end, seq, seqLen]);

	const s = parseInt(start, 10);
	const e = parseInt(end, 10);
	const productSize = !isNaN(s) && !isNaN(e) && e > s ? e - s + 1 : null;

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
			{/* Controls */}
			<div style={{ padding: "14px 16px 12px", borderBottom: "1px solid #ddd8ce", flexShrink: 0 }}>
				<div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "12px" }}>
					<span style={{
						fontFamily: "var(--font-playfair)",
						fontSize: "15px",
						color: "#1c1a16",
						letterSpacing: "-0.01em",
					}}>
						Primers
					</span>
					{selectionStart !== undefined && (
						<span style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#9a9284" }}>
							from selection
						</span>
					)}
				</div>

				{/* Range inputs */}
				<div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
					<div style={{ flex: 1 }}>
						<div style={{ fontFamily: "var(--font-courier)", fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9284", marginBottom: "4px" }}>Start</div>
						<input
							type="number"
							value={start}
							min={1}
							max={seqLen}
							onChange={(e) => setStart(e.target.value)}
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
					<div style={{ flex: 1 }}>
						<div style={{ fontFamily: "var(--font-courier)", fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9284", marginBottom: "4px" }}>End</div>
						<input
							type="number"
							value={end}
							min={1}
							max={seqLen}
							onChange={(e) => setEnd(e.target.value)}
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
				</div>

				{/* Product size preview */}
				<div style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#9a9284", marginBottom: "10px" }}>
					{productSize !== null
						? <>Product: <span style={{ color: "#5a5648" }}>{formatLen(productSize)}</span> · primers placed within region</>
						: <span style={{ color: "#b8b0a4" }}>Primers placed within the selected region</span>
					}
				</div>

				{error && (
					<div style={{
						fontFamily: "var(--font-courier)",
						fontSize: "10px",
						color: "#8b3a2a",
						background: "rgba(139,58,42,0.06)",
						border: "1px solid rgba(139,58,42,0.2)",
						borderRadius: "3px",
						padding: "6px 8px",
						marginBottom: "8px",
					}}>
						{error}
					</div>
				)}

				<button
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
					<div style={{
						padding: "28px 16px",
						fontFamily: "var(--font-courier)",
						fontSize: "10px",
						color: "#9a9284",
						textAlign: "center",
						lineHeight: 1.7,
					}}>
						Select a region in the viewer<br />or enter coordinates above,<br />then click Design Primers.
					</div>
				)}

				{pairs !== null && pairs.length > 0 && (() => {
					// Collect unique fwd and rev primers from all pairs (preserving rank order)
					const seenFwd = new Set<string>();
					const seenRev = new Set<string>();
					const fwdList: PrimerCandidate[] = [];
					const revList: PrimerCandidate[] = [];
					for (const pair of pairs) {
						if (!seenFwd.has(pair.fwd.seq)) { seenFwd.add(pair.fwd.seq); fwdList.push(pair.fwd); }
						if (!seenRev.has(pair.rev.seq)) { seenRev.add(pair.rev.seq); revList.push(pair.rev); }
					}
					const bestFwd = pairs[0].fwd.seq;
					const bestRev = pairs[0].rev.seq;

					return (
						<>
							{/* Pair dimer warning for best pair */}
							{pairs[0].pairDimer >= 3 && (
								<div style={{
									margin: "10px 12px 0",
									padding: "6px 10px",
									background: "rgba(184,147,58,0.08)",
									border: "1px solid rgba(184,147,58,0.25)",
									borderRadius: "3px",
									fontFamily: "var(--font-courier)",
									fontSize: "9px",
									color: "#b8933a",
								}}>
									Best pair has {pairs[0].pairDimer}bp 3′ complementarity — consider alternatives
								</div>
							)}

							{/* Forward section */}
							<div style={{
								padding: "8px 12px 4px",
								background: "#f5f0e8",
								borderBottom: "1px solid #ddd8ce",
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
							}}>
								<span style={{ fontFamily: "var(--font-courier)", fontSize: "8px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#5a5648" }}>
									→ Forward
								</span>
								<span style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#9a9284" }}>
									{fwdList.length} candidates
								</span>
							</div>
							{fwdList.map((p, i) => (
								<PrimerCard key={p.seq} primer={p} rank={i + 1} highlight={p.seq === bestFwd} />
							))}

							{/* Reverse section */}
							<div style={{
								padding: "8px 12px 4px",
								background: "#f5f0e8",
								borderBottom: "1px solid #ddd8ce",
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
							}}>
								<span style={{ fontFamily: "var(--font-courier)", fontSize: "8px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#5a5648" }}>
									← Reverse
								</span>
								<span style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#9a9284" }}>
									{revList.length} candidates
								</span>
							</div>
							{revList.map((p, i) => (
								<PrimerCard key={p.seq} primer={p} rank={i + 1} highlight={p.seq === bestRev} />
							))}

							{/* Best pair summary */}
							<div style={{
								padding: "10px 12px",
								background: "#f5f0e8",
								borderTop: "1px solid #ddd8ce",
							}}>
								<div style={{ fontFamily: "var(--font-courier)", fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9284", marginBottom: "6px" }}>
									Best pair · {formatLen(pairs[0].productSize)} product
								</div>
								<div style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#5a5648", lineHeight: 1.7 }}>
									<span style={{ color: "#9a9284" }}>Tm avg </span>
									{(((pairs[0].fwd.tm + pairs[0].rev.tm) / 2)).toFixed(1)}°C
									<span style={{ margin: "0 6px", color: "#ddd8ce" }}>·</span>
									<span style={{ color: "#9a9284" }}>ΔTm </span>
									{Math.abs(pairs[0].fwd.tm - pairs[0].rev.tm).toFixed(1)}°C
								</div>
							</div>
						</>
					);
				})()}
			</div>
		</div>
	);
}
