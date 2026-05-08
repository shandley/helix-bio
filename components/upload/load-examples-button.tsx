"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { populateDemoSequences } from "@/app/actions/seed";

export function LoadExamplesButton() {
	const router = useRouter();
	const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
	const [count, setCount] = useState(0);

	async function handleLoad() {
		setState("loading");
		try {
			const result = await populateDemoSequences();
			if (result.error) { setState("error"); return; }
			setCount(result.count ?? 0);
			setState("done");
			router.refresh();
		} catch {
			setState("error");
		}
	}

	if (state === "done") {
		return (
			<p style={{ fontFamily: "var(--font-courier)", fontSize: "11px", color: "#1a4731", letterSpacing: "0.02em" }}>
				{count > 0 ? `${count} examples loaded` : "Already in library"}
			</p>
		);
	}

	if (state === "error") {
		return (
			<p style={{ fontFamily: "var(--font-courier)", fontSize: "11px", color: "#8b3a2a", letterSpacing: "0.02em" }}>
				Failed — check connection
			</p>
		);
	}

	return (
		<button
			onClick={handleLoad}
			disabled={state === "loading"}
			style={{
				fontFamily: "var(--font-courier)",
				fontSize: "9px",
				letterSpacing: "0.1em",
				textTransform: "uppercase",
				color: state === "loading" ? "#9a9284" : "#1a4731",
				background: "none",
				border: "1px solid",
				borderColor: state === "loading" ? "#ddd8ce" : "rgba(26,71,49,0.4)",
				borderRadius: "2px",
				padding: "6px 12px",
				cursor: state === "loading" ? "default" : "pointer",
				transition: "color 0.1s, border-color 0.1s",
			}}
		>
			{state === "loading" ? "Fetching…" : "Load examples"}
		</button>
	);
}
