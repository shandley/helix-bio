import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SequenceViewerWithPanel } from "@/components/sequence/sequence-viewer-with-panel";
import { DeleteSequenceButton } from "@/components/sequence/delete-sequence-button";
import { SequenceNameEditor } from "@/components/sequence/sequence-name-editor";
import type { Sequence } from "@/types/database";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
	const { id } = await params;
	const supabase = await createClient();
	const { data } = await supabase.from("sequences").select("name").eq("id", id).single();
	return { title: data?.name ? `${data.name} — Ori` : "Ori" };
}

function formatExt(format: string): string {
	if (format === "genbank") return ".gb";
	if (format === "fasta") return ".fa";
	if (format === "embl") return ".embl";
	return ".gb";
}

function formatLength(bp: number | null) {
	if (!bp) return "—";
	if (bp >= 1_000_000) return `${(bp / 1_000_000).toFixed(2)} Mb`;
	if (bp >= 1000) return `${(bp / 1000).toFixed(1)} kb`;
	return `${bp} bp`;
}

function CircularIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-label="Circular" style={{ flexShrink: 0 }}>
			<circle cx="8" cy="8" r="5.5" stroke="#8a8278" strokeWidth="1.5" />
		</svg>
	);
}

function LinearIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-label="Linear" style={{ flexShrink: 0 }}>
			<line x1="2" y1="8" x2="14" y2="8" stroke="#8a8278" strokeWidth="1.5" />
			<rect x="1" y="5.5" width="2.5" height="5" rx="0.5" fill="#8a8278" />
			<rect x="12.5" y="5.5" width="2.5" height="5" rx="0.5" fill="#8a8278" />
		</svg>
	);
}

export default async function SequencePage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const supabase = await createClient();

	const { data: rawSeq } = await supabase.from("sequences").select("*").eq("id", id).single();
	const seq = rawSeq as Sequence | null;
	if (!seq) notFound();

	let fileUrl: string | null = null;
	if (seq.file_path) {
		const { data } = await supabase.storage
			.from("sequences")
			.createSignedUrl(seq.file_path, 3600);
		fileUrl = data?.signedUrl ?? null;
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

			{/* Header bar */}
			<div style={{
				height: "48px",
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				borderBottom: "1px solid #ddd8ce",
				background: "rgba(245,240,232,0.97)",
				padding: "0 20px",
				flexShrink: 0,
				gap: "16px",
			}}>

				{/* Left: breadcrumb + name */}
				<div style={{ display: "flex", alignItems: "center", overflow: "hidden", gap: "0", flex: 1, minWidth: 0 }}>
					<Link
						href="/dashboard"
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "10px",
							letterSpacing: "0.1em",
							textTransform: "uppercase",
							color: "#9a9284",
							textDecoration: "none",
							flexShrink: 0,
							transition: "color 0.1s",
						}}
					>
						Library
					</Link>
					<span style={{
						fontFamily: "var(--font-courier)",
						fontSize: "12px",
						color: "#c8c0b4",
						margin: "0 10px",
						flexShrink: 0,
					}}>
						/
					</span>
					<SequenceNameEditor id={seq.id} name={seq.name} />
				</div>

				{/* Right: metadata + delete */}
				<div style={{ display: "flex", alignItems: "center", gap: "14px", flexShrink: 0 }}>

					{/* Sequence stats */}
					<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
						<span style={{
							fontFamily: "var(--font-courier)",
							fontSize: "11px",
							color: "#5a5648",
						}}>
							{formatLength(seq.length)}
						</span>

						{seq.topology === "circular" ? <CircularIcon /> : <LinearIcon />}

						{seq.gc_content != null && (
							<span style={{
								fontFamily: "var(--font-courier)",
								fontSize: "11px",
								color: "#9a9284",
							}}>
								{seq.gc_content.toFixed(1)}% GC
							</span>
						)}

						<span style={{
							fontFamily: "var(--font-courier)",
							fontSize: "9px",
							letterSpacing: "0.1em",
							textTransform: "uppercase",
							color: "#9a9284",
							border: "1px solid #ddd8ce",
							padding: "2px 7px",
							borderRadius: "2px",
						}}>
							{seq.file_format}
						</span>
					</div>

					{/* Divider */}
					<div style={{ width: "1px", height: "16px", background: "#ddd8ce", flexShrink: 0 }} />

					{/* Download */}
					{fileUrl && (
						<a
							href={fileUrl}
							download={`${seq.name}${formatExt(seq.file_format)}`}
							style={{
								fontFamily: "var(--font-courier)",
								fontSize: "9px",
								letterSpacing: "0.08em",
								textTransform: "uppercase",
								color: "#5a5648",
								textDecoration: "none",
								border: "1px solid #ddd8ce",
								padding: "3px 9px",
								borderRadius: "2px",
								flexShrink: 0,
							}}
						>
							Download
						</a>
					)}

					{/* Divider */}
					<div style={{ width: "1px", height: "16px", background: "#ddd8ce", flexShrink: 0 }} />

					<DeleteSequenceButton id={seq.id} name={seq.name} />
				</div>
			</div>

			{/* Viewer */}
			<div style={{ flex: 1, overflow: "hidden" }}>
				{fileUrl ? (
					<SequenceViewerWithPanel
						fileUrl={fileUrl}
						name={seq.name}
						topology={seq.topology}
						fileFormat={seq.file_format}
						gcContent={seq.gc_content}
					/>
				) : (
					<div style={{
						display: "flex",
						height: "100%",
						alignItems: "center",
						justifyContent: "center",
						fontFamily: "var(--font-courier)",
						fontSize: "11px",
						color: "#9a9284",
						letterSpacing: "0.04em",
					}}>
						No sequence file available.
					</div>
				)}
			</div>
		</div>
	);
}
