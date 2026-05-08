"use client";

import { useState, useMemo } from "react";
import {
	RESTRICTION_ENZYMES,
	DEFAULT_ENZYMES,
	GROUP_LABELS,
	END_TYPE_LABEL,
	countCutSites,
	type RestrictionEnzyme,
} from "@/lib/bio/enzymes";

interface EnzymePanelProps {
	seq: string;
	circular: boolean;
	selected: string[];
	onChange: (selected: string[]) => void;
}

const GROUPS: RestrictionEnzyme["group"][] = ["common", "6-cutter", "8-cutter", "4-cutter"];

// Deduplicate enzymes by name (some appear in both common + 6-cutter)
const UNIQUE_ENZYMES = RESTRICTION_ENZYMES.filter(
	(e, i, arr) => arr.findIndex((x) => x.name === e.name) === i,
);

export function EnzymePanel({ seq, circular, selected, onChange }: EnzymePanelProps) {
	const [search, setSearch] = useState("");
	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
		new Set(["6-cutter", "8-cutter", "4-cutter"]),
	);

	// Pre-compute cut counts for all enzymes (memoised on seq)
	const cutCounts = useMemo(() => {
		const upper = seq.toUpperCase();
		const map = new Map<string, number>();
		for (const e of UNIQUE_ENZYMES) {
			map.set(e.name, countCutSites(e, upper, circular));
		}
		return map;
	}, [seq, circular]);

	function toggle(name: string) {
		onChange(
			selected.includes(name)
				? selected.filter((n) => n !== name)
				: [...selected, name],
		);
	}

	function toggleGroup(group: RestrictionEnzyme["group"], enzymesInGroup: RestrictionEnzyme[]) {
		const names = enzymesInGroup.map((e) => e.name);
		const allOn = names.every((n) => selected.includes(n));
		onChange(
			allOn
				? selected.filter((n) => !names.includes(n))
				: [...new Set([...selected, ...names])],
		);
	}

	function toggleCollapse(group: string) {
		setCollapsedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(group)) next.delete(group);
			else next.add(group);
			return next;
		});
	}

	const filtered = useMemo(() => {
		const q = search.toLowerCase().trim();
		return q
			? UNIQUE_ENZYMES.filter((e) => e.name.toLowerCase().includes(q))
			: UNIQUE_ENZYMES;
	}, [search]);

	const enzymesByGroup = useMemo(() => {
		const map = new Map<RestrictionEnzyme["group"], RestrictionEnzyme[]>();
		for (const g of GROUPS) map.set(g, []);
		for (const e of filtered) {
			map.get(e.group)?.push(e);
		}
		return map;
	}, [filtered]);

	const selectedCount = selected.length;

	return (
		<aside style={{
			width: "244px",
			flexShrink: 0,
			borderLeft: "1px solid #ddd8ce",
			background: "#faf7f2",
			display: "flex",
			flexDirection: "column",
			overflow: "hidden",
		}}>
			{/* Panel header */}
			<div style={{
				padding: "14px 16px 12px",
				borderBottom: "1px solid #ddd8ce",
				flexShrink: 0,
			}}>
				<div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "10px" }}>
					<span style={{
						fontFamily: "var(--font-playfair)",
						fontSize: "15px",
						fontWeight: 400,
						color: "#1c1a16",
						letterSpacing: "-0.01em",
					}}>
						Enzymes
					</span>
					<span style={{
						fontFamily: "var(--font-courier)",
						fontSize: "9px",
						letterSpacing: "0.1em",
						textTransform: "uppercase",
						color: selectedCount > 0 ? "#1a4731" : "#9a9284",
					}}>
						{selectedCount} active
					</span>
				</div>

				{/* Search */}
				<input
					type="text"
					placeholder="Filter enzymes…"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					style={{
						width: "100%",
						padding: "6px 10px",
						fontFamily: "var(--font-courier)",
						fontSize: "11px",
						color: "#1c1a16",
						background: "#f5f0e8",
						border: "1px solid #ddd8ce",
						borderRadius: "3px",
						outline: "none",
					}}
				/>

				{/* Quick actions */}
				<div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
					<button
						onClick={() => onChange(DEFAULT_ENZYMES)}
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "9px",
							letterSpacing: "0.08em",
							textTransform: "uppercase",
							color: "#1a4731",
							background: "none",
							border: "none",
							cursor: "pointer",
							padding: 0,
						}}
					>
						Reset defaults
					</button>
					<span style={{ color: "#ddd8ce" }}>·</span>
					<button
						onClick={() => onChange([])}
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "9px",
							letterSpacing: "0.08em",
							textTransform: "uppercase",
							color: "#9a9284",
							background: "none",
							border: "none",
							cursor: "pointer",
							padding: 0,
						}}
					>
						Clear all
					</button>
				</div>
			</div>

			{/* Enzyme list */}
			<div style={{ flex: 1, overflowY: "auto" }}>
				{GROUPS.map((group) => {
					const enzymes = enzymesByGroup.get(group) ?? [];
					if (enzymes.length === 0) return null;
					const collapsed = collapsedGroups.has(group);
					const groupNames = enzymes.map((e) => e.name);
					const allSelected = groupNames.every((n) => selected.includes(n));
					const someSelected = groupNames.some((n) => selected.includes(n));

					return (
						<div key={group}>
							{/* Group header */}
							<div
								style={{
									display: "flex",
									alignItems: "center",
									padding: "8px 16px",
									borderBottom: "1px solid #ddd8ce",
									background: "#f5f0e8",
									cursor: "pointer",
									userSelect: "none",
								}}
							>
								{/* Collapse toggle */}
								<button
									onClick={() => toggleCollapse(group)}
									style={{
										background: "none",
										border: "none",
										cursor: "pointer",
										padding: "0 6px 0 0",
										color: "#9a9284",
										fontSize: "10px",
										flexShrink: 0,
									}}
								>
									{collapsed ? "▶" : "▼"}
								</button>

								{/* Group checkbox */}
								<input
									type="checkbox"
									checked={allSelected}
									ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
									onChange={() => toggleGroup(group, enzymes)}
									style={{ marginRight: "8px", accentColor: "#1a4731", flexShrink: 0, cursor: "pointer" }}
								/>

								<span
									onClick={() => toggleCollapse(group)}
									style={{
										fontFamily: "var(--font-courier)",
										fontSize: "9px",
										letterSpacing: "0.12em",
										textTransform: "uppercase",
										color: "#5a5648",
										flex: 1,
									}}
								>
									{GROUP_LABELS[group]}
								</span>
								<span style={{
									fontFamily: "var(--font-courier)",
									fontSize: "9px",
									color: "#9a9284",
								}}>
									{enzymes.length}
								</span>
							</div>

							{/* Enzyme rows */}
							{!collapsed && enzymes.map((enzyme) => {
								const cuts = cutCounts.get(enzyme.name) ?? 0;
								const active = selected.includes(enzyme.name);
								return (
									<label
										key={enzyme.name}
										style={{
											display: "flex",
											alignItems: "center",
											padding: "7px 16px",
											borderBottom: "1px solid rgba(221,216,206,0.5)",
											cursor: "pointer",
											background: active ? "rgba(26,71,49,0.04)" : "transparent",
											transition: "background 0.1s",
										}}
									>
										<input
											type="checkbox"
											checked={active}
											onChange={() => toggle(enzyme.name)}
											style={{ marginRight: "10px", accentColor: "#1a4731", cursor: "pointer", flexShrink: 0 }}
										/>
										<span style={{
											fontFamily: "var(--font-courier)",
											fontSize: "11px",
											color: active ? "#1c1a16" : "#5a5648",
											fontWeight: active ? 700 : 400,
											flex: 1,
											letterSpacing: "0.01em",
										}}>
											{enzyme.name}
										</span>
										<span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
											{/* End type pip */}
											<span
												title={END_TYPE_LABEL[enzyme.endType]}
												style={{
													width: "6px",
													height: "6px",
													borderRadius: enzyme.endType === "blunt" ? "1px" : "50%",
													background: enzyme.endType === "5p" ? "#1a4731" : enzyme.endType === "3p" ? "#b8933a" : "#9a9284",
													flexShrink: 0,
												}}
											/>
											{/* Cut count */}
											<span style={{
												fontFamily: "var(--font-courier)",
												fontSize: "10px",
												color: cuts === 0 ? "#b8b0a4" : cuts === 1 ? "#1a4731" : cuts <= 3 ? "#b8933a" : "#8b3a2a",
												minWidth: "16px",
												textAlign: "right",
											}}>
												{cuts}
											</span>
										</span>
									</label>
								);
							})}
						</div>
					);
				})}
			</div>

			{/* Legend */}
			<div style={{
				padding: "10px 16px",
				borderTop: "1px solid #ddd8ce",
				flexShrink: 0,
				display: "flex",
				flexDirection: "column",
				gap: "5px",
			}}>
				<div style={{ fontFamily: "var(--font-courier)", fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9284", marginBottom: "4px" }}>
					Legend
				</div>
				{[
					{ color: "#1a4731", shape: "circle", label: "5′ overhang" },
					{ color: "#b8933a", shape: "circle", label: "3′ overhang" },
					{ color: "#9a9284", shape: "square", label: "Blunt" },
				].map(({ color, shape, label }) => (
					<div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
						<span style={{
							width: "6px", height: "6px", flexShrink: 0,
							borderRadius: shape === "circle" ? "50%" : "1px",
							background: color,
						}} />
						<span style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#5a5648" }}>
							{label}
						</span>
					</div>
				))}
				<div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "12px" }}>
					{[
						{ color: "#1a4731", label: "1 cut" },
						{ color: "#b8933a", label: "2–3" },
						{ color: "#8b3a2a", label: "4+" },
						{ color: "#b8b0a4", label: "none" },
					].map(({ color, label }) => (
						<span key={label} style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color }}>
							{label}
						</span>
					))}
				</div>
			</div>
		</aside>
	);
}
