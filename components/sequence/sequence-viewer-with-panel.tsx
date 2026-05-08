"use client";

import { useEffect, useState } from "react";
import { parseGenBank, type ParsedSequence } from "@/lib/bio/parse-genbank";
import { DEFAULT_ENZYMES } from "@/lib/bio/enzymes";
import { SequenceViewer } from "./sequence-viewer";
import { EnzymePanel } from "./enzyme-panel";

interface SequenceViewerWithPanelProps {
	fileUrl: string;
	name: string;
	topology: "circular" | "linear";
	fileFormat: string;
}

export function SequenceViewerWithPanel({
	fileUrl,
	name,
	topology,
	fileFormat,
}: SequenceViewerWithPanelProps) {
	const [parsed, setParsed] = useState<ParsedSequence | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [selectedEnzymes, setSelectedEnzymes] = useState<string[]>(DEFAULT_ENZYMES);

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

	return (
		<div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
			<div style={{ flex: 1, overflow: "hidden" }}>
				<SequenceViewer
					parsed={parsed}
					topology={topology}
					enzymes={selectedEnzymes}
				/>
			</div>
			<EnzymePanel
				seq={parsed.seq}
				circular={topology === "circular"}
				selected={selectedEnzymes}
				onChange={setSelectedEnzymes}
			/>
		</div>
	);
}
