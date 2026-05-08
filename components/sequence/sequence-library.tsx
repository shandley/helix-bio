"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Sequence } from "@/types/database";

function CircularIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-label="Circular">
			<circle cx="8" cy="8" r="5.5" stroke="#8a8278" strokeWidth="1.5" />
		</svg>
	);
}

function LinearIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-label="Linear">
			<line x1="1" y1="8" x2="15" y2="8" stroke="#8a8278" strokeWidth="1.5" strokeLinecap="round" />
			<line x1="1" y1="5" x2="1" y2="11" stroke="#8a8278" strokeWidth="1.5" strokeLinecap="round" />
			<line x1="15" y1="5" x2="15" y2="11" stroke="#8a8278" strokeWidth="1.5" strokeLinecap="round" />
		</svg>
	);
}

function GcBar({ gc }: { gc: number }) {
	const pct = Math.max(0, Math.min(100, gc));
	const color = gc < 40 ? "#b8933a" : gc > 65 ? "#2d7a54" : "#1a4731";
	return (
		<div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
			<div style={{ width: "48px", height: "3px", background: "#e8e2d8", borderRadius: "2px" }}>
				<div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "2px" }} />
			</div>
			<span style={{
				fontFamily: "var(--font-courier)",
				fontSize: "10px",
				color: "#9a9284",
				minWidth: "32px",
			}}>
				{gc.toFixed(0)}%
			</span>
		</div>
	);
}

function relativeDate(dateStr: string): string {
	const d = new Date(dateStr);
	const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
	if (days === 0) return "today";
	if (days === 1) return "yesterday";
	if (days < 7) return `${days}d ago`;
	if (days < 30) return `${Math.floor(days / 7)}w ago`;
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatLength(bp: number | null): string {
	if (!bp) return "—";
	if (bp >= 1_000_000) return `${(bp / 1_000_000).toFixed(2)} Mb`;
	if (bp >= 1000) return `${(bp / 1000).toFixed(1)} kb`;
	return `${bp} bp`;
}

type SortKey = "recent" | "name" | "length" | "gc";
const SORT_LABELS: Record<SortKey, string> = { recent: "Recent", name: "Name", length: "Length", gc: "GC%" };

export function SequenceLibrary({ sequences }: { sequences: Sequence[] }) {
	const [search, setSearch] = useState("");
	const [sort, setSort] = useState<SortKey>("recent");

	const filtered = useMemo(() => {
		const q = search.toLowerCase().trim();
		const list = q ? sequences.filter((s) => s.name.toLowerCase().includes(q)) : sequences;
		return [...list].sort((a, b) => {
			switch (sort) {
				case "name": return a.name.localeCompare(b.name);
				case "length": return (b.length ?? 0) - (a.length ?? 0);
				case "gc": return (b.gc_content ?? 0) - (a.gc_content ?? 0);
				default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
			}
		});
	}, [sequences, search, sort]);

	const totalBp = sequences.reduce((s, r) => s + (r.length ?? 0), 0);
	const circularCount = sequences.filter((s) => s.topology === "circular").length;
	const totalFormatted = totalBp >= 1000 ? `${(totalBp / 1000).toFixed(1)} kb` : `${totalBp} bp`;

	return (
		<div style={{ marginTop: "32px" }}>
			{/* Section header */}
			<div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
				<span style={{
					fontFamily: "var(--font-courier)",
					fontSize: "9px",
					letterSpacing: "0.14em",
					textTransform: "uppercase",
					color: "#5a5648",
					flexShrink: 0,
				}}>
					Library
				</span>
				<span style={{
					fontFamily: "var(--font-courier)",
					fontSize: "9px",
					color: "#9a9284",
					border: "1px solid #ddd8ce",
					padding: "1px 6px",
					borderRadius: "2px",
					flexShrink: 0,
				}}>
					{sequences.length}
				</span>
				<div style={{ flex: 1, height: "1px", background: "#ddd8ce" }} />
				<input
					type="text"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Search…"
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "11px",
						color: "#1c1a16",
						background: "#f5f0e8",
						border: "1px solid #ddd8ce",
						borderRadius: "3px",
						padding: "5px 10px",
						width: "148px",
						outline: "none",
					}}
				/>
				<select
					value={sort}
					onChange={(e) => setSort(e.target.value as SortKey)}
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "11px",
						color: "#5a5648",
						background: "#f5f0e8",
						border: "1px solid #ddd8ce",
						borderRadius: "3px",
						padding: "5px 8px",
						outline: "none",
						cursor: "pointer",
					}}
				>
					{(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
						<option key={k} value={k}>{SORT_LABELS[k]}</option>
					))}
				</select>
			</div>

			{/* List */}
			<div style={{ border: "1px solid #ddd8ce", borderRadius: "3px", overflow: "hidden", background: "#faf7f2" }}>
				{filtered.length === 0 ? (
					<div style={{
						padding: "28px",
						textAlign: "center",
						fontFamily: "var(--font-courier)",
						fontSize: "11px",
						color: "#9a9284",
					}}>
						No sequences match &ldquo;{search}&rdquo;
					</div>
				) : filtered.map((seq, i) => (
					<Link
						key={seq.id}
						href={`/sequence/${seq.id}`}
						className="sequence-row"
						style={{
							display: "flex",
							alignItems: "center",
							gap: "12px",
							padding: "11px 16px",
							borderBottom: i < filtered.length - 1 ? "1px solid rgba(221,216,206,0.6)" : "none",
							textDecoration: "none",
						}}
					>
						{/* Topology icon */}
						<span title={seq.topology} style={{ flexShrink: 0, display: "flex" }}>
							{seq.topology === "circular" ? <CircularIcon /> : <LinearIcon />}
						</span>

						{/* Name */}
						<span className="sequence-row-name" style={{
							fontFamily: "var(--font-sans)",
							fontSize: "14px",
							color: "#1c1a16",
							fontWeight: 500,
							flex: 1,
							letterSpacing: "-0.01em",
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}}>
							{seq.name}
						</span>

						{/* Format */}
						<span style={{
							fontFamily: "var(--font-courier)",
							fontSize: "9px",
							letterSpacing: "0.1em",
							textTransform: "uppercase",
							color: "#9a9284",
							border: "1px solid #ddd8ce",
							padding: "2px 6px",
							borderRadius: "2px",
							flexShrink: 0,
						}}>
							{seq.file_format}
						</span>

						{/* Length */}
						<span style={{
							fontFamily: "var(--font-courier)",
							fontSize: "11px",
							color: "#5a5648",
							flexShrink: 0,
							minWidth: "56px",
							textAlign: "right",
						}}>
							{formatLength(seq.length)}
						</span>

						{/* GC bar */}
						{seq.gc_content != null
							? <GcBar gc={seq.gc_content} />
							: <div style={{ width: "86px", flexShrink: 0 }} />
						}

						{/* Date */}
						<span style={{
							fontFamily: "var(--font-courier)",
							fontSize: "10px",
							color: "#b8b0a4",
							flexShrink: 0,
							minWidth: "58px",
							textAlign: "right",
						}}>
							{relativeDate(seq.created_at)}
						</span>
					</Link>
				))}
			</div>

			{/* Stats */}
			<div style={{
				marginTop: "8px",
				display: "flex",
				gap: "10px",
				fontFamily: "var(--font-courier)",
				fontSize: "9px",
				letterSpacing: "0.06em",
				color: "#b8b0a4",
			}}>
				<span>{sequences.length} sequence{sequences.length !== 1 ? "s" : ""}</span>
				<span>·</span>
				<span>{totalFormatted} total</span>
				<span>·</span>
				<span>{circularCount} circular, {sequences.length - circularCount} linear</span>
			</div>
		</div>
	);
}
