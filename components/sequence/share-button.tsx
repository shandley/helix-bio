"use client";

import { useState } from "react";
import { createOrGetShare } from "@/app/actions/share";

export function ShareButton({ sequenceId }: { sequenceId: string }) {
	const [state, setState] = useState<"idle" | "loading" | "copied">("idle");

	async function handleShare() {
		if (state !== "idle") return;
		setState("loading");
		try {
			const { url } = await createOrGetShare(sequenceId);
			await navigator.clipboard.writeText(url);
			setState("copied");
			setTimeout(() => setState("idle"), 2000);
		} catch {
			setState("idle");
		}
	}

	const label = state === "loading" ? "Sharing…" : state === "copied" ? "Copied!" : "Share";
	const color = state === "copied" ? "#1a4731" : "#5a5648";
	const borderColor = state === "copied" ? "rgba(26,71,49,0.4)" : "#ddd8ce";

	return (
		<button
			type="button"
			onClick={handleShare}
			disabled={state === "loading"}
			style={{
				fontFamily: "var(--font-courier)",
				fontSize: "9px",
				letterSpacing: "0.08em",
				textTransform: "uppercase",
				color,
				background: "none",
				border: `1px solid ${borderColor}`,
				padding: "3px 9px",
				borderRadius: "2px",
				flexShrink: 0,
				cursor: state === "loading" ? "not-allowed" : "pointer",
				transition: "color 0.15s, border-color 0.15s",
			}}
		>
			{label}
		</button>
	);
}
