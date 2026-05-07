import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SequenceUploader } from "@/components/upload/sequence-uploader";
import { LoadExamplesButton } from "@/components/upload/load-examples-button";
import { Badge } from "@/components/ui/badge";
import type { Sequence } from "@/types/database";

function formatLength(bp: number | null) {
	if (!bp) return "—";
	if (bp >= 1000) return `${(bp / 1000).toFixed(1)} kb`;
	return `${bp} bp`;
}

function SequenceCard({ seq }: { seq: Sequence }) {
	return (
		<Link
			href={`/sequence/${seq.id}`}
			className="group flex flex-col gap-2 rounded-lg border border-border/50 bg-card p-4 transition-colors hover:border-border"
		>
			<div className="flex items-start justify-between gap-2">
				<span className="font-medium text-foreground group-hover:text-emerald-600 transition-colors">
					{seq.name}
				</span>
				<Badge variant="outline" className="shrink-0 text-xs capitalize">
					{seq.topology}
				</Badge>
			</div>
			<div className="flex items-center gap-3 text-xs text-muted-foreground">
				<span>{formatLength(seq.length)}</span>
				{seq.gc_content != null && <span>{seq.gc_content.toFixed(1)}% GC</span>}
				<span className="ml-auto uppercase tracking-wide">{seq.file_format}</span>
			</div>
			{seq.description && (
				<p className="text-xs text-muted-foreground line-clamp-1">{seq.description}</p>
			)}
		</Link>
	);
}

export default async function DashboardPage() {
	const supabase = await createClient();

	const { data: rawSequences } = await supabase
		.from("sequences")
		.select("*")
		.order("created_at", { ascending: false });
	const sequences = rawSequences as Sequence[] | null;
	const hasSequences = sequences && sequences.length > 0;

	return (
		<div className="mx-auto max-w-4xl px-4 py-8">
			<div className="mb-8 flex items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">My Sequences</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Upload and manage plasmids, linear DNA, and protein sequences.
					</p>
				</div>
				<LoadExamplesButton />
			</div>

			<SequenceUploader />

			{hasSequences ? (
				<div className="mt-8">
					<h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
						Library ({sequences.length})
					</h2>
					<div className="grid gap-3 sm:grid-cols-2">
						{sequences.map((seq) => (
							<SequenceCard key={seq.id} seq={seq} />
						))}
					</div>
				</div>
			) : (
				<div className="mt-8 text-center space-y-3">
					<p className="text-sm text-muted-foreground">
						No sequences yet. Upload a file above or load examples to get started.
					</p>
				</div>
			)}
		</div>
	);
}
