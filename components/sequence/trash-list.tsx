"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { restoreSequence, permanentlyDeleteSequence } from "@/app/actions/sequences";
import type { Sequence } from "@/types/database";

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
	if (bp >= 1000) return `${(bp / 1000).toFixed(1)} kb`;
	return `${bp} bp`;
}

export function TrashList({ sequences }: { sequences: Sequence[] }) {
	const router = useRouter();
	const [items, setItems] = useState<Sequence[]>(sequences);
	const [pendingPurge, setPendingPurge] = useState<string | null>(null);
	const [loading, setLoading] = useState<string | null>(null);

	async function handleRestore(id: string) {
		setLoading(id);
		setItems(prev => prev.filter(s => s.id !== id));
		await restoreSequence(id);
		router.refresh();
		setLoading(null);
	}

	async function handlePurge(id: string) {
		setLoading(id);
		setItems(prev => prev.filter(s => s.id !== id));
		setPendingPurge(null);
		await permanentlyDeleteSequence(id);
		router.refresh();
		setLoading(null);
	}

	if (items.length === 0) {
		return (
			<div style={{ marginTop: "24px", textAlign: "center", fontFamily: "var(--font-courier)", fontSize: "11px", color: "#b8b0a4", letterSpacing: "0.06em" }}>
				All items restored or removed.
			</div>
		);
	}

	return (
		<div style={{ border: "1px solid #ddd8ce", borderRadius: "3px", overflow: "hidden", background: "#faf7f2" }}>
			{items.map((seq, i) => (
				<div
					key={seq.id}
					style={{
						display: "flex",
						alignItems: "center",
						gap: "12px",
						padding: "10px 16px",
						borderBottom: i < items.length - 1 ? "1px solid rgba(221,216,206,0.6)" : "none",
						opacity: loading === seq.id ? 0.4 : 1,
						transition: "opacity 0.15s",
					}}
				>
					{/* Name + description */}
					<div style={{ flex: 1, overflow: "hidden" }}>
						<div style={{
							fontFamily: "var(--font-sans)",
							fontSize: "14px",
							color: "#5a5648",
							fontWeight: 500,
							letterSpacing: "-0.01em",
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}}>
							{seq.name}
						</div>
						{seq.description && (
							<div style={{
								fontFamily: "var(--font-courier)",
								fontSize: "10px",
								color: "#b8b0a4",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
								marginTop: "2px",
							}}>
								{seq.description}
							</div>
						)}
					</div>

					{/* Topology + length */}
					<span style={{ fontFamily: "var(--font-courier)", fontSize: "10px", color: "#9a9284", flexShrink: 0 }}>
						{seq.topology} · {formatLength(seq.length)}
					</span>

					{/* Deleted date */}
					<span style={{ fontFamily: "var(--font-courier)", fontSize: "10px", color: "#b8b0a4", flexShrink: 0, minWidth: "70px", textAlign: "right" }}>
						{seq.deleted_at ? relativeDate(seq.deleted_at) : "—"}
					</span>

					{/* Actions */}
					<div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
						<button
							onClick={() => handleRestore(seq.id)}
							disabled={loading === seq.id}
							style={{
								fontFamily: "var(--font-courier)",
								fontSize: "8px",
								letterSpacing: "0.08em",
								textTransform: "uppercase",
								color: "#1a4731",
								background: "rgba(26,71,49,0.07)",
								border: "1px solid rgba(26,71,49,0.25)",
								borderRadius: "2px",
								padding: "3px 9px",
								cursor: "pointer",
							}}
						>
							Restore
						</button>

						{pendingPurge === seq.id ? (
							<>
								<button
									onClick={() => handlePurge(seq.id)}
									disabled={loading === seq.id}
									style={{
										fontFamily: "var(--font-courier)",
										fontSize: "8px",
										letterSpacing: "0.08em",
										textTransform: "uppercase",
										color: "white",
										background: "#8b3a2a",
										border: "none",
										borderRadius: "2px",
										padding: "3px 9px",
										cursor: "pointer",
									}}
								>
									Confirm
								</button>
								<button
									onClick={() => setPendingPurge(null)}
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
							</>
						) : (
							<button
								onClick={() => setPendingPurge(seq.id)}
								style={{
									fontFamily: "var(--font-courier)",
									fontSize: "8px",
									letterSpacing: "0.08em",
									textTransform: "uppercase",
									color: "#9a9284",
									background: "none",
									border: "1px solid #ddd8ce",
									borderRadius: "2px",
									padding: "3px 8px",
									cursor: "pointer",
								}}
							>
								Delete forever
							</button>
						)}
					</div>
				</div>
			))}
		</div>
	);
}
