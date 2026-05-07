import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function LandingPage() {
	return (
		<div className="flex min-h-full flex-col">
			<header className="border-b border-border/40 bg-background/95 backdrop-blur">
				<div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
					<div className="flex items-center gap-2">
						<span className="text-lg font-semibold tracking-tight">Helix</span>
						<span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600">
							beta
						</span>
					</div>
					<div className="flex items-center gap-3">
						<Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
							Sign in
						</Link>
						<Link href="/signup" className={cn(buttonVariants({ size: "sm" }))}>
							Get started
						</Link>
					</div>
				</div>
			</header>

			<main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
				<div className="mx-auto max-w-3xl space-y-6">
					<div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/50 px-3 py-1 text-sm text-muted-foreground">
						Open-source molecular biology workbench
					</div>

					<h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
						Visualize, design, and simulate{" "}
						<span className="text-emerald-500">DNA constructs</span>
					</h1>

					<p className="mx-auto max-w-xl text-lg text-muted-foreground">
						An open-source alternative to SnapGene with AI-powered cloning assistance.
						View plasmids, simulate cloning workflows, design primers — free forever.
					</p>

					<div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
						<Link href="/signup" className={cn(buttonVariants({ size: "lg" }))}>
							Start for free
						</Link>
						<Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
							Sign in
						</Link>
					</div>
				</div>

				<div className="mt-20 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
					{[
						{
							title: "Plasmid Visualization",
							desc: "Circular and linear maps with color-coded feature annotations, restriction sites, and primer locations.",
						},
						{
							title: "Cloning Simulation",
							desc: "Simulate restriction enzyme cloning, Gibson Assembly, and Golden Gate workflows in silico.",
						},
						{
							title: "AI Co-pilot",
							desc: "Describe your cloning goal in plain English. Get primer sequences, protocols, and construct predictions.",
						},
					].map((f) => (
						<div
							key={f.title}
							className="rounded-xl border border-border/50 bg-card p-6 text-left"
						>
							<h3 className="font-semibold text-foreground">{f.title}</h3>
							<p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
						</div>
					))}
				</div>
			</main>

			<footer className="border-t border-border/40 py-6 text-center text-sm text-muted-foreground">
				Helix is open source. Built with Next.js, Supabase, and SeqViz.
			</footer>
		</div>
	);
}
