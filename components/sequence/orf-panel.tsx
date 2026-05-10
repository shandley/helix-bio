"use client";

import { useMemo, useState } from "react";
import { findORFs, type ORF } from "@/lib/bio/orf-finder";
import { translate } from "@/lib/bio/translate";
import { reverseComplement } from "@shandley/primd";

interface ORFPanelProps {
	seq: string;
	topology: "circular" | "linear";
}

function formatBp(bp: number): string {
	if (bp >= 1000) return `${(bp / 1000).toFixed(1)}kb`;
	return `${bp}bp`;
}

function ORFDetail({ orf, seq, onClose }: { orf: ORF; seq: string; onClose: () => void }) {
	const protein = useMemo(() => {
		const dna = orf.strand === 1
			? seq.slice(orf.start, orf.end)
			: reverseComplement(seq.slice(orf.start, orf.end));
		return translate(dna);
	}, [orf, seq]);

	// Format protein: 10 aa groups, 5 groups per line
	const lines: string[] = [];
	for (let i = 0; i < protein.length; i += 50) {
		const lineNum = String(i + 1).padStart(5, " ");
		const chunk = protein.slice(i, i + 50);
		const groups: string[] = [];
		for (let j = 0; j < chunk.length; j += 10) groups.push(chunk.slice(j, j + 10));
		lines.push(`${lineNum}  ${groups.join(" ")}`);
	}

	return (
		<div style={{ padding: "10px 12px" }}>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
				<span style={{ fontFamily: "var(--font-courier)", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#1a4731" }}>
					{orf.strand === 1 ? "+" : "−"} strand · frame {orf.frame + 1} · {orf.proteinLength} aa
				</span>
				<button onClick={onClose}
					style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#9a9284", background: "none", border: "none", cursor: "pointer", padding: "0" }}>
					✕
				</button>
			</div>
			<div style={{ fontFamily: "var(--font-courier)", fontSize: "9.5px", color: "#1c1a16", lineHeight: 1.8, background: "rgba(26,71,49,0.04)", borderRadius: "3px", padding: "8px 10px", whiteSpace: "pre-wrap", overflowX: "auto", maxHeight: "180px", overflowY: "auto" }}>
				{lines.join("\n")}
			</div>
			<div style={{ marginTop: "6px", fontFamily: "var(--font-courier)", fontSize: "8px", color: "#9a9284", letterSpacing: "0.04em" }}>
				{orf.start + 1}–{orf.end} bp on original sequence
			</div>
		</div>
	);
}

export function ORFPanel({ seq, topology }: ORFPanelProps) {
	const [minLength, setMinLength] = useState(100);
	const [selectedORF, setSelectedORF] = useState<ORF | null>(null);

	const orfs = useMemo(() => findORFs(seq, minLength), [seq, minLength]);

	const fwdORFs = orfs.filter((o) => o.strand === 1);
	const revORFs = orfs.filter((o) => o.strand === -1);

	if (selectedORF) {
		return <ORFDetail orf={selectedORF} seq={seq} onClose={() => setSelectedORF(null)} />;
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
			{/* Controls */}
			<div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(221,216,206,0.5)", flexShrink: 0, display: "flex", alignItems: "center", gap: "8px" }}>
				<span style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#5a5648", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
					Min length
				</span>
				<select
					value={minLength}
					onChange={(e) => { setSelectedORF(null); setMinLength(Number(e.target.value)); }}
					style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#1c1a16", background: "#faf7f2", border: "1px solid #ddd8ce", borderRadius: "2px", padding: "2px 4px", cursor: "pointer" }}>
					{[50, 100, 150, 300, 500].map((v) => (
						<option key={v} value={v}>{v} bp ({Math.floor(v / 3)} aa)</option>
					))}
				</select>
				<span style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#9a9284", marginLeft: "auto" }}>
					{orfs.length} found
				</span>
			</div>

			{/* ORF list */}
			<div style={{ flex: 1, overflowY: "auto" }}>
				{orfs.length === 0 ? (
					<p style={{ fontFamily: "var(--font-courier)", fontSize: "10px", color: "#9a9284", padding: "16px 12px", letterSpacing: "0.03em" }}>
						No ORFs ≥ {minLength} bp found
					</p>
				) : (
					<>
						{[{ label: "+ strand", items: fwdORFs }, { label: "− strand", items: revORFs }]
							.filter((g) => g.items.length > 0)
							.map((group) => (
								<div key={group.label}>
									<div style={{ fontFamily: "var(--font-courier)", fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9284", padding: "6px 12px 2px", borderBottom: "1px solid rgba(221,216,206,0.3)" }}>
										{group.label} · {group.items.length} ORF{group.items.length !== 1 ? "s" : ""}
									</div>
									{group.items.map((orf, i) => (
										<button
											key={i}
											onClick={() => setSelectedORF(orf)}
											style={{
												display: "flex", width: "100%", textAlign: "left",
												alignItems: "center", justifyContent: "space-between",
												padding: "7px 12px", background: "none", border: "none",
												borderBottom: "1px solid rgba(221,216,206,0.25)", cursor: "pointer",
											}}
											onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(26,71,49,0.04)"; }}
											onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
										>
											<div>
												<div style={{ fontFamily: "var(--font-courier)", fontSize: "10px", color: "#1c1a16" }}>
													{orf.start + 1}–{orf.end}
												</div>
												<div style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#9a9284", marginTop: "1px" }}>
													frame {orf.frame + 1} · {orf.proteinLength} aa
												</div>
											</div>
											<span style={{ fontFamily: "var(--font-courier)", fontSize: "10px", color: "#5a5648" }}>
												{formatBp(orf.length)}
											</span>
										</button>
									))}
								</div>
							))}
					</>
				)}
			</div>

			{orfs.length > 0 && (
				<div style={{ padding: "6px 12px", borderTop: "1px solid rgba(221,216,206,0.5)", fontFamily: "var(--font-courier)", fontSize: "8px", color: "#b8b0a4", letterSpacing: "0.04em", flexShrink: 0 }}>
					Click an ORF to see translation
				</div>
			)}
		</div>
	);
}
