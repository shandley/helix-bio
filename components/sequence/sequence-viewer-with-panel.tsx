"use client";

import { useEffect, useState } from "react";
import { parseGenBank, type ParsedSequence } from "@/lib/bio/parse-genbank";
import { DEFAULT_ENZYMES } from "@/lib/bio/enzymes";
import { SequenceViewer, type SeqVizSelection } from "./sequence-viewer";
import { EnzymePanel } from "./enzyme-panel";
import { PrimerPanel } from "./primer-panel";
import { AIPanel } from "./ai-panel";
import type { SequenceContext } from "@/app/api/chat/route";

interface SequenceViewerWithPanelProps {
	fileUrl: string;
	name: string;
	topology: "circular" | "linear";
	fileFormat: string;
	gcContent: number | null;
}

type PanelTab = "enzymes" | "primers" | "ai";

const TAB_LABELS: Record<PanelTab, string> = {
	enzymes: "Enzymes",
	primers: "Primers",
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

	return (
		<div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
			{/* Sequence viewer */}
			<div style={{ flex: 1, overflow: "hidden" }}>
				<SequenceViewer
					parsed={parsed}
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
				{/* Tab bar */}
				<div style={{
					display: "flex",
					borderBottom: "1px solid #ddd8ce",
					flexShrink: 0,
					background: "#f5f0e8",
				}}>
					{(Object.keys(TAB_LABELS) as PanelTab[]).map((tab) => (
						<button
							key={tab}
							onClick={() => setActiveTab(tab)}
							style={{
								flex: 1,
								padding: "10px 0",
								fontFamily: "var(--font-courier)",
								fontSize: "8px",
								letterSpacing: "0.1em",
								textTransform: "uppercase",
								color: activeTab === tab ? "#1a4731" : "#9a9284",
								background: "none",
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
						</button>
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
					{activeTab === "ai" && (
						<AIPanel context={aiContext} />
					)}
				</div>
			</aside>
		</div>
	);
}
