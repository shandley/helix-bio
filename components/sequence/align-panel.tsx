"use client";

import { parseAbif } from "@shandley/abif-ts";
import { useCallback, useRef, useState } from "react";
import type { AlignmentResult } from "@/lib/bio/align";
import type { AlignWorkerRequest, AlignWorkerResponse } from "./align.worker";
import type { TraceData } from "./chromatogram";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AlignRead {
	id: string;
	name: string;
	sequence: string;
	quality?: number[];
	/** Fluorescence trace channels (ab1 files only) */
	traces?: TraceData;
	peakPositions?: number[];
	traceLength?: number;
	result?: AlignmentResult;
	visible: boolean;
	color: string;
}

interface AlignPanelProps {
	seq: string;
	topology: "circular" | "linear";
	onAlignmentResults?: (reads: AlignRead[]) => void;
	onReadSelect?: (read: AlignRead | null) => void;
}

// Colors for reads (cycling)
const READ_COLORS = [
	"#0891b2",
	"#7c3aed",
	"#b45309",
	"#15803d",
	"#be185d",
	"#1d4ed8",
	"#92400e",
	"#166534",
];

function nextColor(idx: number): string {
	return READ_COLORS[idx % READ_COLORS.length]!;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFasta(text: string): { name: string; sequence: string }[] {
	const results: { name: string; sequence: string }[] = [];
	let name = "";
	let seqParts: string[] = [];
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (trimmed.startsWith(">")) {
			if (name) results.push({ name, sequence: seqParts.join("") });
			name = trimmed.slice(1).split(/\s+/)[0] ?? "read";
			seqParts = [];
		} else if (trimmed && name) {
			seqParts.push(trimmed.replace(/[^ACGTNacgtn]/g, ""));
		}
	}
	if (name) results.push({ name, sequence: seqParts.join("") });
	// Raw sequence (no header)
	if (results.length === 0 && text.trim()) {
		const seq = text.trim().replace(/[^ACGTNacgtn]/g, "");
		if (seq.length > 0) results.push({ name: "pasted_read", sequence: seq });
	}
	return results;
}

async function processFile(file: File, colorIdx: number): Promise<AlignRead[]> {
	const name = file.name.replace(/\.(ab1|abi|fasta?|fa)$/i, "");

	if (/\.(ab1|abi)$/i.test(file.name)) {
		const buffer = await file.arrayBuffer();
		const abif = parseAbif(buffer);
		if (!abif.sequence) throw new Error(`No sequence in ${file.name}`);
		return [
			{
				id: `${Date.now()}-${name}`,
				name,
				sequence: abif.sequence,
				quality: abif.qualityScores.length > 0 ? abif.qualityScores : undefined,
				traces: abif.traces.A.length > 0 ? abif.traces : undefined,
				peakPositions: abif.peakPositions.length > 0 ? abif.peakPositions : undefined,
				traceLength: abif.traceLength,
				visible: true,
				color: nextColor(colorIdx),
			},
		];
	}

	// FASTA / plain text
	const text = await file.text();
	const reads = parseFasta(text);
	return reads.map((r, i) => ({
		id: `${Date.now()}-${name}-${i}`,
		name: reads.length > 1 ? r.name : name,
		sequence: r.sequence,
		visible: true,
		color: nextColor(colorIdx + i),
	}));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ReadRow({
	read,
	onRemove,
	onToggle,
	onShowTrace,
	isTraceActive,
}: {
	read: AlignRead;
	onRemove: () => void;
	onToggle: () => void;
	onShowTrace?: () => void;
	isTraceActive?: boolean;
}) {
	const r = read.result;
	const hasMismatch = r && r.mismatches.length > 0;

	return (
		<div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(221,216,206,0.5)" }}>
			<div
				style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: r ? "4px" : 0 }}
			>
				{/* Color dot + visibility toggle */}
				<button
					type="button"
					onClick={onToggle}
					title={read.visible ? "Hide on map" : "Show on map"}
					style={{
						width: "10px",
						height: "10px",
						borderRadius: "50%",
						background: read.visible ? read.color : "#c8c0b8",
						border: "none",
						cursor: "pointer",
						flexShrink: 0,
						transition: "background 0.15s",
					}}
				/>
				<span
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "9px",
						color: "#1c1a16",
						flex: 1,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{read.name}
				</span>
				{read.traces && onShowTrace && (
					<button
						type="button"
						onClick={onShowTrace}
						title="Show chromatogram"
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "7.5px",
							letterSpacing: "0.06em",
							color: isTraceActive ? "#1a4731" : "#9a9284",
							background: isTraceActive ? "rgba(26,71,49,0.08)" : "none",
							border: `1px solid ${isTraceActive ? "#1a4731" : "#c8c0b8"}`,
							borderRadius: "2px",
							cursor: "pointer",
							padding: "1px 4px",
						}}
					>
						TRACE
					</button>
				)}
				<button
					type="button"
					onClick={onRemove}
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "9px",
						color: "#9a9284",
						background: "none",
						border: "none",
						cursor: "pointer",
						padding: "0 2px",
					}}
				>
					×
				</button>
			</div>

			{r && (
				<div style={{ paddingLeft: "16px" }}>
					<div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
						{/* Strand + position */}
						<span
							style={{
								fontFamily: "var(--font-courier)",
								fontSize: "8px",
								color: r.strand === "+" ? "#1a4731" : "#7c3aed",
							}}
						>
							{r.strand} {r.refStart + 1}–{r.refEnd}
						</span>
						{/* Identity */}
						<span
							style={{
								fontFamily: "var(--font-courier)",
								fontSize: "8px",
								color: r.identity >= 0.99 ? "#1a4731" : r.identity >= 0.95 ? "#b8933a" : "#a02828",
							}}
						>
							{(r.identity * 100).toFixed(1)}%
						</span>
						{/* Coverage */}
						<span style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#9a9284" }}>
							{r.refEnd - r.refStart} bp
						</span>
						{/* Mismatch count */}
						{hasMismatch && (
							<span
								style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#a02828" }}
							>
								{r.mismatches.length} mismatch{r.mismatches.length !== 1 ? "es" : ""}
							</span>
						)}
					</div>

					{/* Mismatch detail list */}
					{r.mismatches.length > 0 && r.mismatches.length <= 10 && (
						<div style={{ marginTop: "3px" }}>
							{r.mismatches.map((m, i) => (
								<div
									key={i}
									style={{
										fontFamily: "var(--font-courier)",
										fontSize: "7.5px",
										color: "#a02828",
										letterSpacing: "0.03em",
									}}
								>
									pos {m.refPos + 1}: {m.refBase}→{m.queryBase}
									{m.qualityScore !== undefined && ` (Q${m.qualityScore})`}
								</div>
							))}
						</div>
					)}
					{r.mismatches.length > 10 && (
						<div
							style={{
								fontFamily: "var(--font-courier)",
								fontSize: "7.5px",
								color: "#a02828",
								marginTop: "2px",
							}}
						>
							{r.mismatches.length} mismatches — see map
						</div>
					)}
				</div>
			)}
		</div>
	);
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function AlignPanel({ seq, topology, onAlignmentResults, onReadSelect }: AlignPanelProps) {
	const [reads, setReads] = useState<AlignRead[]>([]);
	const [pasteText, setPasteText] = useState("");
	const [running, setRunning] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [activeTraceId, setActiveTraceId] = useState<string | null>(null);
	const workerRef = useRef<Worker | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// ── File ingestion ────────────────────────────────────────────────────────

	const addFiles = useCallback(
		async (files: FileList | File[]) => {
			setError(null);
			const incoming: AlignRead[] = [];
			for (const file of Array.from(files)) {
				try {
					const newReads = await processFile(file, reads.length + incoming.length);
					incoming.push(...newReads);
				} catch (e) {
					setError(`Error reading ${file.name}: ${(e as Error).message}`);
				}
			}
			if (incoming.length > 0) setReads((prev) => [...prev, ...incoming]);
		},
		[reads.length],
	);

	const addPasted = useCallback(() => {
		if (!pasteText.trim()) return;
		const parsed = parseFasta(pasteText.trim());
		if (parsed.length === 0) {
			setError("No valid sequence found");
			return;
		}
		const newReads: AlignRead[] = parsed.map((r, i) => ({
			id: `${Date.now()}-paste-${i}`,
			name: r.name,
			sequence: r.sequence,
			visible: true,
			color: nextColor(reads.length + i),
		}));
		setReads((prev) => [...prev, ...newReads]);
		setPasteText("");
		setError(null);
	}, [pasteText, reads.length]);

	// ── Alignment ─────────────────────────────────────────────────────────────

	const runAlignment = useCallback(() => {
		if (reads.length === 0 || !seq) return;
		setRunning(true);
		setError(null);
		workerRef.current?.terminate();

		const worker = new Worker(new URL("./align.worker.ts", import.meta.url));
		workerRef.current = worker;

		const request: AlignWorkerRequest = {
			reads: reads.map((r) => ({ name: r.name, sequence: r.sequence, quality: r.quality })),
			reference: seq,
			topology,
		};
		worker.postMessage(request);

		worker.onmessage = (e: MessageEvent<AlignWorkerResponse>) => {
			worker.terminate();
			workerRef.current = null;
			if (e.data.type === "success") {
				const { results } = e.data;
				const updated = reads.map((r, i) => ({
					...r,
					result: results[i],
				}));
				setReads(updated);
				onAlignmentResults?.(updated);
				// Refresh active trace with alignment result
				if (activeTraceId) {
					const active = updated.find((r) => r.id === activeTraceId);
					if (active) onReadSelect?.(active);
				}
			} else {
				setError(e.data.message);
			}
			setRunning(false);
		};
		worker.onerror = () => {
			worker.terminate();
			workerRef.current = null;
			setError("Alignment failed");
			setRunning(false);
		};
	}, [reads, seq, topology, onAlignmentResults, activeTraceId, onReadSelect]);

	// ── Toggle / remove ───────────────────────────────────────────────────────

	const toggle = (id: string) => {
		const updated = reads.map((r) => (r.id === id ? { ...r, visible: !r.visible } : r));
		setReads(updated);
		onAlignmentResults?.(updated);
	};

	const remove = (id: string) => {
		if (activeTraceId === id) {
			setActiveTraceId(null);
			onReadSelect?.(null);
		}
		const updated = reads.filter((r) => r.id !== id);
		setReads(updated);
		onAlignmentResults?.(updated);
	};

	const showTrace = (read: AlignRead) => {
		if (activeTraceId === read.id) {
			setActiveTraceId(null);
			onReadSelect?.(null);
		} else {
			setActiveTraceId(read.id);
			onReadSelect?.(read);
		}
	};

	// ── Drag and drop ─────────────────────────────────────────────────────────

	const onDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragging(false);
			if (e.dataTransfer.files.length > 0) void addFiles(e.dataTransfer.files);
		},
		[addFiles],
	);

	// ── Render ────────────────────────────────────────────────────────────────

	const btnStyle: React.CSSProperties = {
		fontFamily: "var(--font-courier)",
		fontSize: "9px",
		letterSpacing: "0.08em",
		textTransform: "uppercase",
		border: "none",
		borderRadius: "2px",
		cursor: "pointer",
		padding: "5px 10px",
	};

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
			{/* Drop zone + paste */}
			<div style={{ flexShrink: 0, padding: "10px 12px", borderBottom: "1px solid #ddd8ce" }}>
				{/* Drop / click area */}
				<div
					onClick={() => fileInputRef.current?.click()}
					onDragOver={(e) => {
						e.preventDefault();
						setIsDragging(true);
					}}
					onDragLeave={() => setIsDragging(false)}
					onDrop={onDrop}
					style={{
						border: `1px dashed ${isDragging ? "#1a4731" : "#c8c0b8"}`,
						borderRadius: "3px",
						padding: "10px 8px",
						textAlign: "center",
						cursor: "pointer",
						background: isDragging ? "rgba(26,71,49,0.04)" : "transparent",
						marginBottom: "8px",
						transition: "all 0.15s",
					}}
				>
					<span
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "9px",
							color: "#9a9284",
							letterSpacing: "0.04em",
						}}
					>
						Drop .ab1 or .fasta files here
					</span>
					<br />
					<span style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#b8b0a4" }}>
						or click to browse
					</span>
				</div>
				<input
					ref={fileInputRef}
					type="file"
					multiple
					accept=".ab1,.abi,.fa,.fasta,.fna"
					style={{ display: "none" }}
					onChange={(e) => e.target.files && void addFiles(e.target.files)}
				/>

				{/* Paste area */}
				<div style={{ display: "flex", gap: "6px" }}>
					<textarea
						value={pasteText}
						onChange={(e) => setPasteText(e.target.value)}
						placeholder="Paste sequence or FASTA..."
						rows={2}
						style={{
							flex: 1,
							fontFamily: "var(--font-courier)",
							fontSize: "9px",
							color: "#1c1a16",
							background: "#f5f0e8",
							border: "1px solid #ddd8ce",
							borderRadius: "2px",
							padding: "4px 6px",
							resize: "none",
							letterSpacing: "0.04em",
						}}
					/>
					<button
						type="button"
						onClick={addPasted}
						style={{ ...btnStyle, background: "#1a4731", color: "white", alignSelf: "flex-end" }}
					>
						Add
					</button>
				</div>

				{error && (
					<div
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "9px",
							color: "#a02828",
							marginTop: "6px",
							background: "rgba(160,40,40,0.06)",
							border: "1px solid rgba(160,40,40,0.2)",
							borderRadius: "2px",
							padding: "4px 8px",
						}}
					>
						{error}
					</div>
				)}
			</div>

			{/* Reads list */}
			<div style={{ flex: 1, overflowY: "auto" }}>
				{reads.length === 0 ? (
					<div
						style={{
							padding: "24px 12px",
							fontFamily: "var(--font-courier)",
							fontSize: "9px",
							color: "#9a9284",
							textAlign: "center",
							lineHeight: 1.8,
						}}
					>
						Add sequencing reads above,
						<br />
						then click Align.
					</div>
				) : (
					reads.map((r) => (
						<ReadRow
							key={r.id}
							read={r}
							onRemove={() => remove(r.id)}
							onToggle={() => toggle(r.id)}
							onShowTrace={r.traces ? () => showTrace(r) : undefined}
							isTraceActive={activeTraceId === r.id}
						/>
					))
				)}
			</div>

			{/* Actions */}
			{reads.length > 0 && (
				<div
					style={{
						flexShrink: 0,
						padding: "8px 12px",
						borderTop: "1px solid #ddd8ce",
						display: "flex",
						gap: "8px",
					}}
				>
					<button
						type="button"
						disabled={running}
						onClick={runAlignment}
						style={{
							...btnStyle,
							flex: 1,
							background: running ? "#2d7a54" : "#1a4731",
							color: "white",
							opacity: running ? 0.7 : 1,
						}}
					>
						{running ? "Aligning…" : `Align ${reads.length} read${reads.length !== 1 ? "s" : ""}`}
					</button>
					<button
						type="button"
						onClick={() => {
							setReads([]);
							onAlignmentResults?.([]);
						}}
						style={{
							...btnStyle,
							background: "none",
							border: "1px solid #ddd8ce",
							color: "#9a9284",
						}}
					>
						Clear
					</button>
				</div>
			)}
		</div>
	);
}
