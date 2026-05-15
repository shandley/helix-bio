"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { saveDesignedConstruct } from "@/app/actions/sequences";
import type { ConstructDesign } from "@/lib/bio/assemble-construct";
import { assembleConstruct, validateDesign } from "@/lib/bio/assemble-construct";
import { serializeGenBank } from "@/lib/bio/serialize-genbank";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "input" | "designing" | "result" | "saving";

interface DesignResult {
  design: ConstructDesign;
  assembled: ReturnType<typeof assembleConstruct>;
  gbContent: string;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background: "rgba(28,26,22,0.55)",
    backdropFilter: "blur(2px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  dialog: {
    background: "#faf7f2",
    border: "1px solid #ddd8ce",
    borderRadius: "4px",
    width: "600px",
    maxWidth: "calc(100vw - 32px)",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 8px 32px rgba(28,26,22,0.18)",
    overflow: "hidden",
  },
  header: {
    padding: "18px 22px 14px",
    borderBottom: "1px solid #ddd8ce",
    flexShrink: 0,
  },
  body: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 22px",
  },
  footer: {
    padding: "12px 22px",
    borderTop: "1px solid #ddd8ce",
    display: "flex",
    gap: "10px",
    justifyContent: "flex-end",
    flexShrink: 0,
    background: "#f5f0e8",
  },
  label: {
    fontFamily: "var(--font-courier)",
    fontSize: "9px",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "#5a5648",
    marginBottom: "6px",
    display: "block",
  },
  textarea: {
    width: "100%",
    fontFamily: "var(--font-courier)",
    fontSize: "11px",
    color: "#1c1a16",
    background: "#f5f0e8",
    border: "1px solid #ddd8ce",
    borderRadius: "3px",
    padding: "8px 10px",
    resize: "vertical" as const,
    outline: "none",
    lineHeight: 1.5,
    boxSizing: "border-box" as const,
  },
  btn: {
    fontFamily: "var(--font-courier)",
    fontSize: "9px",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    border: "none",
    borderRadius: "2px",
    cursor: "pointer",
    padding: "7px 14px",
  },
};

// ── Part type colors ──────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  promoter: "#16a34a",
  rbs: "#0891b2",
  terminator: "#dc2626",
  ori: "#d97706",
  marker: "#7c3aed",
  cds: "#1d4ed8",
  CDS: "#1d4ed8",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: "4px", alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: "5px",
            height: "5px",
            borderRadius: "50%",
            background: "#9a9284",
            display: "inline-block",
            animation: `cdPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`@keyframes cdPulse{0%,80%,100%{opacity:0.3;transform:scale(0.8)}40%{opacity:1;transform:scale(1)}}`}</style>
    </span>
  );
}

function WarningBadge({
  severity,
  message,
}: {
  severity: "error" | "warning";
  message: string;
}) {
  const isError = severity === "error";
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        alignItems: "flex-start",
        padding: "6px 10px",
        background: isError ? "rgba(160,40,40,0.06)" : "rgba(184,147,58,0.07)",
        border: `1px solid ${isError ? "rgba(160,40,40,0.2)" : "rgba(184,147,58,0.25)"}`,
        borderRadius: "3px",
        marginBottom: "6px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-courier)",
          fontSize: "10px",
          color: isError ? "#a02828" : "#b8933a",
          flexShrink: 0,
        }}
      >
        {isError ? "✗" : "⚠"}
      </span>
      <span
        style={{
          fontFamily: "var(--font-karla)",
          fontSize: "12px",
          color: "#1c1a16",
          lineHeight: 1.5,
        }}
      >
        {message}
      </span>
    </div>
  );
}

function PartsTable({ result }: { result: DesignResult }) {
  const { design, assembled } = result;
  return (
    <div style={{ marginBottom: "16px" }}>
      <div
        style={{
          fontFamily: "var(--font-courier)",
          fontSize: "8px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#9a9284",
          marginBottom: "8px",
        }}
      >
        Parts — {assembled.seq.length.toLocaleString()} bp total
      </div>
      {design.parts.map(({ partId, direction }, i) => {
        const ann = assembled.annotations[i];
        if (!ann) return null;
        const len = ann.end - ann.start;
        const typeColor = TYPE_COLOR[ann.type] ?? "#9a9284";
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "5px 0",
              borderBottom: "1px solid rgba(221,216,206,0.4)",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: typeColor,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-karla)",
                fontSize: "13px",
                color: "#1c1a16",
                flex: 1,
              }}
            >
              {ann.name}
            </span>
            <span
              style={{
                fontFamily: "var(--font-courier)",
                fontSize: "8px",
                color: "#9a9284",
                textTransform: "uppercase",
              }}
            >
              {ann.type}
            </span>
            <span
              style={{
                fontFamily: "var(--font-courier)",
                fontSize: "8px",
                color: "#9a9284",
              }}
            >
              {direction === -1 ? "←" : "→"} {len} bp
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface ConstructDesignerModalProps {
  onClose: () => void;
}

export function ConstructDesignerModal({ onClose }: ConstructDesignerModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [insertSeq, setInsertSeq] = useState("");
  const [insertName, setInsertName] = useState("");
  const [goal, setGoal] = useState("");
  const [showInsert, setShowInsert] = useState(false);
  const [result, setResult] = useState<DesignResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runDesign = useCallback(async () => {
    if (!goal.trim()) {
      setError("Describe your expression goal.");
      return;
    }
    const seq = insertSeq.replace(/\s/g, "").toUpperCase();
    // Mode A: insert provided — validate it
    if (showInsert && seq.length > 0 && seq.length < 9) {
      setError("Insert sequence is too short (minimum 9 bp). Clear it to let Ori pick a CDS from its library.");
      return;
    }

    setError(null);
    setStep("designing");
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/design-construct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insertSeq: showInsert ? seq : "",
          insertName: insertName.trim() || "MyGene",
          goal,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Design failed (${res.status}): ${body.slice(0, 120)}`);
      }

      const design = (await res.json()) as ConstructDesign;
      const hasUserInsert = design.parts.some((p) => p.partId === "INSERT");
      const insertInfo = hasUserInsert
        ? { name: insertName.trim() || "MyGene", seq }
        : undefined;
      const assembled = assembleConstruct(design, insertInfo);

      const gcCount = assembled.seq.split("").filter((c) => c === "G" || c === "C").length;
      const gc = assembled.seq.length > 0 ? (gcCount / assembled.seq.length) * 100 : 0;

      const gbContent = serializeGenBank({
        name: design.constructName,
        seq: assembled.seq,
        topology: "circular",
        description: goal,
        annotations: assembled.annotations,
        autoAnnotations: [],
      });

      setResult({ design, assembled, gbContent });
      setStep("result");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
      setStep("input");
    }
  }, [insertSeq, insertName, goal]);

  const handleSave = useCallback(async () => {
    if (!result) return;
    setStep("saving");

    const gcCount = result.assembled.seq.split("").filter((c) => c === "G" || c === "C").length;
    const gc = result.assembled.seq.length > 0 ? (gcCount / result.assembled.seq.length) * 100 : 0;

    const { id, error: saveErr } = await saveDesignedConstruct(
      result.gbContent,
      result.design.constructName,
      result.assembled.seq.length,
      gc,
    );

    if (saveErr || !id) {
      setError(saveErr ?? "Save failed");
      setStep("result");
      return;
    }

    router.push(`/sequence/${id}`);
    onClose();
  }, [result, router, onClose]);

  const allWarnings = result
    ? [...result.assembled.warnings, ...result.design.warnings.map((w) => ({ severity: "warning" as const, message: w }))]
    : [];
  const hasErrors = allWarnings.some((w) => w.severity === "error");

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.dialog} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={S.header}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span
              style={{
                fontFamily: "var(--font-playfair)",
                fontSize: "18px",
                color: "#1c1a16",
                letterSpacing: "-0.01em",
              }}
            >
              Design Construct
            </span>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "18px",
                color: "#9a9284",
                lineHeight: 1,
                padding: "0 2px",
              }}
            >
              ×
            </button>
          </div>
          <p
            style={{
              fontFamily: "var(--font-courier)",
              fontSize: "9px",
              color: "#9a9284",
              letterSpacing: "0.04em",
              margin: "5px 0 0",
            }}
          >
            Describe what you want to build — Ori designs and assembles the plasmid.
          </p>
        </div>

        {/* Body */}
        <div style={S.body}>
          {(step === "input" || step === "designing") && (
            <>
              {/* Goal — primary input, always visible */}
              <div style={{ marginBottom: "14px" }}>
                <label style={S.label}>What do you want to build?</label>
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder={"e.g. \"Express GFP in E. coli with IPTG induction\"\nor \"CRISPR construct for mammalian delivery via AAV\"\nor \"Luciferase reporter for promoter activity assay\""}
                  rows={3}
                  style={S.textarea}
                />
                <div style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#9a9284", marginTop: "4px" }}>
                  Leave the insert blank to let Ori select a gene from its library, or expand below to paste your own.
                </div>
              </div>

              {/* Optional insert — collapsible */}
              <div style={{ marginBottom: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowInsert((v) => !v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    background: "none",
                    border: "1px solid #ddd8ce",
                    borderRadius: "2px",
                    cursor: "pointer",
                    padding: "5px 10px",
                    fontFamily: "var(--font-courier)",
                    fontSize: "8px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase" as const,
                    color: showInsert ? "#1a4731" : "#9a9284",
                    marginBottom: showInsert ? "10px" : 0,
                  }}
                >
                  <span style={{ transition: "transform 0.15s", display: "inline-block", transform: showInsert ? "rotate(90deg)" : "rotate(0)" }}>▶</span>
                  I have my own gene sequence
                </button>

                {showInsert && (
                  <>
                    <div style={{ marginBottom: "10px" }}>
                      <label style={S.label}>Gene name</label>
                      <input
                        type="text"
                        value={insertName}
                        onChange={(e) => setInsertName(e.target.value)}
                        placeholder="e.g. mCherry, MyProtein"
                        style={{ ...S.textarea, resize: "none" as const, height: "36px", padding: "7px 10px" }}
                      />
                    </div>
                    <div>
                      <label style={S.label}>
                        Gene sequence{" "}
                        <span style={{ color: "#b8b0a4", fontWeight: 400 }}>(FASTA or raw DNA)</span>
                      </label>
                      <textarea
                        value={insertSeq}
                        onChange={(e) => setInsertSeq(e.target.value)}
                        placeholder={">MyGene\nATGAGTATTCAACATTTCCGTGTCGCC..."}
                        rows={5}
                        style={S.textarea}
                      />
                      {insertSeq.replace(/\s|>/g, "").length > 0 && (
                        <div style={{ fontFamily: "var(--font-courier)", fontSize: "9px", color: "#9a9284", marginTop: "4px" }}>
                          {insertSeq.replace(/>[^\n]*\n?/g, "").replace(/\s/g, "").length.toLocaleString()} bp
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {error && (
                <div
                  style={{
                    fontFamily: "var(--font-courier)",
                    fontSize: "9px",
                    color: "#a02828",
                    padding: "6px 10px",
                    background: "rgba(160,40,40,0.06)",
                    border: "1px solid rgba(160,40,40,0.2)",
                    borderRadius: "3px",
                  }}
                >
                  {error}
                </div>
              )}
            </>
          )}

          {step === "designing" && (
            <div
              style={{
                padding: "24px 0 8px",
                fontFamily: "var(--font-karla)",
                fontSize: "13px",
                color: "#5a5648",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <TypingDots />
              Claude is selecting parts and assembling your construct…
            </div>
          )}

          {step === "result" && result && (
            <>
              {/* Explanation */}
              <div
                style={{
                  fontFamily: "var(--font-karla)",
                  fontSize: "13px",
                  color: "#1c1a16",
                  lineHeight: 1.65,
                  marginBottom: "16px",
                  padding: "10px 12px",
                  background: "rgba(26,71,49,0.04)",
                  border: "1px solid rgba(26,71,49,0.15)",
                  borderRadius: "3px",
                }}
              >
                {result.design.explanation}
              </div>

              {/* Parts table */}
              <PartsTable result={result} />

              {/* Warnings */}
              {allWarnings.length > 0 && (
                <div style={{ marginBottom: "8px" }}>
                  {allWarnings.map((w, i) => (
                    <WarningBadge key={i} severity={w.severity} message={w.message} />
                  ))}
                </div>
              )}

              {error && (
                <div
                  style={{
                    fontFamily: "var(--font-courier)",
                    fontSize: "9px",
                    color: "#a02828",
                    padding: "6px 10px",
                    background: "rgba(160,40,40,0.06)",
                    border: "1px solid rgba(160,40,40,0.2)",
                    borderRadius: "3px",
                    marginTop: "8px",
                  }}
                >
                  {error}
                </div>
              )}
            </>
          )}

          {step === "saving" && (
            <div
              style={{
                padding: "24px 0",
                fontFamily: "var(--font-karla)",
                fontSize: "13px",
                color: "#5a5648",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <TypingDots />
              Saving construct to your library…
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          {step === "input" && (
            <>
              <button type="button" onClick={onClose} style={{ ...S.btn, background: "none", border: "1px solid #ddd8ce", color: "#5a5648" }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runDesign()}
                style={{ ...S.btn, background: "#1a4731", color: "white" }}
              >
                Design Construct
              </button>
            </>
          )}

          {step === "designing" && (
            <button
              type="button"
              onClick={() => { abortRef.current?.abort(); setStep("input"); }}
              style={{ ...S.btn, background: "none", border: "1px solid #ddd8ce", color: "#5a5648" }}
            >
              Cancel
            </button>
          )}

          {step === "result" && (
            <>
              <button
                type="button"
                onClick={() => { setStep("input"); setResult(null); setError(null); }}
                style={{ ...S.btn, background: "none", border: "1px solid #ddd8ce", color: "#5a5648" }}
              >
                ← Redesign
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={hasErrors}
                title={hasErrors ? "Fix errors before saving" : "Save construct to your library"}
                style={{
                  ...S.btn,
                  background: hasErrors ? "#c8c0b4" : "#1a4731",
                  color: "white",
                  cursor: hasErrors ? "not-allowed" : "pointer",
                }}
              >
                Save to Library →
              </button>
            </>
          )}

          {step === "saving" && (
            <button type="button" disabled style={{ ...S.btn, background: "#c8c0b4", color: "white" }}>
              Saving…
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
