"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
	CLONEABLE_ENZYMES_UNIQUE,
	findSites,
	areCompatible,
	simulateRECloning,
	type CloneableEnzyme,
	type RECloningResult,
} from "@/lib/bio/cloning";
import { simulateGibson, simulateGibsonMulti, type GibsonResult, type GibsonFragment } from "@/lib/bio/gibson";
import { simulateGatewayLR, simulateGatewayBP, ATT_SEQUENCES, type GatewayResult, type GatewayReaction } from "@/lib/bio/gateway";
import { saveClonedSequence } from "@/app/actions/sequences";

interface CloningModalProps {
	seq: string;
	seqName: string;
	topology: "circular" | "linear";
}

type Method = "re" | "gibson" | "gateway";
type Step = 1 | 2 | 3;

// ── Shared styles ──────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
	overlay: {
		position: "fixed", inset: 0, zIndex: 1000,
		background: "rgba(28,26,22,0.55)", backdropFilter: "blur(2px)",
		display: "flex", alignItems: "center", justifyContent: "center",
	},
	dialog: {
		background: "#faf7f2", border: "1px solid #ddd8ce",
		borderRadius: "4px", width: "560px", maxWidth: "calc(100vw - 32px)",
		maxHeight: "90vh", display: "flex", flexDirection: "column",
		boxShadow: "0 8px 32px rgba(28,26,22,0.18)",
	},
	header: {
		padding: "16px 20px 0", borderBottom: "1px solid #ddd8ce",
		flexShrink: 0,
	},
	body: { padding: "20px", overflowY: "auto", flex: 1 },
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
		borderRadius: "3px", outline: "none", cursor: "pointer",
	},
	textarea: {
		width: "100%", padding: "8px 10px", resize: "none" as const,
		fontFamily: "var(--font-courier)", fontSize: "10px", color: "#1c1a16",
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
	btnDisabled: {
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
	warn: {
		padding: "8px 10px", background: "rgba(184,147,58,0.07)",
		border: "1px solid rgba(184,147,58,0.25)", borderRadius: "3px",
		fontFamily: "var(--font-courier)", fontSize: "10px", color: "#7a5f1a", lineHeight: 1.5,
	},
	err: {
		padding: "8px 10px", background: "rgba(139,58,42,0.06)",
		border: "1px solid rgba(139,58,42,0.2)", borderRadius: "3px",
		fontFamily: "var(--font-courier)", fontSize: "10px", color: "#8b3a2a", lineHeight: 1.5,
	},
	ok: {
		padding: "8px 10px", background: "rgba(26,71,49,0.06)",
		border: "1px solid rgba(26,71,49,0.2)", borderRadius: "3px",
		fontFamily: "var(--font-courier)", fontSize: "10px", color: "#1a4731", lineHeight: 1.5,
	},
	resultRow: {
		display: "flex", justifyContent: "space-between", alignItems: "baseline",
		padding: "6px 0", borderBottom: "1px solid rgba(221,216,206,0.5)",
	},
	rlabel: { fontFamily: "var(--font-courier)", fontSize: "10px", color: "#9a9284", letterSpacing: "0.05em" },
	rvalue: { fontFamily: "var(--font-courier)", fontSize: "11px", color: "#1c1a16" },
	divider: { borderTop: "1px solid #ddd8ce", margin: "16px 0" },
	row: { display: "flex", gap: "14px" },
	col: { flex: 1, minWidth: 0 },
	prose: { fontFamily: "var(--font-karla)", fontSize: "12px", color: "#5a5648", lineHeight: 1.6, margin: "0 0 16px" },
};

const METHOD_LABELS: Record<Method, string> = {
	re: "RE Cloning",
	gibson: "Gibson Assembly",
	gateway: "Gateway",
};

function formatLen(n: number) {
	if (n >= 1000) return `${(n / 1000).toFixed(1)} kb`;
	return `${n} bp`;
}

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

function WarnList({ items }: { items: string[] }) {
	if (!items.length) return null;
	return (
		<div style={{ ...S.warn, marginTop: "12px" }}>
			{items.map((w, i) => <div key={i} style={{ marginBottom: i < items.length - 1 ? "4px" : 0 }}>⚠ {w}</div>)}
		</div>
	);
}

function ResultRow({ label, value }: { label: string; value: string }) {
	return (
		<div style={S.resultRow}>
			<span style={S.rlabel}>{label}</span>
			<span style={S.rvalue}>{value}</span>
		</div>
	);
}

// ── Root component ─────────────────────────────────────────────────────────

export function CloningModal({ seq, seqName, topology }: CloningModalProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [method, setMethod] = useState<Method>("re");
	const [step, setStep] = useState<Step>(1);

	// RE state
	const [e1Name, setE1Name] = useState("");
	const [e2Name, setE2Name] = useState("");
	const [sameEnzyme, setSameEnzyme] = useState(false);
	const [reOrientation, setReOrientation] = useState<"fwd" | "rev">("fwd");
	const [reInsert, setReInsert] = useState("");

	// Gibson state
	const [gibsonCutPos, setGibsonCutPos] = useState<number>(0);
	const [gibsonInserts, setGibsonInserts] = useState<GibsonFragment[]>([{ name: "Insert 1", seq: "" }]);

	// Gateway state
	const [gatewayReaction, setGatewayReaction] = useState<GatewayReaction>("LR");
	const [gatewaySeqA, setGatewaySeqA] = useState(""); // entry clone (LR) or PCR product (BP)
	const [gatewaySeqB, setGatewaySeqB] = useState(""); // dest vector (LR) or donor vector (BP)

	// Shared save state
	const [productName, setProductName] = useState("");
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	// Pre-compute RE enzyme site counts
	const siteCounts = useMemo(() => {
		const upper = seq.toUpperCase();
		const map = new Map<string, number>();
		for (const e of CLONEABLE_ENZYMES_UNIQUE) map.set(e.name, findSites(upper, e.recognition).length);
		return map;
	}, [seq]);

	const e1 = useMemo(() => CLONEABLE_ENZYMES_UNIQUE.find((e) => e.name === e1Name) ?? null, [e1Name]);
	const e2Resolved = useMemo(() => {
		if (sameEnzyme) return e1;
		return CLONEABLE_ENZYMES_UNIQUE.find((e) => e.name === e2Name) ?? null;
	}, [e2Name, e1, sameEnzyme]);
	const reCompatible = useMemo(() => e1 && e2Resolved ? areCompatible(e1, e2Resolved) : null, [e1, e2Resolved]);

	// Compute results for step 3
	const reResult = useMemo<RECloningResult | null>(() => {
		if (step !== 3 || method !== "re") return null;
		if (!e1 || !e2Resolved || !reInsert.trim()) return null;
		return simulateRECloning(seq, e1, e2Resolved, reInsert, reOrientation);
	}, [step, method, seq, e1, e2Resolved, reInsert, reOrientation]);

	const gibsonResult = useMemo<GibsonResult | null>(() => {
		if (step !== 3 || method !== "gibson") return null;
		const filled = gibsonInserts.filter((f) => f.seq.trim());
		if (!filled.length) return null;
		return simulateGibsonMulti(seq, gibsonCutPos, filled);
	}, [step, method, seq, gibsonCutPos, gibsonInserts]);

	const gatewayResult = useMemo<GatewayResult | null>(() => {
		if (step !== 3 || method !== "gateway") return null;
		if (!gatewaySeqA.trim() || !gatewaySeqB.trim()) return null;
		return gatewayReaction === "LR"
			? simulateGatewayLR(gatewaySeqA, gatewaySeqB)
			: simulateGatewayBP(gatewaySeqA, gatewaySeqB);
	}, [step, method, gatewayReaction, gatewaySeqA, gatewaySeqB]);

	const currentResult = method === "re" ? reResult : method === "gibson" ? gibsonResult : gatewayResult;

	// Step validity
	const step1Valid = useMemo(() => {
		if (method === "re") return e1 !== null && e2Resolved !== null && reCompatible === true;
		if (method === "gibson") return gibsonCutPos >= 0 && gibsonCutPos <= seq.length;
		// gateway: reaction type is always selected
		return true;
	}, [method, e1, e2Resolved, reCompatible, gibsonCutPos, seq.length]);

	const step2Valid = useMemo(() => {
		if (method === "re") return reInsert.replace(/[^ATGCN]/gi, "").length >= 6;
		if (method === "gibson") return gibsonInserts.some((f) => f.seq.replace(/[^ATGCN]/gi, "").length >= 6);
		if (method === "gateway") return gatewaySeqA.replace(/[^ATGCN]/gi, "").length >= 50 && gatewaySeqB.replace(/[^ATGCN]/gi, "").length >= 50;
		return false;
	}, [method, reInsert, gibsonInserts, gatewaySeqA, gatewaySeqB]);

	function reset() {
		setStep(1); setE1Name(""); setE2Name(""); setSameEnzyme(false);
		setReOrientation("fwd"); setReInsert("");
		setGibsonCutPos(0); setGibsonInserts([{ name: "Insert 1", seq: "" }]);
		setGatewayReaction("LR"); setGatewaySeqA(""); setGatewaySeqB("");
		setProductName(""); setSaveError(null); setSaving(false);
	}

	function handleOpen() {
		reset();
		const first = CLONEABLE_ENZYMES_UNIQUE.find((e) => (siteCounts.get(e.name) ?? 0) > 0);
		if (first) setE1Name(first.name);
		setOpen(true);
	}

	function handleClose() { setOpen(false); reset(); }

	useEffect(() => {
		if (step === 3 && !productName && currentResult && !currentResult.error) {
			setProductName(`${seqName} — ${METHOD_LABELS[method]} product`);
		}
	}, [step, productName, currentResult, seqName, method]);

	async function handleSave() {
		if (!currentResult?.resultSeq || !productName.trim()) return;
		setSaving(true); setSaveError(null);
		const res = await saveClonedSequence(currentResult.resultSeq, productName.trim(), topology);
		setSaving(false);
		if (res.error) { setSaveError(res.error); return; }
		handleClose();
		router.push(`/sequence/${res.id}`);
	}

	const triggerBtn = (
		<button
			onClick={handleOpen}
			style={{
				fontFamily: "var(--font-courier)", fontSize: "9px",
				letterSpacing: "0.08em", textTransform: "uppercase",
				color: "#1a4731", background: open ? "rgba(26,71,49,0.06)" : "none",
				border: "1px solid rgba(26,71,49,0.35)", borderRadius: "2px",
				padding: "4px 10px", cursor: "pointer", transition: "all 0.1s",
			}}
			onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(26,71,49,0.06)"; }}
			onMouseLeave={(e) => { if (!open) (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
		>
			Clone
		</button>
	);

	if (!open) return triggerBtn;

	return (
		<>
			{triggerBtn}
			<div
				style={S.overlay}
				onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
			>
				<div style={S.dialog}>
					{/* Header */}
					<div style={S.header}>
						<div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "12px" }}>
							<div>
								<span style={{ fontFamily: "var(--font-playfair)", fontSize: "16px", color: "#1c1a16", letterSpacing: "-0.01em" }}>
									{METHOD_LABELS[method]}
								</span>
								<span style={{ fontFamily: "var(--font-courier)", fontSize: "10px", color: "#9a9284", marginLeft: "12px" }}>
									{seqName}
								</span>
							</div>
							<div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
								<div style={{ display: "flex", gap: "5px" }}>
									{([1, 2, 3] as Step[]).map((s) => <Dot key={s} active={step === s} done={step > s} />)}
								</div>
								<button onClick={handleClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9a9284", fontSize: "18px", lineHeight: 1, padding: "0 2px" }}>×</button>
							</div>
						</div>

						{/* Method tabs */}
						<div style={{ display: "flex", gap: "0" }}>
							{(Object.keys(METHOD_LABELS) as Method[]).map((m) => (
								<button
									key={m}
									onClick={() => { setMethod(m); setStep(1); }}
									style={{
										padding: "8px 14px",
										fontFamily: "var(--font-courier)", fontSize: "9px",
										letterSpacing: "0.1em", textTransform: "uppercase",
										color: method === m ? "#1a4731" : "#9a9284",
										background: "none", border: "none",
										borderBottom: method === m ? "2px solid #1a4731" : "2px solid transparent",
										cursor: "pointer", transition: "color 0.1s",
										marginBottom: "-1px",
									}}
								>
									{METHOD_LABELS[m]}
								</button>
							))}
						</div>
					</div>

					{/* Body */}
					<div style={S.body}>
						{method === "re" && step === 1 && (
							<REStep1
								e1Name={e1Name} e2Name={e2Name} sameEnzyme={sameEnzyme}
								orientation={reOrientation} siteCounts={siteCounts}
								e1={e1} e2={e2Resolved} compatible={reCompatible}
								onE1Change={setE1Name} onE2Change={setE2Name}
								onSameEnzymeChange={(v) => { setSameEnzyme(v); if (v) setE2Name(""); }}
								onOrientationChange={setReOrientation}
							/>
						)}
						{method === "re" && step === 2 && (
							<REStep2
								insertRaw={reInsert} e1={e1} e2={e2Resolved}
								onChange={setReInsert}
							/>
						)}
						{method === "gibson" && step === 1 && (
							<GibsonStep1
								seq={seq} cutPos={gibsonCutPos}
								onChange={setGibsonCutPos}
							/>
						)}
						{method === "gibson" && step === 2 && (
							<GibsonStep2
								fragments={gibsonInserts}
								onChange={setGibsonInserts}
							/>
						)}
						{method === "gateway" && step === 1 && (
							<GatewayStep1
								reaction={gatewayReaction}
								onChange={setGatewayReaction}
							/>
						)}
						{method === "gateway" && step === 2 && (
							<GatewayStep2
								reaction={gatewayReaction}
								seqA={gatewaySeqA} seqB={gatewaySeqB}
								onSeqAChange={setGatewaySeqA} onSeqBChange={setGatewaySeqB}
							/>
						)}
						{step === 3 && (
							<PreviewStep
								result={currentResult}
								method={method}
								productName={productName}
								onProductNameChange={setProductName}
								saving={saving} saveError={saveError}
							/>
						)}
					</div>

					{/* Footer */}
					<div style={S.footer}>
						{step > 1 && <button style={S.btnSecondary} onClick={() => setStep((s) => (s - 1) as Step)} disabled={saving}>Back</button>}
						<button style={S.btnSecondary} onClick={handleClose}>Cancel</button>
						{step < 3 ? (
							<button
								style={(step === 1 ? step1Valid : step2Valid) ? S.btnPrimary : S.btnDisabled}
								disabled={step === 1 ? !step1Valid : !step2Valid}
								onClick={() => setStep((s) => (s + 1) as Step)}
							>
								Next →
							</button>
						) : (
							<button
								style={saving || !productName.trim() || !!currentResult?.error ? S.btnDisabled : S.btnPrimary}
								disabled={saving || !productName.trim() || !!currentResult?.error}
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

// ── RE Cloning Steps ───────────────────────────────────────────────────────

function REStep1({
	e1Name, e2Name, sameEnzyme, orientation, siteCounts,
	e1, e2, compatible, onE1Change, onE2Change, onSameEnzymeChange, onOrientationChange,
}: {
	e1Name: string; e2Name: string; sameEnzyme: boolean; orientation: "fwd" | "rev";
	siteCounts: Map<string, number>; e1: CloneableEnzyme | null; e2: CloneableEnzyme | null;
	compatible: boolean | null; onE1Change: (v: string) => void; onE2Change: (v: string) => void;
	onSameEnzymeChange: (v: boolean) => void; onOrientationChange: (v: "fwd" | "rev") => void;
}) {
	const cutting = CLONEABLE_ENZYMES_UNIQUE.filter((e) => (siteCounts.get(e.name) ?? 0) > 0);
	const nonCutting = CLONEABLE_ENZYMES_UNIQUE.filter((e) => (siteCounts.get(e.name) ?? 0) === 0);

	const EnzSelect = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
		<div style={S.col}>
			<label style={S.label}>{label}</label>
			<select value={value} onChange={(e) => onChange(e.target.value)} style={S.select}>
				<option value="">— select enzyme —</option>
				{cutting.length > 0 && <optgroup label="Sites in vector">
					{cutting.map((e) => <option key={e.name} value={e.name}>{e.name} ({e.recognition}) — {siteCounts.get(e.name)} site{siteCounts.get(e.name) !== 1 ? "s" : ""}</option>)}
				</optgroup>}
				{nonCutting.length > 0 && <optgroup label="No site in vector">
					{nonCutting.map((e) => <option key={e.name} value={e.name} disabled>{e.name} ({e.recognition}) — no site</option>)}
				</optgroup>}
			</select>
		</div>
	);

	return (
		<div>
			<p style={S.prose}>Select the two restriction enzymes used to cut the vector. The insert will be ligated between them.</p>
			<div style={{ ...S.row, marginBottom: "16px" }}>
				<EnzSelect value={e1Name} onChange={onE1Change} label="Left enzyme (5′)" />
				{!sameEnzyme && <EnzSelect value={e2Name} onChange={onE2Change} label="Right enzyme (3′)" />}
			</div>
			<label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: "14px" }}>
				<input type="checkbox" checked={sameEnzyme} onChange={(e) => onSameEnzymeChange(e.target.checked)} style={{ accentColor: "#1a4731", width: "13px", height: "13px" }} />
				<span style={{ fontFamily: "var(--font-courier)", fontSize: "10px", color: "#5a5648", letterSpacing: "0.04em" }}>Single-enzyme cloning (cut with same enzyme)</span>
			</label>
			{sameEnzyme && e1 && (
				<div style={{ marginBottom: "14px" }}>
					<label style={S.label}>Insert orientation</label>
					<div style={{ display: "flex", gap: "14px" }}>
						{(["fwd", "rev"] as const).map((o) => (
							<label key={o} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
								<input type="radio" name="re-orientation" value={o} checked={orientation === o} onChange={() => onOrientationChange(o)} style={{ accentColor: "#1a4731" }} />
								<span style={{ fontFamily: "var(--font-courier)", fontSize: "10px", color: "#5a5648" }}>{o === "fwd" ? "Forward" : "Reverse complement"}</span>
							</label>
						))}
					</div>
				</div>
			)}
			{e1 && e2 && (
				<div style={compatible ? S.ok : S.err}>
					<span style={{ fontFamily: "var(--font-courier)", fontSize: "10px", letterSpacing: "0.04em" }}>
						{compatible
							? `✓ Compatible — ${e1.name} (${e1.overhang || "blunt"}) × ${e2.name} (${e2.overhang || "blunt"})`
							: `✗ Incompatible — ${e1.name} (${e1.overhang}) and ${e2.name} (${e2.overhang}) cannot ligate directly`}
					</span>
				</div>
			)}
			{(e1 || e2) && (
				<div style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap" as const }}>
					{e1 && <span style={S.tag}>{e1.name}: {siteCounts.get(e1.name) ?? 0} site{(siteCounts.get(e1.name) ?? 0) !== 1 ? "s" : ""} in vector</span>}
					{e2 && !sameEnzyme && <span style={S.tag}>{e2.name}: {siteCounts.get(e2.name) ?? 0} site{(siteCounts.get(e2.name) ?? 0) !== 1 ? "s" : ""} in vector</span>}
				</div>
			)}
		</div>
	);
}

function REStep2({ insertRaw, e1, e2, onChange }: { insertRaw: string; e1: CloneableEnzyme | null; e2: CloneableEnzyme | null; onChange: (v: string) => void }) {
	const ins = insertRaw.toUpperCase().replace(/[^ATGCN]/g, "");
	const gc = ins.length ? ((ins.split("").filter((c) => c === "G" || c === "C").length / ins.length) * 100).toFixed(1) : null;
	const hasE1 = e1 && ins ? findSites(ins, e1.recognition).length > 0 : false;
	const hasE2 = e2 && e2.name !== e1?.name && ins ? findSites(ins, e2.recognition).length > 0 : false;

	return (
		<div>
			<p style={S.prose}>Paste the insert sequence <strong>without</strong> the enzyme recognition sites — just the insert coding sequence.</p>
			<label style={S.label}>Insert sequence (DNA)</label>
			<textarea value={insertRaw} onChange={(e) => onChange(e.target.value)} placeholder="ATGAAGCTG…" rows={6} style={S.textarea} spellCheck={false} />
			{ins.length > 0 && (
				<div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" as const }}>
					<span style={S.tag}>{formatLen(ins.length)}</span>
					{gc && <span style={S.tag}>{gc}% GC</span>}
				</div>
			)}
			{(hasE1 || hasE2) && (
				<div style={{ ...S.warn, marginTop: "10px" }}>
					⚠ Internal {e1?.name}{hasE2 ? ` / ${e2?.name}` : ""} site detected — partial digestion may occur.
				</div>
			)}
		</div>
	);
}

// ── Gibson Assembly Steps ──────────────────────────────────────────────────

function GibsonStep1({ seq, cutPos, onChange }: { seq: string; cutPos: number; onChange: (v: number) => void }) {
	const leftCtx = seq.slice(Math.max(0, cutPos - 25), cutPos).toUpperCase();
	const rightCtx = seq.slice(cutPos, Math.min(seq.length, cutPos + 25)).toUpperCase();

	return (
		<div>
			<p style={S.prose}>
				Select the position in the vector where it will be linearized. The insert must carry 15–30 bp homology arms matching the sequences flanking this cut.
			</p>
			<label style={S.label}>Linearization position (0 – {seq.length.toLocaleString()})</label>
			<input
				type="number" min={0} max={seq.length} value={cutPos}
				onChange={(e) => onChange(Math.max(0, Math.min(seq.length, parseInt(e.target.value) || 0)))}
				style={{ ...S.input, width: "160px", marginBottom: "12px" }}
			/>
			<input
				type="range" min={0} max={seq.length} value={cutPos}
				onChange={(e) => onChange(parseInt(e.target.value))}
				style={{ width: "100%", accentColor: "#1a4731", marginBottom: "14px", display: "block" }}
			/>
			{seq.length > 0 && (
				<div>
					<label style={S.label}>Sequence context</label>
					<div style={{
						fontFamily: "var(--font-courier)", fontSize: "11px", color: "#1c1a16",
						background: "#f5f0e8", border: "1px solid #ddd8ce", borderRadius: "3px",
						padding: "8px 10px", letterSpacing: "0.05em",
					}}>
						<span style={{ color: "#9a9284" }}>{leftCtx || "—"}</span>
						<span style={{ color: "#1a4731", fontWeight: 700 }}>↓</span>
						<span style={{ color: "#9a9284" }}>{rightCtx || "—"}</span>
					</div>
					<div style={{ marginTop: "6px", display: "flex", gap: "8px" }}>
						<span style={S.tag}>Left flank: …{leftCtx.slice(-20)}</span>
						<span style={S.tag}>Right flank: {rightCtx.slice(0, 20)}…</span>
					</div>
				</div>
			)}
			<div style={{ ...S.ok, marginTop: "14px" }}>
				<span style={{ fontFamily: "var(--font-courier)", fontSize: "10px" }}>
					Required forward primer 5′ tail: {seq.slice(Math.max(0, cutPos - 20), cutPos).toUpperCase() || "—"}
					<br />
					Required reverse primer 5′ tail (RC): {seq.slice(cutPos, cutPos + 20).toUpperCase() || "—"}
				</span>
			</div>
		</div>
	);
}

function GibsonStep2({ fragments, onChange }: { fragments: GibsonFragment[]; onChange: (f: GibsonFragment[]) => void }) {
	function updateFrag(i: number, field: keyof GibsonFragment, value: string) {
		const next = fragments.map((f, j) => j === i ? { ...f, [field]: value } : f);
		onChange(next);
	}
	function addFrag() { onChange([...fragments, { name: `Insert ${fragments.length + 1}`, seq: "" }]); }
	function removeFrag(i: number) { onChange(fragments.filter((_, j) => j !== i)); }

	return (
		<div>
			<p style={S.prose}>
				Paste each insert fragment. Fragments must overlap each other and the vector by ≥15 bp, or the primer tails needed will be shown in the preview.
			</p>
			{fragments.map((frag, i) => {
				const clean = frag.seq.toUpperCase().replace(/[^ATGCN]/g, "");
				const gc = clean.length ? ((clean.split("").filter((c) => c === "G" || c === "C").length / clean.length) * 100).toFixed(1) : null;
				return (
					<div key={i} style={{ marginBottom: "16px", padding: "12px", background: "rgba(221,216,206,0.2)", borderRadius: "3px", border: "1px solid #ddd8ce" }}>
						<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
							<input
								value={frag.name} onChange={(e) => updateFrag(i, "name", e.target.value)}
								style={{ ...S.input, width: "200px", fontSize: "10px" }}
							/>
							{fragments.length > 1 && (
								<button onClick={() => removeFrag(i)} style={{ background: "none", border: "none", color: "#9a9284", cursor: "pointer", fontSize: "12px" }}>✕</button>
							)}
						</div>
						<textarea
							value={frag.seq} onChange={(e) => updateFrag(i, "seq", e.target.value)}
							placeholder="Paste fragment sequence (with homology arms if available)…"
							rows={4} style={S.textarea} spellCheck={false}
						/>
						{clean.length > 0 && (
							<div style={{ marginTop: "6px", display: "flex", gap: "8px" }}>
								<span style={S.tag}>{formatLen(clean.length)}</span>
								{gc && <span style={S.tag}>{gc}% GC</span>}
							</div>
						)}
					</div>
				);
			})}
			<button
				onClick={addFrag}
				style={{ ...S.btnSecondary, fontSize: "9px", marginTop: "4px" }}
			>
				+ Add fragment
			</button>
		</div>
	);
}

// ── Gateway Steps ──────────────────────────────────────────────────────────

function GatewayStep1({ reaction, onChange }: { reaction: GatewayReaction; onChange: (r: GatewayReaction) => void }) {
	return (
		<div>
			<p style={S.prose}>
				Gateway recombination uses site-specific att sites. Choose the reaction type, then provide the two sequences.
			</p>
			<label style={S.label}>Reaction type</label>
			<div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
				{(["LR", "BP"] as GatewayReaction[]).map((r) => (
					<label key={r} style={{
						flex: 1, display: "flex", flexDirection: "column", gap: "6px",
						cursor: "pointer", padding: "12px", borderRadius: "3px",
						border: `1px solid ${reaction === r ? "rgba(26,71,49,0.4)" : "#ddd8ce"}`,
						background: reaction === r ? "rgba(26,71,49,0.04)" : "#f5f0e8",
						transition: "all 0.1s",
					}}>
						<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
							<input type="radio" name="gw-reaction" value={r} checked={reaction === r} onChange={() => onChange(r)} style={{ accentColor: "#1a4731" }} />
							<span style={{ fontFamily: "var(--font-courier)", fontSize: "11px", color: "#1c1a16", letterSpacing: "0.04em" }}>{r} Reaction</span>
						</div>
						<span style={{ fontFamily: "var(--font-karla)", fontSize: "11px", color: "#9a9284", lineHeight: 1.4 }}>
							{r === "LR"
								? "attL (entry clone) × attR (dest. vector) → attB expression clone"
								: "attB (PCR product) × attP (donor vector) → attL entry clone"}
						</span>
					</label>
				))}
			</div>

			<div style={{ ...S.ok }}>
				<div style={{ fontFamily: "var(--font-courier)", fontSize: "10px", color: "#1a4731", marginBottom: "6px" }}>
					Required att site sequences
				</div>
				{reaction === "LR" ? (
					<>
						<div style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#5a5648", marginBottom: "2px" }}>
							attL1 (in entry clone): <code style={{ color: "#1c1a16" }}>{ATT_SEQUENCES.attL1}</code>
						</div>
						<div style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#5a5648" }}>
							attL2 (in entry clone): <code style={{ color: "#1c1a16" }}>{ATT_SEQUENCES.attL2}</code>
						</div>
					</>
				) : (
					<>
						<div style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#5a5648", marginBottom: "2px" }}>
							attB1 (in PCR product): <code style={{ color: "#1c1a16" }}>{ATT_SEQUENCES.attB1}</code>
						</div>
						<div style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#5a5648" }}>
							attB2 (in PCR product): <code style={{ color: "#1c1a16" }}>{ATT_SEQUENCES.attB2}</code>
						</div>
					</>
				)}
			</div>
		</div>
	);
}

function GatewayStep2({
	reaction, seqA, seqB, onSeqAChange, onSeqBChange,
}: { reaction: GatewayReaction; seqA: string; seqB: string; onSeqAChange: (v: string) => void; onSeqBChange: (v: string) => void }) {
	const labelA = reaction === "LR" ? "Entry clone sequence (attL1…GOI…attL2)" : "PCR product sequence (attB1…GOI…attB2)";
	const labelB = reaction === "LR" ? "Destination vector sequence (contains attR1, attR2)" : "Donor vector sequence (contains attP1, attP2)";
	const cleanA = seqA.replace(/[^ATGCN]/gi, "").toUpperCase();
	const cleanB = seqB.replace(/[^ATGCN]/gi, "").toUpperCase();

	return (
		<div>
			<p style={S.prose}>Paste both sequences. The att sites must be present — the simulator will find and use them automatically.</p>
			<label style={S.label}>{labelA}</label>
			<textarea value={seqA} onChange={(e) => onSeqAChange(e.target.value)} placeholder="Paste sequence…" rows={5} style={{ ...S.textarea, marginBottom: "4px" }} spellCheck={false} />
			{cleanA.length > 0 && <div style={{ marginBottom: "14px", display: "flex", gap: "6px" }}><span style={S.tag}>{formatLen(cleanA.length)}</span></div>}

			<label style={S.label}>{labelB}</label>
			<textarea value={seqB} onChange={(e) => onSeqBChange(e.target.value)} placeholder="Paste sequence…" rows={5} style={{ ...S.textarea, marginBottom: "4px" }} spellCheck={false} />
			{cleanB.length > 0 && <div style={{ display: "flex", gap: "6px" }}><span style={S.tag}>{formatLen(cleanB.length)}</span></div>}
		</div>
	);
}

// ── Shared Preview Step ────────────────────────────────────────────────────

function PreviewStep({
	result, method, productName, onProductNameChange, saving, saveError,
}: {
	result: RECloningResult | GibsonResult | GatewayResult | null;
	method: Method; productName: string;
	onProductNameChange: (v: string) => void;
	saving: boolean; saveError: string | null;
}) {
	if (!result) return <div style={{ fontFamily: "var(--font-courier)", fontSize: "11px", color: "#9a9284" }}>Computing…</div>;
	if (result.error) return <div style={S.err}><strong>Error:</strong> {result.error}</div>;

	const rows: { label: string; value: string }[] = [];

	if (method === "re") {
		const r = result as RECloningResult;
		rows.push(
			{ label: "Product size", value: formatLen(r.productSize) },
			{ label: "Insert size", value: formatLen(r.insertSize) },
			{ label: "Left junction", value: r.leftJunction + (r.leftJunctionCuttable ? " ✓" : " ✗ scar") },
			{ label: "Right junction", value: r.rightJunction + (r.rightJunctionCuttable ? " ✓" : " ✗ scar") },
		);
	} else if (method === "gibson") {
		const r = result as GibsonResult;
		rows.push({ label: "Product size", value: formatLen(r.productSize) });
		r.fragments.forEach((f) => rows.push({
			label: f.name,
			value: `${formatLen(f.size)} · L overlap ${f.leftOverlapLen} bp · R overlap ${f.rightOverlapLen} bp`,
		}));
	} else {
		const r = result as GatewayResult;
		rows.push(
			{ label: "Reaction", value: r.reaction },
			{ label: "Product size", value: formatLen(r.productSize) },
			{ label: "GOI size", value: formatLen(r.goiSize) },
			{ label: "Left att site", value: r.leftAttSite },
			{ label: "Right att site", value: r.rightAttSite },
		);
	}

	// Missing overlaps for Gibson
	const missingOverlaps = method === "gibson" ? (result as GibsonResult).missingOverlaps : [];

	return (
		<div>
			<p style={S.prose}>Review the cloning result, then name and save your product.</p>
			<div style={{ marginBottom: "14px" }}>
				{rows.map((r) => <ResultRow key={r.label} label={r.label} value={r.value} />)}
			</div>

			{missingOverlaps.length > 0 && (
				<div style={{ ...S.warn, marginBottom: "14px" }}>
					<div style={{ marginBottom: "4px", fontWeight: 600 }}>⚠ Homology arms missing — add these primer tails:</div>
					{missingOverlaps.map((m, i) => (
						<div key={i} style={{ marginBottom: "2px" }}>
							{m.fragment} ({m.side}): <code style={{ background: "rgba(184,147,58,0.1)", padding: "0 3px" }}>{m.tail || "—"}</code>
						</div>
					))}
				</div>
			)}

			{/* For Gibson, overlap warnings are already shown above; only show non-overlap warnings */}
			<WarnList items={(result.warnings ?? []).filter((w) =>
				missingOverlaps.length === 0 || !w.startsWith("No ")
			)} />

			<div style={S.divider} />

			<label style={S.label}>Product name</label>
			<input type="text" value={productName} onChange={(e) => onProductNameChange(e.target.value)} placeholder="e.g. pCMV-GFP-insert" style={S.input} disabled={saving} />

			{saveError && <div style={{ ...S.err, marginTop: "10px" }}>{saveError}</div>}
		</div>
	);
}
