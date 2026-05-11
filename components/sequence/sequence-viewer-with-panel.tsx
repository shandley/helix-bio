"use client";

import type { PrimerPair } from "@shandley/primd";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SequenceContext } from "@/app/api/chat/route";
import { CloningModal } from "@/components/cloning/cloning-modal";
import type { Annotation } from "@/lib/bio/annotate";
import { DEFAULT_ENZYMES } from "@/lib/bio/enzymes";
import { type ParsedSequence, parseGenBank } from "@/lib/bio/parse-genbank";
import type { SearchMatch } from "@/lib/bio/search";
import { AIPanel } from "./ai-panel";
import { DigestPanel } from "./digest-panel";
import { EnzymePanel } from "./enzyme-panel";
import { ORFPanel } from "./orf-panel";
import { PrimerPanel } from "./primer-panel";
import { SearchPanel } from "./search-panel";
import { SequenceViewer, type SeqVizSelection } from "./sequence-viewer";

interface SequenceViewerWithPanelProps {
	fileUrl: string;
	name: string;
	topology: "circular" | "linear";
	fileFormat: string;
	gcContent: number | null;
}

type PanelTab = "enzymes" | "primers" | "digest" | "orfs" | "search" | "ai";

const TAB_LABELS: Record<PanelTab, string> = {
	enzymes: "Enzymes",
	primers: "Primers",
	digest: "Digest",
	orfs: "ORFs",
	search: "Search",
	ai: "Ask Ori",
};

export function SequenceViewerWithPanel({
	fileUrl,
	name,
	topology,
	fileFormat,
	gcContent,
}: SequenceViewerWithPanelProps) {
	const [parsed, setParsed] = useState<ParsedSequence | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [selectedEnzymes, setSelectedEnzymes] = useState<string[]>(DEFAULT_ENZYMES);
	const [activeTab, setActiveTab] = useState<PanelTab>("enzymes");
	const [selection, setSelection] = useState<SeqVizSelection | null>(null);
	const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
	const [bestPair, setBestPair] = useState<PrimerPair | null>(null);
	const [annotationName, setAnnotationName] = useState<string | null>(null);
	const [autoAnnotations, setAutoAnnotations] = useState<Annotation[]>([]);
	const [annotating, setAnnotating] = useState(false);
	const annotationWorkerRef = useRef<Worker | null>(null);

	const handleSearchMatches = useCallback((matches: SearchMatch[]) => {
		setSearchMatches(matches);
	}, []);

	const handleSelection = useCallback((sel: SeqVizSelection | null) => {
		setSelection(sel);
		if (sel?.type === "ANNOTATION" && sel.name) {
			// Annotation clicked — jump to Primers tab and pass the name for auto-design
			setActiveTab("primers");
			setAnnotationName(sel.name);
		} else {
			setAnnotationName(null);
		}
	}, []);

	useEffect(() => {
		fetch(fileUrl)
			.then((r) => {
				if (!r.ok) throw new Error(`Failed to fetch sequence (${r.status})`);
				return r.text();
			})
			.then((text) => {
				if (fileFormat === "genbank") {
					const p = parseGenBank(text);
					setParsed({ ...p, name });
				} else if (fileFormat === "fasta") {
					const lines = text.split("\n");
					const seqName = lines[0]?.replace(/^>/, "").split(" ")[0] ?? name;
					const seq = lines.slice(1).join("").replace(/\s/g, "").toUpperCase();
					setParsed({ name: seqName, seq, annotations: [], topology });
				} else {
					throw new Error(`Unsupported format: ${fileFormat}`);
				}
			})
			.catch((e: Error) => setError(e.message));
	}, [fileUrl, name, fileFormat, topology]);

	// Launch annotation worker whenever the sequence changes
	useEffect(() => {
		if (!parsed?.seq) return;
		setAutoAnnotations([]);
		setAnnotating(true);
		annotationWorkerRef.current?.terminate();
		const worker = new Worker(new URL("./annotation.worker.ts", import.meta.url));
		annotationWorkerRef.current = worker;
		worker.postMessage({ seq: parsed.seq });
		worker.onmessage = (e: MessageEvent<{ type: string; annotations?: Annotation[] }>) => {
			if (e.data.type === "success" && e.data.annotations) {
				setAutoAnnotations(e.data.annotations);
			}
			setAnnotating(false);
			worker.terminate();
			annotationWorkerRef.current = null;
		};
		worker.onerror = () => {
			setAnnotating(false);
			worker.terminate();
			annotationWorkerRef.current = null;
		};
		return () => {
			worker.terminate();
			annotationWorkerRef.current = null;
		};
	}, [parsed?.seq]);

	if (error) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-destructive">
				{error}
			</div>
		);
	}

	if (!parsed) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				Loading sequence…
			</div>
		);
	}

	const aiContext: SequenceContext = {
		name,
		seqLen: parsed.seq.length,
		topology,
		gc: gcContent,
		fileFormat,
		annotations: parsed.annotations.map((a) => ({
			name: a.name,
			start: a.start,
			end: a.end,
			direction: a.direction,
		})),
		seq: parsed.seq,
	};

	// Deduplicate auto-annotations against GenBank annotations already in the file.
	// Two rules:
	//   1. Same name (case-insensitive) + any positional overlap → suppress.
	//      Prevents luc+/luc+ and AmpR/AmpR doubles when GenBank already labels it.
	//   2. Different name + >60% positional overlap → suppress.
	//      Prevents pMB1-ori shadowing a pBR322-ori already in the file.
	const dedupedAuto = autoAnnotations.filter((auto) => {
		return !parsed.annotations.some((existing) => {
			const overlapStart = Math.max(existing.start, auto.start);
			const overlapEnd = Math.min(existing.end, auto.end);
			if (overlapEnd <= overlapStart) return false; // no overlap at all
			if (existing.name.toLowerCase() === auto.name.toLowerCase()) return true; // same name, any overlap → suppress
			const overlapLen = overlapEnd - overlapStart;
			const minLen = Math.min(existing.end - existing.start, auto.end - auto.start);
			return minLen > 0 && overlapLen / minLen > 0.6;
		});
	});

	// Merge search hit annotations into the parsed sequence for highlighting
	// Build the annotation-merged parsed object (GenBank + auto + search hits)
	const parsedWithAll = {
		...parsed,
		annotations: [
			...parsed.annotations,
			...dedupedAuto.map((a) => ({
				start: a.start,
				end: a.end,
				name: a.name,
				color: a.color,
				direction: a.direction,
				type: a.type,
			})),
			...searchMatches.map((m, i) => ({
				start: m.start,
				end: m.end,
				name: `Hit ${i + 1}`,
				color: "#f5a623",
				direction: (m.strand === "+" ? 1 : -1) as 1 | -1,
				type: "search_hit",
			})),
		],
	};

	const parsedWithSearch = parsedWithAll;

	return (
		<div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
			{/* Sequence viewer */}
			<div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
				<SequenceViewer
					parsed={parsedWithSearch}
					topology={topology}
					enzymes={selectedEnzymes}
					selection={selection}
					onSelection={handleSelection}
					primerPair={bestPair}
				/>
				{/* Annotation status badge */}
				{(annotating || dedupedAuto.length > 0) && (
					<div
						style={{
							position: "absolute",
							top: "10px",
							right: "12px",
							display: "flex",
							alignItems: "center",
							gap: "5px",
							background: "rgba(245,240,232,0.92)",
							border: "1px solid #ddd8ce",
							borderRadius: "3px",
							padding: "3px 8px",
							fontFamily: "var(--font-courier)",
							fontSize: "8px",
							letterSpacing: "0.06em",
							color: annotating ? "#9a9284" : "#1a4731",
							backdropFilter: "blur(4px)",
							pointerEvents: "none",
						}}
					>
						{annotating ? (
							<>
								<span
									style={{
										display: "inline-block",
										width: "6px",
										height: "6px",
										borderRadius: "50%",
										border: "1.5px solid #9a9284",
										borderTopColor: "transparent",
										animation: "spin 0.8s linear infinite",
									}}
								/>
								detecting features
							</>
						) : (
							<>
								<span style={{ color: "#1a4731" }}>●</span>
								{dedupedAuto.length} feature{dedupedAuto.length !== 1 ? "s" : ""} detected
							</>
						)}
					</div>
				)}
			</div>

			{/* Right panel */}
			<aside
				style={{
					width: "244px",
					flexShrink: 0,
					borderLeft: "1px solid #ddd8ce",
					background: "#faf7f2",
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
				}}
			>
				{/* Clone button */}
				<div
					style={{
						padding: "8px 12px",
						borderBottom: "1px solid #ddd8ce",
						flexShrink: 0,
						background: "#f5f0e8",
						display: "flex",
						justifyContent: "flex-end",
					}}
				>
					<CloningModal seq={parsed.seq} seqName={name} topology={topology} />
				</div>

				{/* Tab bar — two rows of 3 tabs each */}
				<div style={{ flexShrink: 0, background: "#f5f0e8", borderBottom: "1px solid #ddd8ce" }}>
					{[
						["enzymes", "primers", "digest"] as PanelTab[],
						["orfs", "search", "ai"] as PanelTab[],
					].map((row, rowIdx) => (
						<div
							key={rowIdx}
							style={{
								display: "flex",
								borderBottom: rowIdx === 0 ? "1px solid rgba(221,216,206,0.4)" : undefined,
							}}
						>
							{row.map((tab) => (
								<button
									type="button"
									key={tab}
									onClick={() => setActiveTab(tab)}
									style={{
										flex: 1,
										padding: "8px 0",
										fontFamily: "var(--font-courier)",
										fontSize: "7.5px",
										letterSpacing: "0.08em",
										textTransform: "uppercase",
										color: activeTab === tab ? "#1a4731" : "#9a9284",
										background: activeTab === tab ? "rgba(26,71,49,0.05)" : "none",
										border: "none",
										borderBottom: activeTab === tab ? "2px solid #1a4731" : "2px solid transparent",
										cursor: "pointer",
										transition: "color 0.1s",
										marginBottom: "-1px",
										position: "relative",
									}}
								>
									{TAB_LABELS[tab]}
									{tab === "primers" && selection !== null && (
										<span
											style={{
												display: "inline-block",
												width: "4px",
												height: "4px",
												borderRadius: "50%",
												background: "#b8933a",
												marginLeft: "4px",
												verticalAlign: "middle",
												marginBottom: "1px",
											}}
										/>
									)}
									{tab === "search" && searchMatches.length > 0 && (
										<span
											style={{
												display: "inline-block",
												width: "4px",
												height: "4px",
												borderRadius: "50%",
												background: "#f5a623",
												marginLeft: "4px",
												verticalAlign: "middle",
												marginBottom: "1px",
											}}
										/>
									)}
								</button>
							))}
						</div>
					))}
				</div>

				{/* Panel content */}
				<div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
					{activeTab === "enzymes" && (
						<EnzymePanel
							seq={parsed.seq}
							circular={topology === "circular"}
							selected={selectedEnzymes}
							onChange={setSelectedEnzymes}
						/>
					)}
					{activeTab === "primers" && (
						<PrimerPanel
							seq={parsed.seq}
							seqLen={parsed.seq.length}
							topology={topology}
							selectionStart={selection?.start}
							selectionEnd={selection?.end}
							onPrimersDesigned={setBestPair}
							annotationName={annotationName}
						/>
					)}
					{activeTab === "digest" && <DigestPanel seq={parsed.seq} topology={topology} />}
					{activeTab === "orfs" && <ORFPanel seq={parsed.seq} topology={topology} />}
					{activeTab === "search" && (
						<SearchPanel seq={parsed.seq} topology={topology} onMatches={handleSearchMatches} />
					)}
					{activeTab === "ai" && <AIPanel context={aiContext} />}
				</div>
			</aside>
		</div>
	);
}
