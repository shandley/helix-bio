"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { populateDemoSequences } from "@/app/actions/seed";
import { Button } from "@/components/ui/button";

export function LoadExamplesButton() {
	const router = useRouter();
	const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
	const [count, setCount] = useState(0);

	async function handleLoad() {
		setState("loading");
		try {
			const result = await populateDemoSequences();
			if (result.error) {
				setState("error");
				return;
			}
			setCount(result.count ?? 0);
			setState("done");
			router.refresh();
		} catch {
			setState("error");
		}
	}

	if (state === "done") {
		return (
			<p className="text-sm text-emerald-600">
				{count > 0 ? `Loaded ${count} example sequences.` : "Examples already in your library."}
			</p>
		);
	}

	if (state === "error") {
		return (
			<p className="text-sm text-destructive">
				Failed to fetch from NCBI. Check your connection and try again.
			</p>
		);
	}

	return (
		<Button variant="outline" size="sm" onClick={handleLoad} disabled={state === "loading"}>
			{state === "loading" ? "Fetching from NCBI…" : "Load example sequences"}
		</Button>
	);
}
