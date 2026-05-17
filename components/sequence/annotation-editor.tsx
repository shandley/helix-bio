"use client";

import { useState } from "react";
import type { Annotation } from "@/lib/bio/annotate";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AnnotationOverride {
	name?: string;
	color?: string;
	deleted?: boolean;
}

export type OverrideMap = Record<string, AnnotationOverride>;

/** Minimal shape shared by BioAnnotation and Annotation */
export type AnnotationLike = {
	name: string;
	start: number;
	end: number;
	color?: string;
	direction: 1 | -1;
	type: string;
};

export function annKey(ann: { start: number; end: number }): string {
	return `${ann.start}:${ann.end}`;
}

export function applyOverrides<T extends AnnotationLike>(
	annotations: T[],
	overrides: OverrideMap,
): T[] {
	return annotations
		.filter((a) => !overrides[annKey(a)]?.deleted)
		.map((a) => {
			const ov = overrides[annKey(a)];
			if (!ov) return a;
			return { ...a, name: ov.name ?? a.name, color: ov.color ?? a.color };
		});
}

export function loadOverrides(fileUrl: string): OverrideMap {
	try {
		const raw = localStorage.getItem(`ori-ann:${fileUrl}`);
		return raw ? (JSON.parse(raw) as OverrideMap) : {};
	} catch {
		return {};
	}
}

export function saveOverrides(fileUrl: string, overrides: OverrideMap): void {
	try {
		localStorage.setItem(`ori-ann:${fileUrl}`, JSON.stringify(overrides));
	} catch {
		/* storage full or unavailable */
	}
}

// ── Color presets ─────────────────────────────────────────────────────────────

const PRESET_COLORS = [
	"#85DAE9",
	"#75D7A0",
	"#F5A623",
	"#E68FD1",
	"#9B8DD8",
	"#F97B5A",
	"#b8933a",
	"#dc2626",
	"#2244bb",
	"#1a4731",
	"#5a5648",
	"#c8c0b8",
];

// ── Component ─────────────────────────────────────────────────────────────────

interface AnnotationEditorProps {
	annotation: AnnotationLike;
	onSave: (key: string, override: AnnotationOverride) => void;
	onDelete: (key: string) => void;
	onClose: () => void;
}

export function AnnotationEditor({ annotation, onSave, onDelete, onClose }: AnnotationEditorProps) {
	const [editing, setEditing] = useState(false);
	const [name, setName] = useState(annotation.name);
	const [color, setColor] = useState(annotation.color ?? "#85DAE9");
	const [confirmDelete, setConfirmDelete] = useState(false);

	const key = annKey(annotation);
	const len = annotation.end - annotation.start;
	const strand = annotation.direction === 1 ? "+" : "−";
	const posStr = `${annotation.start + 1}–${annotation.end}`;

	const handleSave = () => {
		onSave(key, { name: name.trim() || annotation.name, color });
		setEditing(false);
	};

	const handleDelete = () => {
		onDelete(key);
		onClose();
	};

	const handleCancel = () => {
		setName(annotation.name);
		setColor(annotation.color ?? "#85DAE9");
		setEditing(false);
		setConfirmDelete(false);
	};

	const s: React.CSSProperties = {
		fontFamily: "var(--font-courier)",
		fontSize: "8px",
		letterSpacing: "0.04em",
	};

	return (
		<div
			style={{
				borderBottom: "1px solid #ddd8ce",
				background: "#f5f0e8",
				padding: editing ? "10px 12px" : "7px 12px",
				flexShrink: 0,
			}}
		>
			{!editing ? (
				/* Compact view */
				<div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
					{/* Color swatch */}
					<div
						style={{
							width: "8px",
							height: "8px",
							borderRadius: "50%",
							flexShrink: 0,
							background: annotation.color ?? "#85DAE9",
							border: "1px solid rgba(0,0,0,0.1)",
						}}
					/>

					{/* Name */}
					<span
						style={{
							...s,
							fontSize: "9px",
							color: "#1c1a16",
							fontWeight: "bold",
							flex: 1,
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}}
					>
						{annotation.name}
					</span>

					{/* Metadata */}
					<span style={{ ...s, color: "#9a9284", flexShrink: 0 }}>{annotation.type}</span>
					<span style={{ ...s, color: "#9a9284", flexShrink: 0 }}>
						{strand} {posStr}
					</span>
					<span style={{ ...s, color: "#9a9284", flexShrink: 0 }}>{len} bp</span>

					{/* Edit button */}
					<button
						type="button"
						onClick={() => setEditing(true)}
						title="Edit annotation"
						style={{
							...s,
							fontSize: "9px",
							color: "#9a9284",
							background: "none",
							border: "none",
							cursor: "pointer",
							padding: "0 2px",
							flexShrink: 0,
						}}
					>
						✎
					</button>

					{/* Close */}
					<button
						type="button"
						onClick={onClose}
						style={{
							...s,
							fontSize: "11px",
							color: "#9a9284",
							background: "none",
							border: "none",
							cursor: "pointer",
							padding: "0 2px",
							flexShrink: 0,
						}}
					>
						×
					</button>
				</div>
			) : (
				/* Edit form */
				<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
					{/* Name input */}
					<input
						value={name}
						onChange={(e) => setName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleSave();
							if (e.key === "Escape") handleCancel();
						}}
						// biome-ignore lint/a11y/noAutofocus: intentional — user just clicked Edit
						autoFocus
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "9px",
							color: "#1c1a16",
							background: "#faf7f2",
							border: "1px solid #c8c0b8",
							borderRadius: "2px",
							padding: "4px 8px",
							width: "100%",
							boxSizing: "border-box",
							outline: "none",
						}}
					/>

					{/* Color swatches */}
					<div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
						{PRESET_COLORS.map((c) => (
							<button
								key={c}
								type="button"
								onClick={() => setColor(c)}
								style={{
									width: "16px",
									height: "16px",
									borderRadius: "3px",
									background: c,
									border: color === c ? "2px solid #1c1a16" : "1px solid rgba(0,0,0,0.12)",
									cursor: "pointer",
									padding: 0,
								}}
							/>
						))}
					</div>

					{/* Action buttons */}
					<div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
						{!confirmDelete ? (
							<button
								type="button"
								onClick={() => setConfirmDelete(true)}
								style={{
									...s,
									letterSpacing: "0.06em",
									textTransform: "uppercase",
									color: "#a02828",
									background: "none",
									border: "1px solid rgba(160,40,40,0.3)",
									borderRadius: "2px",
									cursor: "pointer",
									padding: "3px 8px",
								}}
							>
								Delete
							</button>
						) : (
							<span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
								<span style={{ ...s, color: "#a02828", letterSpacing: "0.04em" }}>Delete?</span>
								<button
									type="button"
									onClick={handleDelete}
									style={{
										...s,
										letterSpacing: "0.06em",
										textTransform: "uppercase",
										color: "#ffffff",
										background: "#a02828",
										border: "none",
										borderRadius: "2px",
										cursor: "pointer",
										padding: "3px 8px",
									}}
								>
									Yes
								</button>
								<button
									type="button"
									onClick={() => setConfirmDelete(false)}
									style={{
										...s,
										letterSpacing: "0.06em",
										textTransform: "uppercase",
										color: "#9a9284",
										background: "none",
										border: "1px solid #ddd8ce",
										borderRadius: "2px",
										cursor: "pointer",
										padding: "3px 8px",
									}}
								>
									No
								</button>
							</span>
						)}
						<div style={{ flex: 1 }} />
						<button
							type="button"
							onClick={handleCancel}
							style={{
								...s,
								letterSpacing: "0.06em",
								textTransform: "uppercase",
								color: "#9a9284",
								background: "none",
								border: "1px solid #ddd8ce",
								borderRadius: "2px",
								cursor: "pointer",
								padding: "3px 8px",
							}}
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleSave}
							style={{
								...s,
								letterSpacing: "0.06em",
								textTransform: "uppercase",
								color: "#ffffff",
								background: "#1a4731",
								border: "none",
								borderRadius: "2px",
								cursor: "pointer",
								padding: "3px 10px",
							}}
						>
							Save
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
