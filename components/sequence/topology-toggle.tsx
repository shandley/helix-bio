"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSequenceMetadata } from "@/app/actions/sequences";

interface TopologyToggleProps {
	id: string;
	topology: "circular" | "linear";
}

function CircularIcon({ color }: { color: string }) {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
			<circle cx="8" cy="8" r="5.5" stroke={color} strokeWidth="1.5" />
		</svg>
	);
}

function LinearIcon({ color }: { color: string }) {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
			<line x1="2" y1="8" x2="14" y2="8" stroke={color} strokeWidth="1.5" />
			<rect x="1" y="5.5" width="2.5" height="5" rx="0.5" fill={color} />
			<rect x="12.5" y="5.5" width="2.5" height="5" rx="0.5" fill={color} />
		</svg>
	);
}

export function TopologyToggle({ id, topology }: TopologyToggleProps) {
	const router = useRouter();
	const [current, setCurrent] = useState(topology);
	const [saving, setSaving] = useState(false);

	async function toggle() {
		if (saving) return;
		const next = current === "circular" ? "linear" : "circular";
		setSaving(true);
		setCurrent(next);
		await updateSequenceMetadata(id, { topology: next });
		setSaving(false);
		router.refresh();
	}

	const color = saving ? "#c8c0b4" : "#8a8278";

	return (
		<button
			onClick={toggle}
			disabled={saving}
			title={`${current} — click to switch to ${current === "circular" ? "linear" : "circular"}`}
			style={{
				background: "none",
				border: "none",
				cursor: saving ? "default" : "pointer",
				padding: "0",
				display: "flex",
				alignItems: "center",
				opacity: saving ? 0.5 : 1,
				transition: "opacity 0.15s",
			}}
		>
			{current === "circular"
				? <CircularIcon color={color} />
				: <LinearIcon color={color} />
			}
		</button>
	);
}
