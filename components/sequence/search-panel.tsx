"use client";

import { useState, useCallback } from "react";
import { searchSequence, isValidQuery, type SearchMatch } from "@/lib/bio/search";

interface SearchPanelProps {
	seq: string;
	topology: "circular" | "linear";
	onMatches: (matches: SearchMatch[]) => void;
}

export function SearchPanel({ seq, topology, onMatches }: SearchPanelProps) {
	const [query, setQuery] = useState("");
	const [matches, setMatches] = useState<SearchMatch[]>([]);
	const [focusIdx, setFocusIdx] = useState(0);
	const [error, setError] = useState<string | null>(null);

	const runSearch = useCallback((q: string) => {
		if (!q) {
			setMatches([]);
			setFocusIdx(0);
			setError(null);
			onMatches([]);
			return;
		}
		if (!isValidQuery(q)) {
			setError("Invalid characters. Use A/C/G/T or IUPAC codes (R, Y, S, W, K, M, B, D, H, V, N).");
			setMatches([]);
			onMatches([]);
			return;
		}
		if (q.length < 3) {
			setError("Enter at least 3 bases.");
			setMatches([]);
			onMatches([]);
			return;
		}
		setError(null);
		const results = searchSequence(seq, q, topology === "circular");
		setMatches(results);
		setFocusIdx(0);
		onMatches(results);
	}, [seq, topology, onMatches]);

	function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		const q = e.target.value.toUpperCase();
		setQuery(q);
		runSearch(q);
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter" && matches.length > 0) {
			setFocusIdx((i) => (i + 1) % matches.length);
		}
		if (e.key === "Escape") {
			setQuery("");
			setMatches([]);
			setError(null);
			onMatches([]);
		}
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
			{/* Search input */}
			<div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(221,216,206,0.5)", flexShrink: 0 }}>
				<div style={{ position: "relative" }}>
					<input
						type="text"
						value={query}
						onChange={handleChange}
						onKeyDown={handleKeyDown}
						placeholder="DNA query (IUPAC)…"
						autoComplete="off"
						spellCheck={false}
						style={{
							width: "100%",
							boxSizing: "border-box",
							fontFamily: "var(--font-courier)",
							fontSize: "10px",
							letterSpacing: "0.05em",
							color: "#1c1a16",
							background: "#faf7f2",
							border: `1px solid ${error ? "rgba(180,60,40,0.4)" : "#ddd8ce"}`,
							borderRadius: "2px",
							padding: "5px 8px",
							outline: "none",
						}}
					/>
				</div>
				{error && (
					<div style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "rgba(160,50,30,0.9)", marginTop: "4px", lineHeight: 1.4 }}>
						{error}
					</div>
				)}
				{!error && matches.length > 0 && (
					<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
						<span style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#5a5648" }}>
							{matches.length} match{matches.length !== 1 ? "es" : ""}
						</span>
						<div style={{ display: "flex", gap: "4px" }}>
							<button
								onClick={() => setFocusIdx((i) => (i - 1 + matches.length) % matches.length)}
								style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#5a5648", background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}>
								▲
							</button>
							<span style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#9a9284" }}>
								{focusIdx + 1}/{matches.length}
							</span>
							<button
								onClick={() => setFocusIdx((i) => (i + 1) % matches.length)}
								style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#5a5648", background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}>
								▼
							</button>
						</div>
					</div>
				)}
				{!error && query.length >= 3 && matches.length === 0 && (
					<div style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#9a9284", marginTop: "4px" }}>
						No matches
					</div>
				)}
			</div>

			{/* Match list */}
			<div style={{ flex: 1, overflowY: "auto" }}>
				{matches.length > 0 && (
					<>
						<div style={{ fontFamily: "var(--font-courier)", fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9284", padding: "6px 12px 3px", borderBottom: "1px solid rgba(221,216,206,0.3)" }}>
							Positions
						</div>
						{matches.map((m, i) => (
							<div
								key={i}
								onClick={() => setFocusIdx(i)}
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									padding: "6px 12px",
									borderBottom: "1px solid rgba(221,216,206,0.25)",
									cursor: "pointer",
									background: i === focusIdx ? "rgba(26,71,49,0.06)" : "transparent",
								}}
								onMouseEnter={(e) => { if (i !== focusIdx) (e.currentTarget as HTMLDivElement).style.background = "rgba(26,71,49,0.03)"; }}
								onMouseLeave={(e) => { if (i !== focusIdx) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
							>
								<div>
									<div style={{ fontFamily: "var(--font-courier)", fontSize: "10px", color: "#1c1a16" }}>
										{m.start + 1}–{m.end}
									</div>
									<div style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#9a9284", marginTop: "1px" }}>
										{m.strand === "+" ? "+ strand" : "− strand"} · {m.end - m.start} bp
									</div>
								</div>
								{i === focusIdx && (
									<span style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#1a4731", letterSpacing: "0.05em" }}>
										●
									</span>
								)}
							</div>
						))}
					</>
				)}

				{!query && (
					<div style={{ padding: "16px 12px", fontFamily: "var(--font-courier)", fontSize: "10px", color: "#9a9284", lineHeight: 1.6, letterSpacing: "0.03em" }}>
						<div>Search both strands for exact or degenerate sequences.</div>
						<div style={{ marginTop: "8px", fontSize: "8px", lineHeight: 1.8, color: "#b8b0a4" }}>
							<div>A C G T — exact</div>
							<div>R=AG Y=CT S=GC W=AT</div>
							<div>K=GT M=AC N=any</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
