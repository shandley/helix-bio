"use client";

import { useState } from "react";
import { AmpliconHeatmap } from "./amplicon-heatmap";
import { MeltCurve } from "./melt-curve";
import { PairScatter } from "./pair-scatter";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PrimerPlotsData {
  pairs: {
    fwd: { start: number; end: number; len: number; tm: number };
    rev: { start: number; end: number; len: number; tm: number };
    productSize: number;
    tmDiff: number;
    efficiencyScore?: number;
    ampliconTm?: number;
    ampliconDG?: number;
  }[];
  seq: string;
  mode: "pcr" | "qpcr";
  tmTarget: number;
}

interface PrimerPlotsDrawerProps {
  data: PrimerPlotsData;
  onClose: () => void;
}

type Tab = "scatter" | "melt" | "amplicon";

// ── Component ─────────────────────────────────────────────────────────────────

export function PrimerPlotsDrawer({ data, onClose }: PrimerPlotsDrawerProps) {
  const { pairs, seq, mode, tmTarget } = data;
  const hasQPCRData = mode === "qpcr" && pairs.some((p) => p.ampliconTm !== undefined);

  const tabs: { id: Tab; label: string }[] = [
    { id: "scatter", label: "Pair Overview" },
    ...(hasQPCRData ? [{ id: "melt" as Tab, label: "Melt Curve" }] : []),
    { id: "amplicon", label: "Amplicon Structure" },
  ];

  const [activeTab, setActiveTab] = useState<Tab>(hasQPCRData ? "melt" : "scatter");
  const [highlightIdx, setHighlightIdx] = useState(0);

  const bestPair = pairs[highlightIdx] ?? pairs[0];

  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: "2px solid #c8c0b8",
        background: "#faf7f2",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "5px 14px",
          borderBottom: "1px solid #ddd8ce",
          flexShrink: 0,
          background: "#f5f0e8",
          gap: "0",
        }}
      >
        {/* Tabs */}
        <div style={{ display: "flex", gap: "0", flex: 1 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                fontFamily: "var(--font-courier)",
                fontSize: "8px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                background: "none",
                border: "none",
                borderBottom: activeTab === tab.id ? "2px solid #1a4731" : "2px solid transparent",
                color: activeTab === tab.id ? "#1a4731" : "#9a9284",
                cursor: "pointer",
                padding: "5px 12px",
                marginBottom: "-1px",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Pair selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginRight: "12px" }}>
          <span
            style={{ fontFamily: "var(--font-courier)", fontSize: "8px", color: "#9a9284" }}
          >
            Showing pair
          </span>
          <select
            value={highlightIdx}
            onChange={(e) => setHighlightIdx(Number(e.target.value))}
            style={{
              fontFamily: "var(--font-courier)",
              fontSize: "8px",
              background: "#f5f0e8",
              border: "1px solid #ddd8ce",
              borderRadius: "2px",
              padding: "2px 4px",
              color: "#1c1a16",
            }}
          >
            {pairs.map((_, i) => (
              <option key={i} value={i}>
                #{i + 1}{i === 0 ? " (best)" : ""}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            fontFamily: "var(--font-courier)",
            fontSize: "14px",
            lineHeight: 1,
            color: "#9a9284",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0 2px",
          }}
          aria-label="Close plots"
        >
          ×
        </button>
      </div>

      {/* Plot area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "auto",
          padding: "14px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: "8px",
        }}
      >
        {activeTab === "melt" && (
          <>
            <div
              style={{
                fontFamily: "var(--font-courier)",
                fontSize: "8px",
                color: "#9a9284",
                letterSpacing: "0.06em",
                marginBottom: "2px",
              }}
            >
              Simulated melt curve · −dF/dT vs temperature · best pair highlighted
            </div>
            <MeltCurve pairs={pairs} seq={seq} highlightIndex={highlightIdx} />
            <div
              style={{
                fontFamily: "var(--font-karla)",
                fontSize: "11px",
                color: "#7a7060",
                maxWidth: "380px",
                lineHeight: 1.5,
                marginTop: "4px",
              }}
            >
              A sharp, symmetric peak indicates a single specific amplicon. Broad or asymmetric
              peaks suggest secondary structure or non-specific products. Simulated from amplicon Tm
              and GC content.
            </div>
          </>
        )}

        {activeTab === "amplicon" && bestPair && (
          <>
            <div
              style={{
                fontFamily: "var(--font-courier)",
                fontSize: "8px",
                color: "#9a9284",
                letterSpacing: "0.06em",
                marginBottom: "2px",
              }}
            >
              Amplicon secondary structure · accessibility at {tmTarget}°C
            </div>
            <AmpliconHeatmap pair={bestPair} seq={seq} temperature={tmTarget} />
            <div
              style={{
                fontFamily: "var(--font-karla)",
                fontSize: "11px",
                color: "#7a7060",
                maxWidth: "380px",
                lineHeight: 1.5,
                marginTop: "4px",
              }}
            >
              <span style={{ color: "#1a4731", fontWeight: 600 }}>Green</span> = open (accessible
              at annealing temp). <span style={{ color: "#b8933a", fontWeight: 600 }}>Amber</span>{" "}
              = partially structured.{" "}
              <span style={{ color: "#a02828", fontWeight: 600 }}>Red</span> = structured — may
              reduce polymerase extension efficiency. Primer positions shown as brackets.
            </div>
          </>
        )}

        {activeTab === "scatter" && (
          <>
            <div
              style={{
                fontFamily: "var(--font-courier)",
                fontSize: "8px",
                color: "#9a9284",
                letterSpacing: "0.06em",
                marginBottom: "2px",
              }}
            >
              {mode === "qpcr"
                ? "All pairs · amplicon Tm vs efficiency · hover for details"
                : "All pairs · product size vs Tm match · hover for details"}
            </div>
            <PairScatter pairs={pairs} mode={mode} />
            <div
              style={{
                fontFamily: "var(--font-karla)",
                fontSize: "11px",
                color: "#7a7060",
                maxWidth: "380px",
                lineHeight: 1.5,
                marginTop: "4px",
              }}
            >
              {mode === "qpcr"
                ? "Top-right = optimal: high amplification efficiency and Tm in the ideal SYBR Green range (80–90°C). Green = ≥80% efficiency. Hover a circle to identify the pair."
                : "Right = larger amplicon (for gel verification). Top = well-matched primer Tms (better for uniform annealing). Green = good Tm match. Hover to inspect."}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
