"use client";

import { useEffect, useState } from "react";
import SeqViz from "seqviz";
import { parseGenBank, type ParsedSequence } from "@/lib/bio/parse-genbank";

interface SequenceViewerProps {
	fileUrl: string;
	name: string;
	topology: "circular" | "linear";
	fileFormat: string;
}

export function SequenceViewer({ fileUrl, name, topology, fileFormat }: SequenceViewerProps) {
	const [parsed, setParsed] = useState<ParsedSequence | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch(fileUrl)
			.then((r) => {
				if (!r.ok) throw new Error(`Failed to fetch sequence (${r.status})`);
				return r.text();
			})
			.then((text) => {
				if (fileFormat === "genbank") {
					setParsed(parseGenBank(text));
				} else if (fileFormat === "fasta") {
					// Simple FASTA: strip header, collect sequence
					const lines = text.split("\n");
					const seqName = lines[0]?.replace(/^>/, "").split(" ")[0] ?? name;
					const seq = lines
						.slice(1)
						.join("")
						.replace(/\s/g, "")
						.toUpperCase();
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

	// SeqViz AnnotationProp only allows {start, end, name, color, direction}
	const seqvizAnnotations = parsed.annotations.map(({ start, end, name, color, direction }) => ({
		start,
		end,
		name,
		color,
		direction,
	}));

	return (
		<div className="h-full w-full">
			<SeqViz
				name={parsed.name}
				seq={parsed.seq}
				annotations={seqvizAnnotations}
				viewer={topology === "circular" ? "both" : "linear"}
				style={{ height: "100%", width: "100%" }}
				showIndex
				showComplement
				enzymes={["EcoRI", "BamHI", "HindIII", "NcoI", "NheI", "XhoI", "SalI", "KpnI", "SacI", "XbaI"]}
			/>
		</div>
	);
}
