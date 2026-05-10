"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteSequence } from "@/app/actions/sequences";

interface DeleteSequenceButtonProps {
	id: string;
	name: string;
}

export function DeleteSequenceButton({ id, name }: DeleteSequenceButtonProps) {
	const router = useRouter();
	const [state, setState] = useState<"idle" | "confirming" | "deleting">("idle");

	const btn: React.CSSProperties = {
		fontFamily: "var(--font-courier)",
		fontSize: "9px",
		letterSpacing: "0.08em",
		textTransform: "uppercase",
		border: "none",
		borderRadius: "2px",
		padding: "4px 10px",
		cursor: "pointer",
	};

	if (state === "confirming") {
		return (
			<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
				<span
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "10px",
						color: "#8b3a2a",
						letterSpacing: "0.02em",
						whiteSpace: "nowrap",
					}}
				>
					Delete &ldquo;{name}&rdquo;?
				</span>
				<button
					type="button"
					onClick={async () => {
						setState("deleting");
						await deleteSequence(id);
						router.push("/dashboard");
						router.refresh();
					}}
					style={{ ...btn, background: "#8b3a2a", color: "white" }}
				>
					Confirm
				</button>
				<button
					type="button"
					onClick={() => setState("idle")}
					style={{ ...btn, background: "none", color: "#5a5648", border: "1px solid #ddd8ce" }}
				>
					Cancel
				</button>
			</div>
		);
	}

	if (state === "deleting") {
		return (
			<span
				style={{
					fontFamily: "var(--font-courier)",
					fontSize: "9px",
					color: "#9a9284",
					letterSpacing: "0.06em",
				}}
			>
				Deleting…
			</span>
		);
	}

	return (
		<button
			type="button"
			onClick={() => setState("confirming")}
			style={{
				fontFamily: "var(--font-courier)",
				fontSize: "9px",
				letterSpacing: "0.08em",
				textTransform: "uppercase",
				color: "#9a9284",
				background: "none",
				border: "none",
				cursor: "pointer",
				padding: "4px 0",
				transition: "color 0.1s",
			}}
			onMouseEnter={(e) => {
				(e.target as HTMLButtonElement).style.color = "#8b3a2a";
			}}
			onMouseLeave={(e) => {
				(e.target as HTMLButtonElement).style.color = "#9a9284";
			}}
		>
			Delete
		</button>
	);
}
