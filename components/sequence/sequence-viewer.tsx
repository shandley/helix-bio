"use client";

import { useEffect, useState } from "react";
import SeqViz from "seqviz";

interface SequenceViewerProps {
	fileUrl: string;
	name: string;
	topology: "circular" | "linear";
}

export function SequenceViewer({ fileUrl, name, topology }: SequenceViewerProps) {
	const [file, setFile] = useState<File | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch(fileUrl)
			.then((r) => {
				if (!r.ok) throw new Error("Failed to load sequence file");
				return r.blob();
			})
			.then((blob) => setFile(new File([blob], name)))
			.catch((e) => setError(e.message));
	}, [fileUrl, name]);

	if (error) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-destructive">
				{error}
			</div>
		);
	}

	if (!file) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				Loading sequence…
			</div>
		);
	}

	return (
		<div className="h-full w-full">
			<SeqViz
				file={file}
				viewer={topology === "circular" ? "both" : "linear"}
				style={{ height: "100%", width: "100%" }}
				showIndex
				showComplement
				showAnnotations
				enzymes={["EcoRI", "BamHI", "HindIII", "NcoI", "NheI", "XhoI", "SalI", "KpnI", "SacI", "XbaI"]}
			/>
		</div>
	);
}
