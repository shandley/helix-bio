import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SequenceViewerWithPanel } from "@/components/sequence/sequence-viewer-with-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteSequence } from "@/app/actions/sequences";
import type { Sequence } from "@/types/database";

function formatLength(bp: number | null) {
	if (!bp) return "—";
	if (bp >= 1000) return `${(bp / 1000).toFixed(1)} kb`;
	return `${bp} bp`;
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

	async function handleDelete() {
		"use server";
		await deleteSequence(id);
		redirect("/dashboard");
	}

	return (
		<div className="flex h-full flex-col">
			{/* Sequence header bar */}
			<div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-2">
				<div className="flex items-center gap-3">
					<Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
						← Dashboard
					</Link>
					<span className="text-muted-foreground">/</span>
					<span className="font-medium text-foreground">{seq.name}</span>
				</div>
				<div className="flex items-center gap-3">
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<span>{formatLength(seq.length)}</span>
						{seq.gc_content != null && <span>· {seq.gc_content.toFixed(1)}% GC</span>}
						<span>·</span>
						<Badge variant="outline" className="text-xs capitalize">
							{seq.topology}
						</Badge>
						<Badge variant="outline" className="text-xs uppercase">
							{seq.file_format}
						</Badge>
					</div>
					<form action={handleDelete}>
						<Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive text-xs">
							Delete
						</Button>
					</form>
				</div>
			</div>

			{/* Viewer area */}
			<div className="flex-1 overflow-hidden">
				{fileUrl ? (
					<SequenceViewerWithPanel
						fileUrl={fileUrl}
						name={seq.name}
						topology={seq.topology}
						fileFormat={seq.file_format}
					/>
				) : (
					<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
						No sequence file available.
					</div>
				)}
			</div>
		</div>
	);
}
