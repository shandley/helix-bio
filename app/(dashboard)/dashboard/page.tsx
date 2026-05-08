import { createClient } from "@/lib/supabase/server";
import { SequenceUploader } from "@/components/upload/sequence-uploader";
import { LoadExamplesButton } from "@/components/upload/load-examples-button";
import { SequenceLibrary } from "@/components/sequence/sequence-library";
import type { Sequence } from "@/types/database";

export default async function DashboardPage() {
	const supabase = await createClient();
	const { data: rawSequences } = await supabase
		.from("sequences")
		.select("*")
		.order("created_at", { ascending: false });
	const sequences = (rawSequences as Sequence[] | null) ?? [];

	return (
		<div style={{ maxWidth: "900px", margin: "0 auto", padding: "36px 40px 60px" }}>
			{/* Page header */}
			<div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", gap: "16px" }}>
				<div>
					<h1 style={{
						fontFamily: "var(--font-playfair)",
						fontSize: "28px",
						fontWeight: 400,
						color: "#1c1a16",
						letterSpacing: "-0.02em",
						margin: 0,
						lineHeight: 1.2,
					}}>
						Sequence Library
					</h1>
					<p style={{
						fontFamily: "var(--font-courier)",
						fontSize: "11px",
						color: "#9a9284",
						letterSpacing: "0.04em",
						marginTop: "6px",
					}}>
						Upload and explore plasmids, vectors, and linear constructs
					</p>
				</div>
				<div style={{ paddingTop: "4px", flexShrink: 0 }}>
					<LoadExamplesButton />
				</div>
			</div>

			{/* Upload zone */}
			<SequenceUploader />

			{/* Library or empty state */}
			{sequences.length > 0 ? (
				<SequenceLibrary sequences={sequences} />
			) : (
				<div style={{ marginTop: "48px", textAlign: "center" }}>
					<p style={{
						fontFamily: "var(--font-courier)",
						fontSize: "11px",
						color: "#b8b0a4",
						letterSpacing: "0.06em",
						textTransform: "uppercase",
					}}>
						No sequences yet
					</p>
					<p style={{
						fontFamily: "var(--font-courier)",
						fontSize: "11px",
						color: "#9a9284",
						marginTop: "8px",
						letterSpacing: "0.02em",
					}}>
						Drop a file above, browse to upload, or load example sequences to get started.
					</p>
				</div>
			)}
		</div>
	);
}
