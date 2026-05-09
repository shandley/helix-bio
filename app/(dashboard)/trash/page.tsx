import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TrashList } from "@/components/sequence/trash-list";
import type { Sequence } from "@/types/database";

export const metadata = { title: "Trash — Ori" };

export default async function TrashPage() {
	const supabase = await createClient();
	const { data: rawSequences } = await supabase
		.from("sequences")
		.select("*")
		.not("deleted_at", "is", null)
		.order("deleted_at", { ascending: false });

	const sequences = (rawSequences as Sequence[] | null) ?? [];

	return (
		<div style={{ maxWidth: "900px", margin: "0 auto", padding: "36px 40px 60px" }}>
			<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
				<Link
					href="/dashboard"
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "9px",
						letterSpacing: "0.1em",
						textTransform: "uppercase",
						color: "#9a9284",
						textDecoration: "none",
					}}
				>
					← Library
				</Link>
				<h1 style={{
					fontFamily: "var(--font-playfair)",
					fontSize: "28px",
					fontWeight: 400,
					color: "#1c1a16",
					letterSpacing: "-0.02em",
					margin: 0,
				}}>
					Trash
				</h1>
				{sequences.length > 0 && (
					<span style={{
						fontFamily: "var(--font-courier)",
						fontSize: "9px",
						color: "#9a9284",
						border: "1px solid #ddd8ce",
						padding: "1px 6px",
						borderRadius: "2px",
					}}>
						{sequences.length}
					</span>
				)}
			</div>

			{sequences.length === 0 ? (
				<div style={{ marginTop: "48px", textAlign: "center" }}>
					<p style={{
						fontFamily: "var(--font-courier)",
						fontSize: "11px",
						color: "#b8b0a4",
						letterSpacing: "0.06em",
						textTransform: "uppercase",
					}}>
						Trash is empty
					</p>
					<p style={{
						fontFamily: "var(--font-courier)",
						fontSize: "11px",
						color: "#9a9284",
						marginTop: "8px",
					}}>
						Deleted sequences appear here and can be restored or permanently removed.
					</p>
				</div>
			) : (
				<>
					<p style={{
						fontFamily: "var(--font-courier)",
						fontSize: "10px",
						color: "#9a9284",
						letterSpacing: "0.03em",
						marginBottom: "16px",
					}}>
						Sequences here are not permanently deleted. Restore to move them back to your library, or delete forever to free storage.
					</p>
					<TrashList sequences={sequences} />
				</>
			)}
		</div>
	);
}
