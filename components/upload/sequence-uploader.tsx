"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

const ACCEPTED = [".gb", ".gbk", ".genbank", ".fa", ".fasta", ".fna", ".dna", ".embl"];

function UploadIcon({ color }: { color: string }) {
	return (
		<svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
			<path d="M14 18V8M14 8L9 13M14 8L19 13" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
			<path d="M6 21h16" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
		</svg>
	);
}

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

	const iconColor = dragging ? "#1a4731" : uploading ? "#9a9284" : "#c8c0b4";

	return (
		<div
			onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
			onDragLeave={() => setDragging(false)}
			onDrop={onDrop}
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: "10px",
				padding: "36px 24px",
				border: `1px ${dragging ? "solid" : "dashed"} ${dragging ? "#1a4731" : "#c8c0b4"}`,
				borderRadius: "3px",
				background: dragging ? "rgba(26,71,49,0.03)" : "#faf7f2",
				transition: "border-color 0.15s, background 0.15s",
				cursor: uploading ? "default" : "default",
			}}
		>
			<UploadIcon color={iconColor} />

			<div style={{ textAlign: "center" }}>
				{uploading ? (
					<p style={{
						fontFamily: "var(--font-courier)",
						fontSize: "12px",
						color: "#9a9284",
						letterSpacing: "0.04em",
					}}>
						Uploading…
					</p>
				) : (
					<p style={{
						fontFamily: "var(--font-courier)",
						fontSize: "12px",
						color: "#5a5648",
						letterSpacing: "0.02em",
					}}>
						Drop a sequence file, or{" "}
						<label style={{ color: "#1a4731", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" }}>
							browse
							<input
								type="file"
								style={{ display: "none" }}
								accept={ACCEPTED.join(",")}
								onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
							/>
						</label>
					</p>
				)}
				<p style={{
					fontFamily: "var(--font-courier)",
					fontSize: "9px",
					letterSpacing: "0.08em",
					color: "#b8b0a4",
					marginTop: "4px",
					textTransform: "uppercase",
				}}>
					GenBank · FASTA · SnapGene · EMBL
				</p>
			</div>

			{error && (
				<p style={{
					fontFamily: "var(--font-courier)",
					fontSize: "11px",
					color: "#8b3a2a",
					letterSpacing: "0.02em",
				}}>
					{error}
				</p>
			)}
		</div>
	);
}
