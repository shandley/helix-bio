"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { deleteSequence } from "@/app/actions/sequences";
import type { Sequence } from "@/types/database";

const PAGE_SIZE = 25;

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
			<line x1="2" y1="8" x2="14" y2="8" stroke="#8a8278" strokeWidth="1.5" />
			<rect x="1" y="5.5" width="2.5" height="5" rx="0.5" fill="#8a8278" />
			<rect x="12.5" y="5.5" width="2.5" height="5" rx="0.5" fill="#8a8278" />
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
			<span
				style={{
					fontFamily: "var(--font-courier)",
					fontSize: "10px",
					color: "#9a9284",
					minWidth: "32px",
				}}
			>
				{gc.toFixed(0)}%
			</span>
		</div>
	);
}

function relativeDate(dateStr: string): string {
	const ms = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(ms / 60_000);
	const hours = Math.floor(ms / 3_600_000);
	const days = Math.floor(ms / 86_400_000);
	if (mins < 2) return "just now";
	if (mins < 60) return `${mins}m ago`;
	if (hours < 24) return `${hours}h ago`;
	if (days === 1) return "yesterday";
	if (days < 7) return `${days}d ago`;
	if (days < 30) return `${Math.floor(days / 7)}w ago`;
	return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatLength(bp: number | null): string {
	if (!bp) return "—";
	if (bp >= 1_000_000) return `${(bp / 1_000_000).toFixed(2)} Mb`;
	if (bp >= 1000) return `${(bp / 1000).toFixed(1)} kb`;
	return `${bp} bp`;
}

type SortKey = "recent" | "name" | "length" | "gc";
type TopologyFilter = "all" | "circular" | "linear";

const SORT_LABELS: Record<SortKey, string> = {
	recent: "Recent",
	name: "Name",
	length: "Length",
	gc: "GC%",
};

export function SequenceLibrary({ sequences }: { sequences: Sequence[] }) {
	const router = useRouter();
	const [search, setSearch] = useState("");
	const [sort, setSort] = useState<SortKey>("recent");
	const [topology, setTopology] = useState<TopologyFilter>("all");
	const [page, setPage] = useState(0);
	const [items, setItems] = useState<Sequence[]>(sequences);
	const [pendingDelete, setPendingDelete] = useState<string | null>(null);

	async function handleDelete(id: string) {
		setItems((prev) => prev.filter((s) => s.id !== id));
		setPendingDelete(null);
		await deleteSequence(id);
		router.refresh();
	}

	function resetPage() {
		setPage(0);
	}

	const filtered = useMemo(() => {
		const q = search.toLowerCase().trim();
		let list = items;
		if (topology !== "all") list = list.filter((s) => s.topology === topology);
		if (q)
			list = list.filter(
				(s) => s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q),
			);
		return [...list].sort((a, b) => {
			switch (sort) {
				case "name":
					return a.name.localeCompare(b.name);
				case "length":
					return (b.length ?? 0) - (a.length ?? 0);
				case "gc":
					return (b.gc_content ?? 0) - (a.gc_content ?? 0);
				default:
					return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
			}
		});
	}, [items, search, sort, topology]);

	const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
	const safePage = Math.min(page, Math.max(0, totalPages - 1));
	const paginated = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
	const rangeStart = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
	const rangeEnd = Math.min((safePage + 1) * PAGE_SIZE, filtered.length);

	const totalBp = items.reduce((s, r) => s + (r.length ?? 0), 0);
	const circularCount = items.filter((s) => s.topology === "circular").length;
	const totalFormatted = totalBp >= 1000 ? `${(totalBp / 1000).toFixed(1)} kb` : `${totalBp} bp`;

	const filterBtnStyle = (active: boolean): React.CSSProperties => ({
		fontFamily: "var(--font-courier)",
		fontSize: "9px",
		letterSpacing: "0.08em",
		textTransform: "uppercase" as const,
		padding: "4px 8px",
		border: `1px solid ${active ? "rgba(26,71,49,0.4)" : "#ddd8ce"}`,
		borderRadius: "2px",
		background: active ? "rgba(26,71,49,0.07)" : "transparent",
		color: active ? "#1a4731" : "#9a9284",
		cursor: "pointer",
	});

	return (
		<div style={{ marginTop: "32px" }}>
			{/* Section header row */}
			<div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
				<span
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "9px",
						letterSpacing: "0.14em",
						textTransform: "uppercase",
						color: "#5a5648",
						flexShrink: 0,
					}}
				>
					Library
				</span>
				<span
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "9px",
						color: "#9a9284",
						border: "1px solid #ddd8ce",
						padding: "1px 6px",
						borderRadius: "2px",
						flexShrink: 0,
					}}
				>
					{items.length}
				</span>
				<div style={{ flex: 1, height: "1px", background: "#ddd8ce" }} />
			</div>

			{/* Filter/search row */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "8px",
					marginBottom: "12px",
					flexWrap: "wrap",
				}}
			>
				{/* Topology filter */}
				<div style={{ display: "flex", gap: "4px" }}>
					{(["all", "circular", "linear"] as TopologyFilter[]).map((t) => (
						<button
							type="button"
							key={t}
							onClick={() => {
								setTopology(t);
								resetPage();
							}}
							style={filterBtnStyle(topology === t)}
						>
							{t === "all" ? "All" : t === "circular" ? "Circular" : "Linear"}
						</button>
					))}
				</div>

				<div style={{ flex: 1, height: "1px", background: "#ddd8ce" }} />

				{/* Search */}
				<input
					type="text"
					value={search}
					onChange={(e) => {
						setSearch(e.target.value);
						resetPage();
					}}
					placeholder="Search by name…"
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "11px",
						color: "#1c1a16",
						background: "#f5f0e8",
						border: "1px solid #ddd8ce",
						borderRadius: "3px",
						padding: "5px 10px",
						width: "160px",
						outline: "none",
					}}
				/>

				{/* Sort */}
				<select
					value={sort}
					onChange={(e) => {
						setSort(e.target.value as SortKey);
						resetPage();
					}}
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
						<option key={k} value={k}>
							{SORT_LABELS[k]}
						</option>
					))}
				</select>
			</div>

			{/* List */}
			<div
				style={{
					border: "1px solid #ddd8ce",
					borderRadius: "3px",
					overflow: "hidden",
					background: "#faf7f2",
				}}
			>
				{filtered.length === 0 ? (
					<div
						style={{
							padding: "28px",
							textAlign: "center",
							fontFamily: "var(--font-courier)",
							fontSize: "11px",
							color: "#9a9284",
						}}
					>
						{search || topology !== "all"
							? `No sequences match${search ? ` "${search}"` : ""}${topology !== "all" ? ` (${topology})` : ""}`
							: "No sequences yet. Upload one to get started."}
					</div>
				) : (
					paginated.map((seq, i) => (
						<Link
							key={seq.id}
							href={`/sequence/${seq.id}`}
							className="sequence-row"
							style={{
								display: "flex",
								alignItems: "center",
								gap: "12px",
								padding: "10px 16px",
								borderBottom: i < paginated.length - 1 ? "1px solid rgba(221,216,206,0.6)" : "none",
								textDecoration: "none",
							}}
						>
							{/* Topology icon */}
							<span
								title={seq.topology}
								style={{
									flexShrink: 0,
									display: "flex",
									alignSelf: "flex-start",
									paddingTop: "2px",
								}}
							>
								{seq.topology === "circular" ? <CircularIcon /> : <LinearIcon />}
							</span>

							{/* Name + description */}
							<span
								style={{
									flex: 1,
									overflow: "hidden",
									display: "flex",
									flexDirection: "column",
									gap: "2px",
								}}
							>
								<span
									className="sequence-row-name"
									style={{
										fontFamily: "var(--font-sans)",
										fontSize: "14px",
										color: "#1c1a16",
										fontWeight: 500,
										letterSpacing: "-0.01em",
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
								>
									{seq.name}
								</span>
								{seq.description && (
									<span
										style={{
											fontFamily: "var(--font-courier)",
											fontSize: "10px",
											color: "#9a9284",
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
											letterSpacing: "0.01em",
										}}
									>
										{seq.description}
									</span>
								)}
							</span>

							{/* Format badge */}
							<span
								style={{
									fontFamily: "var(--font-courier)",
									fontSize: "9px",
									letterSpacing: "0.1em",
									textTransform: "uppercase",
									color: "#9a9284",
									border: "1px solid #ddd8ce",
									padding: "2px 6px",
									borderRadius: "2px",
									flexShrink: 0,
									alignSelf: "flex-start",
									marginTop: "1px",
								}}
							>
								{seq.file_format}
							</span>

							{/* Length */}
							<span
								style={{
									fontFamily: "var(--font-courier)",
									fontSize: "11px",
									color: "#5a5648",
									flexShrink: 0,
									minWidth: "56px",
									textAlign: "right",
									alignSelf: "flex-start",
									paddingTop: "1px",
								}}
							>
								{formatLength(seq.length)}
							</span>

							{/* GC bar */}
							<span style={{ alignSelf: "flex-start", paddingTop: "3px" }}>
								{seq.gc_content != null ? (
									<GcBar gc={seq.gc_content} />
								) : (
									<span style={{ display: "inline-block", width: "86px" }} />
								)}
							</span>

							{/* Date */}
							<span
								style={{
									fontFamily: "var(--font-courier)",
									fontSize: "10px",
									color: "#b8b0a4",
									flexShrink: 0,
									minWidth: "58px",
									textAlign: "right",
									alignSelf: "flex-start",
									paddingTop: "2px",
								}}
							>
								{relativeDate(seq.created_at)}
							</span>

							{/* Delete */}
							{pendingDelete === seq.id ? (
								<span
									style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}
									onClick={(e) => e.preventDefault()}
								>
									<button
										type="button"
										onClick={() => handleDelete(seq.id)}
										style={{
											fontFamily: "var(--font-courier)",
											fontSize: "8px",
											letterSpacing: "0.08em",
											textTransform: "uppercase",
											color: "white",
											background: "#8b3a2a",
											border: "none",
											borderRadius: "2px",
											padding: "3px 8px",
											cursor: "pointer",
										}}
									>
										Confirm
									</button>
									<button
										type="button"
										onClick={() => setPendingDelete(null)}
										style={{
											fontFamily: "var(--font-courier)",
											fontSize: "8px",
											letterSpacing: "0.08em",
											textTransform: "uppercase",
											color: "#5a5648",
											background: "none",
											border: "1px solid #ddd8ce",
											borderRadius: "2px",
											padding: "3px 8px",
											cursor: "pointer",
										}}
									>
										Cancel
									</button>
								</span>
							) : (
								<button
									type="button"
									onClick={(e) => {
										e.preventDefault();
										setPendingDelete(seq.id);
									}}
									className="sequence-row-delete"
									style={{
										fontFamily: "var(--font-courier)",
										fontSize: "9px",
										letterSpacing: "0.06em",
										color: "#9a9284",
										background: "none",
										border: "none",
										cursor: "pointer",
										padding: "0",
										flexShrink: 0,
										opacity: 0,
										transition: "opacity 0.1s, color 0.1s",
									}}
									onMouseEnter={(e) => {
										(e.target as HTMLButtonElement).style.color = "#8b3a2a";
									}}
									onMouseLeave={(e) => {
										(e.target as HTMLButtonElement).style.color = "#9a9284";
									}}
								>
									×
								</button>
							)}
						</Link>
					))
				)}
			</div>

			{/* Pagination + stats row */}
			<div
				style={{
					marginTop: "8px",
					display: "flex",
					alignItems: "center",
					gap: "10px",
					fontFamily: "var(--font-courier)",
					fontSize: "9px",
					letterSpacing: "0.06em",
					color: "#b8b0a4",
				}}
			>
				{/* Stats */}
				<span>
					{items.length} sequence{items.length !== 1 ? "s" : ""}
				</span>
				<span>·</span>
				<span>{totalFormatted} total</span>
				<span>·</span>
				<span>
					{circularCount} circular, {items.length - circularCount} linear
				</span>

				{/* Pagination controls — only shown when there's more than one page */}
				{totalPages > 1 && (
					<>
						<div style={{ flex: 1 }} />
						<span style={{ color: "#9a9284" }}>
							{rangeStart}–{rangeEnd} of {filtered.length}
						</span>
						<button
							type="button"
							onClick={() => setPage((p) => Math.max(0, p - 1))}
							disabled={safePage === 0}
							style={{
								fontFamily: "var(--font-courier)",
								fontSize: "9px",
								color: safePage === 0 ? "#ddd8ce" : "#5a5648",
								background: "none",
								border: "1px solid #ddd8ce",
								borderRadius: "2px",
								padding: "2px 8px",
								cursor: safePage === 0 ? "default" : "pointer",
							}}
						>
							←
						</button>
						<button
							type="button"
							onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
							disabled={safePage >= totalPages - 1}
							style={{
								fontFamily: "var(--font-courier)",
								fontSize: "9px",
								color: safePage >= totalPages - 1 ? "#ddd8ce" : "#5a5648",
								background: "none",
								border: "1px solid #ddd8ce",
								borderRadius: "2px",
								padding: "2px 8px",
								cursor: safePage >= totalPages - 1 ? "default" : "pointer",
							}}
						>
							→
						</button>
					</>
				)}
			</div>
		</div>
	);
}
