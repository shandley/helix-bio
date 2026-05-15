"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveFromLibrary } from "@/app/actions/library";

interface Props {
	slug: string;
	isLoggedIn: boolean;
}

export function SaveToLibraryButton({ slug, isLoggedIn }: Props) {
	const router = useRouter();
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!isLoggedIn) {
		return (
			<a
				href="/signup"
				style={{
					fontFamily: "var(--font-courier)",
					fontSize: "9px",
					letterSpacing: "0.08em",
					textTransform: "uppercase",
					color: "white",
					background: "#1a4731",
					textDecoration: "none",
					padding: "4px 10px",
					borderRadius: "2px",
					display: "inline-block",
				}}
			>
				Sign up to save →
			</a>
		);
	}

	const handleSave = async () => {
		if (saving || saved) return;
		setSaving(true);
		setError(null);
		const result = await saveFromLibrary(slug);
		if (result.error) {
			setError(result.error);
			setSaving(false);
		} else if (result.id) {
			setSaved(true);
			router.push(`/sequence/${result.id}`);
		}
	};

	if (saved) {
		return (
			<span
				style={{
					fontFamily: "var(--font-courier)",
					fontSize: "9px",
					color: "#1a4731",
					letterSpacing: "0.06em",
				}}
			>
				Saved ✓
			</span>
		);
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
			<button
				type="button"
				onClick={() => void handleSave()}
				disabled={saving}
				style={{
					fontFamily: "var(--font-courier)",
					fontSize: "9px",
					letterSpacing: "0.08em",
					textTransform: "uppercase",
					color: "white",
					background: saving ? "#2d7a54" : "#1a4731",
					border: "none",
					cursor: saving ? "wait" : "pointer",
					padding: "4px 10px",
					borderRadius: "2px",
					opacity: saving ? 0.8 : 1,
				}}
			>
				{saving ? "Saving…" : "Save to my library →"}
			</button>
			{error && (
				<span style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#a02828" }}>
					{error}
				</span>
			)}
		</div>
	);
}
