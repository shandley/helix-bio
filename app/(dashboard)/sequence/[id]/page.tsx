import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteSequenceButton } from "@/components/sequence/delete-sequence-button";
import { SequenceDescriptionEditor } from "@/components/sequence/sequence-description-editor";
import { SequenceNameEditor } from "@/components/sequence/sequence-name-editor";
import { SequenceViewerWithPanel } from "@/components/sequence/sequence-viewer-with-panel";
import { ShareButton } from "@/components/sequence/share-button";
import { TopologyToggle } from "@/components/sequence/topology-toggle";
import { createClient } from "@/lib/supabase/server";
import type { Sequence } from "@/types/database";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
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

export default async function SequencePage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const supabase = await createClient();

	const { data: rawSeq } = await supabase
		.from("sequences")
		.select("*")
		.eq("id", id)
		.is("deleted_at", null)
		.single();
	const seq = rawSeq as Sequence | null;
	if (!seq) notFound();

	let fileUrl: string | null = null;
	if (seq.file_path) {
		const { data } = await supabase.storage.from("sequences").createSignedUrl(seq.file_path, 3600);
		fileUrl = data?.signedUrl ?? null;
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			{/* Header bar — two-line */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					borderBottom: "1px solid #ddd8ce",
					background: "rgba(245,240,232,0.97)",
					padding: "0 20px",
					flexShrink: 0,
					gap: "16px",
					minHeight: "56px",
				}}
			>
				{/* Left: breadcrumb, name, description */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						overflow: "hidden",
						gap: "0",
						flex: 1,
						minWidth: 0,
					}}
				>
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
					<span
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "12px",
							color: "#c8c0b4",
							margin: "0 10px",
							flexShrink: 0,
						}}
					>
						/
					</span>
					<div style={{ overflow: "hidden", minWidth: 0 }}>
						<SequenceNameEditor id={seq.id} name={seq.name} />
						<div style={{ marginTop: "2px" }}>
							<SequenceDescriptionEditor id={seq.id} description={seq.description} />
						</div>
					</div>
				</div>

				{/* Right: stats + actions */}
				<div style={{ display: "flex", alignItems: "center", gap: "14px", flexShrink: 0 }}>
					<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
						<span style={{ fontFamily: "var(--font-courier)", fontSize: "11px", color: "#5a5648" }}>
							{formatLength(seq.length)}
						</span>

						<TopologyToggle id={seq.id} topology={seq.topology} />

						{seq.gc_content != null && (
							<span
								style={{ fontFamily: "var(--font-courier)", fontSize: "11px", color: "#9a9284" }}
							>
								{seq.gc_content.toFixed(1)}% GC
							</span>
						)}

						<span
							style={{
								fontFamily: "var(--font-courier)",
								fontSize: "9px",
								letterSpacing: "0.1em",
								textTransform: "uppercase",
								color: "#9a9284",
								border: "1px solid #ddd8ce",
								padding: "2px 7px",
								borderRadius: "2px",
							}}
						>
							{seq.file_format}
						</span>
					</div>

					<div style={{ width: "1px", height: "16px", background: "#ddd8ce", flexShrink: 0 }} />

					<ShareButton sequenceId={seq.id} />

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
					<div
						style={{
							display: "flex",
							height: "100%",
							alignItems: "center",
							justifyContent: "center",
							fontFamily: "var(--font-courier)",
							fontSize: "11px",
							color: "#9a9284",
							letterSpacing: "0.04em",
						}}
					>
						No sequence file available.
					</div>
				)}
			</div>
		</div>
	);
}
