"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateSequenceMetadata } from "@/app/actions/sequences";

interface SequenceDescriptionEditorProps {
	id: string;
	description: string | null;
}

export function SequenceDescriptionEditor({ id, description }: SequenceDescriptionEditorProps) {
	const router = useRouter();
	const [editing, setEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [value, setValue] = useState(description ?? "");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (editing) inputRef.current?.select();
	}, [editing]);

	async function save() {
		const trimmed = value.trim();
		if (trimmed === (description ?? "")) {
			setEditing(false);
			return;
		}
		setSaving(true);
		await updateSequenceMetadata(id, { description: trimmed });
		setSaving(false);
		setEditing(false);
		router.refresh();
	}

	function onKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter") { e.preventDefault(); save(); }
		if (e.key === "Escape") { setValue(description ?? ""); setEditing(false); }
	}

	const placeholder = "Add description…";

	if (editing) {
		return (
			<input
				ref={inputRef}
				value={value}
				onChange={e => setValue(e.target.value)}
				onBlur={save}
				onKeyDown={onKeyDown}
				disabled={saving}
				placeholder={placeholder}
				style={{
					fontFamily: "var(--font-courier)",
					fontSize: "10px",
					letterSpacing: "0.02em",
					color: "#5a5648",
					background: "transparent",
					border: "none",
					borderBottom: "1px solid rgba(26,71,49,0.3)",
					outline: "none",
					padding: "0 0 1px 0",
					width: "100%",
					maxWidth: "340px",
					opacity: saving ? 0.6 : 1,
				}}
			/>
		);
	}

	return (
		<span
			onClick={() => setEditing(true)}
			title="Click to edit description"
			style={{
				fontFamily: "var(--font-courier)",
				fontSize: "10px",
				letterSpacing: "0.02em",
				color: value ? "#9a9284" : "#c8c0b4",
				cursor: "text",
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
				maxWidth: "340px",
				display: "inline-block",
			}}
		>
			{value || placeholder}
		</span>
	);
}
