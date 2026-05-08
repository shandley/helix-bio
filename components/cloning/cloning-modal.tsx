"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
	CLONEABLE_ENZYMES_UNIQUE,
	findSites,
	areCompatible,
	simulateRECloning,
	type CloneableEnzyme,
	type RECloningResult,
} from "@/lib/bio/cloning";
import { saveClonedSequence } from "@/app/actions/sequences";

interface CloningModalProps {
	seq: string;
	seqName: string;
	topology: "circular" | "linear";
}

type Step = 1 | 2 | 3;

const S: Record<string, React.CSSProperties> = {
	overlay: {
		position: "fixed", inset: 0, zIndex: 1000,
		background: "rgba(28,26,22,0.55)", backdropFilter: "blur(2px)",
		display: "flex", alignItems: "center", justifyContent: "center",
	},
	dialog: {
		background: "#faf7f2", border: "1px solid #ddd8ce",
		borderRadius: "4px", width: "540px", maxWidth: "calc(100vw - 32px)",
		maxHeight: "90vh", display: "flex", flexDirection: "column",
		boxShadow: "0 8px 32px rgba(28,26,22,0.18)",
	},
	header: {
		padding: "16px 20px 14px", borderBottom: "1px solid #ddd8ce",
		display: "flex", alignItems: "baseline", justifyContent: "space-between", flexShrink: 0,
	},
	body: {
		padding: "20px", overflowY: "auto", flex: 1,
	},
	footer: {
		padding: "14px 20px", borderTop: "1px solid #ddd8ce",
		display: "flex", gap: "10px", justifyContent: "flex-end", flexShrink: 0,
	},
	label: {
		fontFamily: "var(--font-courier)", fontSize: "8px",
		letterSpacing: "0.12em", textTransform: "uppercase",
		color: "#9a9284", display: "block", marginBottom: "6px",
	},
	select: {
		width: "100%", padding: "7px 10px",
		fontFamily: "var(--font-courier)", fontSize: "11px", color: "#1c1a16",
		background: "#f5f0e8", border: "1px solid #ddd8ce",
		borderRadius: "3px", outline: "none", appearance: "none" as const,
		cursor: "pointer",
	},
	textarea: {
		width: "100%", padding: "8px 10px", resize: "none" as const,
		fontFamily: "var(--font-courier)", fontSize: "11px", color: "#1c1a16",
		background: "#f5f0e8", border: "1px solid #ddd8ce",
		borderRadius: "3px", outline: "none", lineHeight: 1.5, boxSizing: "border-box" as const,
	},
	input: {
		width: "100%", padding: "7px 10px",
		fontFamily: "var(--font-courier)", fontSize: "11px", color: "#1c1a16",
		background: "#f5f0e8", border: "1px solid #ddd8ce",
		borderRadius: "3px", outline: "none", boxSizing: "border-box" as const,
	},
	btnPrimary: {
		padding: "7px 16px", background: "#1a4731", color: "white",
		fontFamily: "var(--font-courier)", fontSize: "9px",
		letterSpacing: "0.1em", textTransform: "uppercase" as const,
		border: "none", borderRadius: "3px", cursor: "pointer",
	},
	btnPrimaryDisabled: {
		padding: "7px 16px", background: "#c8c0b4", color: "white",
		fontFamily: "var(--font-courier)", fontSize: "9px",
		letterSpacing: "0.1em", textTransform: "uppercase" as const,
		border: "none", borderRadius: "3px", cursor: "not-allowed",
	},
	btnSecondary: {
		padding: "7px 14px", background: "none", color: "#5a5648",
		fontFamily: "var(--font-courier)", fontSize: "9px",
		letterSpacing: "0.1em", textTransform: "uppercase" as const,
		border: "1px solid #ddd8ce", borderRadius: "3px", cursor: "pointer",
	},
	tag: {
		fontFamily: "var(--font-courier)", fontSize: "9px",
		letterSpacing: "0.06em", padding: "2px 7px",
		borderRadius: "2px", border: "1px solid #ddd8ce",
		color: "#5a5648", display: "inline-block",
	},
	warning: {
		padding: "8px 10px", background: "rgba(184,147,58,0.07)",
		border: "1px solid rgba(184,147,58,0.25)", borderRadius: "3px",
		fontFamily: "var(--font-courier)", fontSize: "10px", color: "#7a5f1a",
		lineHeight: 1.5,
	},
	error: {
		padding: "8px 10px", background: "rgba(139,58,42,0.06)",
		border: "1px solid rgba(139,58,42,0.2)", borderRadius: "3px",
		fontFamily: "var(--font-courier)", fontSize: "10px", color: "#8b3a2a",
		lineHeight: 1.5,
	},
	row: { display: "flex", gap: "14px", alignItems: "flex-start" },
	col: { flex: 1, minWidth: 0 },
	divider: { borderTop: "1px solid #ddd8ce", margin: "16px 0" },
	resultRow: {
		display: "flex", justifyContent: "space-between", alignItems: "center",
		padding: "6px 0", borderBottom: "1px solid rgba(221,216,206,0.5)",
	},
	resultLabel: { fontFamily: "var(--font-courier)", fontSize: "10px", color: "#9a9284", letterSpacing: "0.05em" },
	resultValue: { fontFamily: "var(--font-courier)", fontSize: "11px", color: "#1c1a16" },
	stepIndicator: { display: "flex", gap: "6px", alignItems: "center" },
};

function Dot({ active, done }: { active: boolean; done: boolean }) {
	return (
		<span style={{
			width: "6px", height: "6px", borderRadius: "50%",
			background: done ? "#1a4731" : active ? "#1a4731" : "#ddd8ce",
			opacity: active ? 1 : done ? 0.5 : 1,
			display: "inline-block", transition: "background 0.2s",
		}} />
	);
}

function formatLen(n: number) {
	if (n >= 1000) return `${(n / 1000).toFixed(1)} kb`;
	return `${n} bp`;
}

function EnzymeOption({ e, siteCount }: { e: CloneableEnzyme; siteCount: number }) {
	return (
		<option key={e.name} value={e.name} disabled={siteCount === 0}>
			{e.name} ({e.recognition}) — {siteCount} site{siteCount !== 1 ? "s" : ""}
			{siteCount === 0 ? " [no site]" : ""}
		</option>
	);
}

export function CloningModal({ seq, seqName, topology }: CloningModalProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [step, setStep] = useState<Step>(1);

	// Step 1: enzyme selection
	const [e1Name, setE1Name] = useState<string>("");
	const [e2Name, setE2Name] = useState<string>("");
	const [sameEnzyme, setSameEnzyme] = useState(false);
	const [orientation, setOrientation] = useState<"fwd" | "rev">("fwd");

	// Step 2: insert
	const [insertRaw, setInsertRaw] = useState("");

	// Step 3: result
	const [productName, setProductName] = useState("");
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	const overlayRef = useRef<HTMLDivElement>(null);

	// Pre-compute site counts for all enzymes
	const siteCounts = useMemo(() => {
		const upper = seq.toUpperCase();
		const map = new Map<string, number>();
		for (const e of CLONEABLE_ENZYMES_UNIQUE) {
			map.set(e.name, findSites(upper, e.recognition).length);
		}
		return map;
	}, [seq]);

	const cuttingEnzymes = useMemo(
		() => CLONEABLE_ENZYMES_UNIQUE.filter((e) => (siteCounts.get(e.name) ?? 0) > 0),
		[siteCounts],
	);

	// Resolve selected enzyme objects
	const e1 = useMemo(
		() => CLONEABLE_ENZYMES_UNIQUE.find((e) => e.name === e1Name) ?? null,
		[e1Name],
	);
	const e2Resolved = useMemo(() => {
		if (sameEnzyme) return e1;
		return CLONEABLE_ENZYMES_UNIQUE.find((e) => e.name === e2Name) ?? null;
	}, [e2Name, e1, sameEnzyme]);

	const compatible = useMemo(() => {
		if (!e1 || !e2Resolved) return null;
		return areCompatible(e1, e2Resolved);
	}, [e1, e2Resolved]);

	const step1Valid = e1 !== null && e2Resolved !== null && compatible === true;

	// Insert processing
	const insertSeq = useMemo(
		() => insertRaw.toUpperCase().replace(/[^ATGCN\s]/g, "").replace(/\s/g, ""),
		[insertRaw],
	);
	const step2Valid = insertSeq.length >= 6;

	// Cloning simulation (computed on step 3)
	const cloningResult = useMemo<RECloningResult | null>(() => {
		if (!e1 || !e2Resolved || !step2Valid) return null;
		return simulateRECloning(seq, e1, e2Resolved, insertSeq, orientation);
	}, [seq, e1, e2Resolved, insertSeq, orientation, step2Valid]);

	function reset() {
		setStep(1);
		setE1Name("");
		setE2Name("");
		setSameEnzyme(false);
		setOrientation("fwd");
		setInsertRaw("");
		setProductName("");
		setSaveError(null);
		setSaving(false);
	}

	function handleOpen() {
		reset();
		// Default to first enzyme with a site
		if (cuttingEnzymes.length > 0) setE1Name(cuttingEnzymes[0].name);
		setOpen(true);
	}

	function handleClose() {
		setOpen(false);
		reset();
	}

	async function handleSave() {
		if (!cloningResult?.resultSeq || !productName.trim()) return;
		setSaving(true);
		setSaveError(null);
		const result = await saveClonedSequence(
			cloningResult.resultSeq,
			productName.trim(),
			topology,
		);
		setSaving(false);
		if (result.error) {
			setSaveError(result.error);
		} else {
			handleClose();
			router.push(`/sequence/${result.id}`);
		}
	}

	// Close on overlay click
	function handleOverlayClick(e: React.MouseEvent) {
		if (e.target === overlayRef.current) handleClose();
	}

	// Default product name when stepping to 3
	useEffect(() => {
		if (step === 3 && !productName && cloningResult && !cloningResult.error) {
			setProductName(`${seqName} + insert`);
		}
	}, [step, productName, cloningResult, seqName]);

	if (!open) {
		return (
			<button
				onClick={handleOpen}
				style={{
					fontFamily: "var(--font-courier)", fontSize: "9px",
					letterSpacing: "0.08em", textTransform: "uppercase",
					color: "#1a4731", background: "none",
					border: "1px solid rgba(26,71,49,0.35)", borderRadius: "2px",
					padding: "4px 10px", cursor: "pointer", transition: "all 0.1s",
				}}
				onMouseEnter={(e) => {
					(e.currentTarget as HTMLButtonElement).style.background = "rgba(26,71,49,0.06)";
				}}
				onMouseLeave={(e) => {
					(e.currentTarget as HTMLButtonElement).style.background = "none";
				}}
			>
				Clone
			</button>
		);
	}

	return (
		<>
			<button
				onClick={handleOpen}
				style={{
					fontFamily: "var(--font-courier)", fontSize: "9px",
					letterSpacing: "0.08em", textTransform: "uppercase",
					color: "#1a4731", background: "rgba(26,71,49,0.06)",
					border: "1px solid rgba(26,71,49,0.35)", borderRadius: "2px",
					padding: "4px 10px", cursor: "pointer",
				}}
			>
				Clone
			</button>

			<div ref={overlayRef} style={S.overlay} onClick={handleOverlayClick}>
				<div style={S.dialog}>
					{/* Header */}
					<div style={S.header}>
						<div>
							<span style={{
								fontFamily: "var(--font-playfair)", fontSize: "16px",
								color: "#1c1a16", letterSpacing: "-0.01em",
							}}>
								RE Cloning
							</span>
							<span style={{
								fontFamily: "var(--font-courier)", fontSize: "10px",
								color: "#9a9284", marginLeft: "12px",
							}}>
								{seqName}
							</span>
						</div>
						<div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
							<div style={S.stepIndicator}>
								{([1, 2, 3] as Step[]).map((s) => (
									<Dot key={s} active={step === s} done={step > s} />
								))}
							</div>
							<button
								onClick={handleClose}
								style={{
									background: "none", border: "none", cursor: "pointer",
									color: "#9a9284", fontSize: "18px", lineHeight: 1, padding: "0 2px",
								}}
							>
								×
							</button>
						</div>
					</div>

					{/* Body */}
					<div style={S.body}>
						{step === 1 && (
							<Step1
								e1Name={e1Name}
								e2Name={e2Name}
								sameEnzyme={sameEnzyme}
								orientation={orientation}
								siteCounts={siteCounts}
								allEnzymes={CLONEABLE_ENZYMES_UNIQUE}
								e1={e1}
								e2={e2Resolved}
								compatible={compatible}
								onE1Change={setE1Name}
								onE2Change={setE2Name}
								onSameEnzymeChange={(v) => { setSameEnzyme(v); if (v) setE2Name(""); }}
								onOrientationChange={setOrientation}
							/>
						)}
						{step === 2 && (
							<Step2
								insertRaw={insertRaw}
								insertSeq={insertSeq}
								e1={e1}
								e2={e2Resolved}
								onInsertChange={setInsertRaw}
							/>
						)}
						{step === 3 && (
							<Step3
								result={cloningResult}
								productName={productName}
								onProductNameChange={setProductName}
								saving={saving}
								saveError={saveError}
								topology={topology}
							/>
						)}
					</div>

					{/* Footer */}
					<div style={S.footer}>
						{step > 1 && (
							<button
								style={S.btnSecondary}
								onClick={() => setStep((s) => (s - 1) as Step)}
								disabled={saving}
							>
								Back
							</button>
						)}
						<button style={S.btnSecondary} onClick={handleClose}>Cancel</button>
						{step < 3 ? (
							<button
								style={step === 1 ? (step1Valid ? S.btnPrimary : S.btnPrimaryDisabled) : (step2Valid ? S.btnPrimary : S.btnPrimaryDisabled)}
								disabled={step === 1 ? !step1Valid : !step2Valid}
								onClick={() => setStep((s) => (s + 1) as Step)}
							>
								Next →
							</button>
						) : (
							<button
								style={
									saving || !productName.trim() || !!cloningResult?.error
										? S.btnPrimaryDisabled
										: S.btnPrimary
								}
								disabled={saving || !productName.trim() || !!cloningResult?.error}
								onClick={handleSave}
							>
								{saving ? "Saving…" : "Save to Library"}
							</button>
						)}
					</div>
				</div>
			</div>
		</>
	);
}

// ── Step 1: Enzyme Selection ───────────────────────────────────────────────

interface Step1Props {
	e1Name: string;
	e2Name: string;
	sameEnzyme: boolean;
	orientation: "fwd" | "rev";
	siteCounts: Map<string, number>;
	allEnzymes: CloneableEnzyme[];
	e1: CloneableEnzyme | null;
	e2: CloneableEnzyme | null;
	compatible: boolean | null;
	onE1Change: (v: string) => void;
	onE2Change: (v: string) => void;
	onSameEnzymeChange: (v: boolean) => void;
	onOrientationChange: (v: "fwd" | "rev") => void;
}

function Step1({
	e1Name, e2Name, sameEnzyme, orientation, siteCounts, allEnzymes,
	e1, e2, compatible, onE1Change, onE2Change, onSameEnzymeChange, onOrientationChange,
}: Step1Props) {
	const cuttingEnzymes = allEnzymes.filter((e) => (siteCounts.get(e.name) ?? 0) > 0);
	const nonCuttingEnzymes = allEnzymes.filter((e) => (siteCounts.get(e.name) ?? 0) === 0);

	const EnzymeSelect = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
		<div style={S.col}>
			<label style={S.label}>{label}</label>
			<div style={{ position: "relative" }}>
				<select value={value} onChange={(e) => onChange(e.target.value)} style={S.select}>
					<option value="">— select enzyme —</option>
					{cuttingEnzymes.length > 0 && (
						<optgroup label="Sites in vector">
							{cuttingEnzymes.map((e) => (
								<EnzymeOption key={e.name} e={e} siteCount={siteCounts.get(e.name) ?? 0} />
							))}
						</optgroup>
					)}
					{nonCuttingEnzymes.length > 0 && (
						<optgroup label="No site in vector">
							{nonCuttingEnzymes.map((e) => (
								<EnzymeOption key={e.name} e={e} siteCount={0} />
							))}
						</optgroup>
					)}
				</select>
			</div>
		</div>
	);

	return (
		<div>
			<p style={{
				fontFamily: "var(--font-karla)", fontSize: "12px", color: "#5a5648",
				lineHeight: 1.6, margin: "0 0 18px",
			}}>
				Select the two restriction enzymes used to cut the vector. The insert will be ligated between them.
			</p>

			<div style={{ ...S.row, marginBottom: "16px" }}>
				<EnzymeSelect value={e1Name} onChange={onE1Change} label="Left enzyme (5′)" />
				{!sameEnzyme && <EnzymeSelect value={e2Name} onChange={onE2Change} label="Right enzyme (3′)" />}
			</div>

			{/* Same-enzyme toggle */}
			<label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: "16px" }}>
				<input
					type="checkbox"
					checked={sameEnzyme}
					onChange={(e) => onSameEnzymeChange(e.target.checked)}
					style={{ accentColor: "#1a4731", width: "13px", height: "13px" }}
				/>
				<span style={{ fontFamily: "var(--font-courier)", fontSize: "10px", color: "#5a5648", letterSpacing: "0.04em" }}>
					Single-enzyme cloning (cut with same enzyme)
				</span>
			</label>

			{/* Orientation for single-enzyme */}
			{sameEnzyme && e1 && (
				<div style={{ marginBottom: "16px" }}>
					<label style={S.label}>Insert orientation</label>
					<div style={{ display: "flex", gap: "10px" }}>
						{(["fwd", "rev"] as const).map((o) => (
							<label key={o} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
								<input
									type="radio"
									name="orientation"
									value={o}
									checked={orientation === o}
									onChange={() => onOrientationChange(o)}
									style={{ accentColor: "#1a4731" }}
								/>
								<span style={{ fontFamily: "var(--font-courier)", fontSize: "10px", color: "#5a5648" }}>
									{o === "fwd" ? "Forward" : "Reverse complement"}
								</span>
							</label>
						))}
					</div>
				</div>
			)}

			{/* Compatibility indicator */}
			{e1 && e2 && (
				<div style={{
					...(compatible ? {
						padding: "8px 10px", background: "rgba(26,71,49,0.06)",
						border: "1px solid rgba(26,71,49,0.2)", borderRadius: "3px",
					} : S.error),
				}}>
					<span style={{
						fontFamily: "var(--font-courier)", fontSize: "10px",
						color: compatible ? "#1a4731" : "#8b3a2a", letterSpacing: "0.04em",
					}}>
						{compatible
							? `✓ Compatible — ${e1.name} (${e1.overhang || "blunt"}) × ${e2.name} (${e2.overhang || "blunt"})`
							: `✗ Incompatible — ${e1.name} (${e1.overhang}) and ${e2.name} (${e2.overhang}) cannot ligate directly`
						}
					</span>
				</div>
			)}

			{/* Site summary */}
			{(e1 || e2) && (
				<div style={{ marginTop: "14px", display: "flex", gap: "8px", flexWrap: "wrap" as const }}>
					{e1 && (
						<span style={S.tag}>
							{e1.name}: {siteCounts.get(e1.name) ?? 0} site{(siteCounts.get(e1.name) ?? 0) !== 1 ? "s" : ""} in vector
						</span>
					)}
					{e2 && !sameEnzyme && (
						<span style={S.tag}>
							{e2.name}: {siteCounts.get(e2.name) ?? 0} site{(siteCounts.get(e2.name) ?? 0) !== 1 ? "s" : ""} in vector
						</span>
					)}
				</div>
			)}
		</div>
	);
}

// ── Step 2: Insert Sequence ────────────────────────────────────────────────

interface Step2Props {
	insertRaw: string;
	insertSeq: string;
	e1: CloneableEnzyme | null;
	e2: CloneableEnzyme | null;
	onInsertChange: (v: string) => void;
}

function Step2({ insertRaw, insertSeq, e1, e2, onInsertChange }: Step2Props) {
	const gc = useMemo(() => {
		if (!insertSeq) return null;
		const n = insertSeq.split("").filter((c) => c === "G" || c === "C").length;
		return ((n / insertSeq.length) * 100).toFixed(1);
	}, [insertSeq]);

	const hasE1Site = e1 && insertSeq ? findSites(insertSeq, e1.recognition).length > 0 : false;
	const hasE2Site = e2 && e2.name !== e1?.name && insertSeq ? findSites(insertSeq, e2.recognition).length > 0 : false;

	return (
		<div>
			<p style={{
				fontFamily: "var(--font-karla)", fontSize: "12px", color: "#5a5648",
				lineHeight: 1.6, margin: "0 0 14px",
			}}>
				Paste the insert sequence <strong>without</strong> the enzyme recognition sites — just the insert coding sequence. Enzyme sites will be added during ligation.
			</p>

			<label style={S.label}>Insert sequence (DNA)</label>
			<textarea
				value={insertRaw}
				onChange={(e) => onInsertChange(e.target.value)}
				placeholder="ATGAAGCTG…"
				rows={6}
				style={S.textarea}
				spellCheck={false}
				autoCorrect="off"
				autoCapitalize="none"
			/>

			{insertSeq.length > 0 && (
				<div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" as const }}>
					<span style={S.tag}>{formatLen(insertSeq.length)}</span>
					{gc !== null && <span style={S.tag}>{gc}% GC</span>}
				</div>
			)}

			{(hasE1Site || hasE2Site) && (
				<div style={{ ...S.warning, marginTop: "12px" }}>
					⚠ Internal enzyme site{hasE1Site && hasE2Site ? "s" : ""} detected:{" "}
					{[hasE1Site && e1?.name, hasE2Site && e2?.name].filter(Boolean).join(", ")}.
					Partial digestion will occur during prep — consider removing these sites.
				</div>
			)}

			{insertSeq.length > 0 && insertSeq.length < 6 && (
				<div style={{ ...S.error, marginTop: "12px" }}>
					Insert must be at least 6 bp.
				</div>
			)}
		</div>
	);
}

// ── Step 3: Preview + Save ─────────────────────────────────────────────────

interface Step3Props {
	result: RECloningResult | null;
	productName: string;
	onProductNameChange: (v: string) => void;
	saving: boolean;
	saveError: string | null;
	topology: "circular" | "linear";
}

function Step3({ result, productName, onProductNameChange, saving, saveError, topology }: Step3Props) {
	if (!result) {
		return (
			<div style={{ fontFamily: "var(--font-courier)", fontSize: "11px", color: "#9a9284", padding: "20px 0" }}>
				Computing cloning result…
			</div>
		);
	}

	if (result.error) {
		return (
			<div style={S.error}>
				<strong>Cloning error:</strong> {result.error}
			</div>
		);
	}

	return (
		<div>
			<p style={{
				fontFamily: "var(--font-karla)", fontSize: "12px", color: "#5a5648",
				lineHeight: 1.6, margin: "0 0 16px",
			}}>
				Review the cloning result and name your product.
			</p>

			{/* Stats */}
			<div style={{ marginBottom: "16px" }}>
				{[
					{ label: "Product size", value: formatLen(result.productSize) },
					{ label: "Insert size", value: formatLen(result.insertSize) },
					{ label: "Topology", value: topology },
					{
						label: "Left junction",
						value: result.leftJunction + (result.leftJunctionCuttable ? " ✓ excisable" : " ✗ scar"),
					},
					{
						label: "Right junction",
						value: result.rightJunction + (result.rightJunctionCuttable ? " ✓ excisable" : " ✗ scar"),
					},
				].map(({ label, value }) => (
					<div key={label} style={S.resultRow}>
						<span style={S.resultLabel}>{label}</span>
						<span style={S.resultValue}>{value}</span>
					</div>
				))}
			</div>

			{/* Warnings */}
			{result.warnings.length > 0 && (
				<div style={{ ...S.warning, marginBottom: "16px" }}>
					{result.warnings.map((w, i) => (
						<div key={i} style={{ marginBottom: i < result.warnings.length - 1 ? "4px" : 0 }}>
							⚠ {w}
						</div>
					))}
				</div>
			)}

			<div style={S.divider} />

			{/* Product name */}
			<label style={S.label}>Product name</label>
			<input
				type="text"
				value={productName}
				onChange={(e) => onProductNameChange(e.target.value)}
				placeholder="e.g. pCMV-GFP-insert"
				style={S.input}
				disabled={saving}
			/>

			{saveError && (
				<div style={{ ...S.error, marginTop: "12px" }}>
					{saveError}
				</div>
			)}
		</div>
	);
}
