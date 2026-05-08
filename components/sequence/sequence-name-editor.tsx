"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateSequenceName } from "@/app/actions/sequences";

interface SequenceNameEditorProps {
	id: string;
	name: string;
}

export function SequenceNameEditor({ id, name }: SequenceNameEditorProps) {
	const router = useRouter();
	const [editing, setEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [value, setValue] = useState(name);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (editing) inputRef.current?.select();
	}, [editing]);

	async function save() {
		const trimmed = value.trim();
		if (!trimmed || trimmed === name) {
			setValue(name);
			setEditing(false);
			return;
		}
		setSaving(true);
		await updateSequenceName(id, trimmed);
		setSaving(false);
		setEditing(false);
		router.refresh();
	}

	function onKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter") { e.preventDefault(); save(); }
		if (e.key === "Escape") { setValue(name); setEditing(false); }
	}

	if (editing) {
		return (
			<input
				ref={inputRef}
				value={value}
				onChange={e => setValue(e.target.value)}
				onBlur={save}
				onKeyDown={onKeyDown}
				disabled={saving}
				style={{
					fontFamily: "var(--font-playfair)",
					fontSize: "17px",
					fontWeight: 400,
					color: "#1c1a16",
					letterSpacing: "-0.01em",
					background: "transparent",
					border: "none",
					borderBottom: "1px solid #1a4731",
					outline: "none",
					padding: "0 0 1px 0",
					width: "100%",
					maxWidth: "400px",
					opacity: saving ? 0.6 : 1,
				}}
			/>
		);
	}

	return (
		<span
			onClick={() => setEditing(true)}
			title="Click to rename"
			className="sequence-name-editable"
			style={{
				fontFamily: "var(--font-playfair)",
				fontSize: "17px",
				fontWeight: 400,
				color: "#1c1a16",
				letterSpacing: "-0.01em",
				cursor: "text",
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
			}}
		>
			{name}
		</span>
	);
}
