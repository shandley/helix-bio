"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const ACCEPTED = [".gb", ".gbk", ".genbank", ".fa", ".fasta", ".fna", ".dna", ".embl"];

export function SequenceUploader() {
	const router = useRouter();
	const [dragging, setDragging] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const upload = useCallback(
		async (file: File) => {
			setUploading(true);
			setError(null);

			const form = new FormData();
			form.append("file", file);

			const res = await fetch("/api/sequences/upload", { method: "POST", body: form });
			const data = await res.json();

			if (!res.ok) {
				setError(data.error ?? "Upload failed");
				setUploading(false);
				return;
			}

			router.push(`/sequence/${data.sequence.id}`);
			router.refresh();
		},
		[router],
	);

	const onDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setDragging(false);
			const file = e.dataTransfer.files[0];
			if (file) upload(file);
		},
		[upload],
	);

	return (
		<div
			onDragOver={(e) => {
				e.preventDefault();
				setDragging(true);
			}}
			onDragLeave={() => setDragging(false)}
			onDrop={onDrop}
			className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
				dragging ? "border-emerald-500 bg-emerald-500/5" : "border-border/60 hover:border-border"
			}`}
		>
			<p className="text-sm text-muted-foreground">
				Drag & drop a sequence file, or{" "}
				<label className="cursor-pointer text-foreground underline underline-offset-4">
					browse
					<input
						type="file"
						className="sr-only"
						accept={ACCEPTED.join(",")}
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) upload(file);
						}}
					/>
				</label>
			</p>
			<p className="mt-1 text-xs text-muted-foreground">
				GenBank (.gb, .gbk), FASTA (.fa, .fasta), SnapGene (.dna), EMBL (.embl)
			</p>
			{uploading && <p className="mt-3 text-sm text-muted-foreground">Uploading…</p>}
			{error && <p className="mt-3 text-sm text-destructive">{error}</p>}
		</div>
	);
}
