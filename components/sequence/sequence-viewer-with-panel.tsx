"use client";

import { useEffect, useState, useCallback } from "react";
import { parseGenBank, type ParsedSequence } from "@/lib/bio/parse-genbank";
import { DEFAULT_ENZYMES } from "@/lib/bio/enzymes";
import { SequenceViewer, type SeqVizSelection } from "./sequence-viewer";
import { EnzymePanel } from "./enzyme-panel";
import { PrimerPanel } from "./primer-panel";
import { AIPanel } from "./ai-panel";
import { DigestPanel } from "./digest-panel";
import { ORFPanel } from "./orf-panel";
import { SearchPanel } from "./search-panel";
import { CloningModal } from "@/components/cloning/cloning-modal";
import type { SequenceContext } from "@/app/api/chat/route";
import type { SearchMatch } from "@/lib/bio/search";

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

	const handleSearchMatches = useCallback((matches: SearchMatch[]) => {
		setSearchMatches(matches);
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

	// Merge search hit annotations into the parsed sequence for highlighting
	const parsedWithSearch = searchMatches.length > 0 ? {
		...parsed,
		annotations: [
			...parsed.annotations,
			...searchMatches.map((m, i) => ({
				start: m.start,
				end: m.end,
				name: `Hit ${i + 1}`,
				color: "#f5a623",
				direction: (m.strand === "+" ? 1 : -1) as 1 | -1,
				type: "search_hit",
			})),
		],
	} : parsed;

	return (
		<div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
			{/* Sequence viewer */}
			<div style={{ flex: 1, overflow: "hidden" }}>
				<SequenceViewer
					parsed={parsedWithSearch}
					topology={topology}
					enzymes={selectedEnzymes}
					onSelection={setSelection}
				/>
			</div>

			{/* Right panel */}
			<aside style={{
				width: "244px",
				flexShrink: 0,
				borderLeft: "1px solid #ddd8ce",
				background: "#faf7f2",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}>
				{/* Clone button */}
				<div style={{
					padding: "8px 12px",
					borderBottom: "1px solid #ddd8ce",
					flexShrink: 0,
					background: "#f5f0e8",
					display: "flex",
					justifyContent: "flex-end",
				}}>
					<CloningModal seq={parsed.seq} seqName={name} topology={topology} />
				</div>

				{/* Tab bar — two rows of 3 tabs each */}
				<div style={{ flexShrink: 0, background: "#f5f0e8", borderBottom: "1px solid #ddd8ce" }}>
					{[["enzymes", "primers", "digest"] as PanelTab[], ["orfs", "search", "ai"] as PanelTab[]].map((row, rowIdx) => (
						<div key={rowIdx} style={{ display: "flex", borderBottom: rowIdx === 0 ? "1px solid rgba(221,216,206,0.4)" : undefined }}>
							{row.map((tab) => (
								<button
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
										<span style={{
											display: "inline-block",
											width: "4px",
											height: "4px",
											borderRadius: "50%",
											background: "#b8933a",
											marginLeft: "4px",
											verticalAlign: "middle",
											marginBottom: "1px",
										}} />
									)}
									{tab === "search" && searchMatches.length > 0 && (
										<span style={{
											display: "inline-block",
											width: "4px",
											height: "4px",
											borderRadius: "50%",
											background: "#f5a623",
											marginLeft: "4px",
											verticalAlign: "middle",
											marginBottom: "1px",
										}} />
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
							selectionStart={selection?.start}
							selectionEnd={selection?.end}
						/>
					)}
					{activeTab === "digest" && (
						<DigestPanel seq={parsed.seq} topology={topology} />
					)}
					{activeTab === "orfs" && (
						<ORFPanel seq={parsed.seq} topology={topology} />
					)}
					{activeTab === "search" && (
						<SearchPanel
							seq={parsed.seq}
							topology={topology}
							onMatches={handleSearchMatches}
						/>
					)}
					{activeTab === "ai" && (
						<AIPanel context={aiContext} />
					)}
				</div>
			</aside>
		</div>
	);
}
