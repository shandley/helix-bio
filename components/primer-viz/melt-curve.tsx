"use client";

import { useEffect, useRef } from "react";
import type { PrimerPair } from "@shandley/primd";
import { calcGC } from "@shandley/primd";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DesignPairMin {
  fwd: { start: number; end: number };
  rev: { start: number; end: number };
  productSize: number;
  ampliconTm?: number;
}

interface MeltCurveProps {
  pairs: DesignPairMin[];
  seq: string;
  /** Highlight this pair index (0-based rank) */
  highlightIndex?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const W = 380;
const H = 180;
const MARGIN = { top: 16, right: 16, bottom: 36, left: 44 };
const PLOT_W = W - MARGIN.left - MARGIN.right;
const PLOT_H = H - MARGIN.top - MARGIN.bottom;

const PAIR_COLORS = ["#1a4731", "#0891b2", "#b45309", "#7c3aed", "#be185d"];

// ── Melt curve math ───────────────────────────────────────────────────────────

/** Fraction of ssDNA (denatured) at temperature T using logistic approximation. */
function alphaDenatured(T: number, Tm: number, k: number): number {
  return 1 / (1 + Math.exp(-k * (T - Tm)));
}

/**
 * -dF/dT: the derivative of fraction hybridized w.r.t. temperature.
 * This is what real qPCR melt curve instruments display — a peak at Tm.
 * α'(T) = k × α(T) × (1 − α(T)), so -dF/dT = k × α × (1 − α).
 */
function meltDerivative(T: number, Tm: number, k: number): number {
  const a = alphaDenatured(T, Tm, k);
  return k * a * (1 - a);
}

/**
 * Estimate steepness from amplicon properties.
 * Higher GC content and longer amplicons → sharper (more cooperative) melt.
 */
function steepness(amplicon: string): number {
  const gc = calcGC(amplicon);
  const len = amplicon.length;
  return 0.12 + gc * 0.25 + Math.min(len, 250) * 0.0008;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MeltCurve({ pairs, seq, highlightIndex = 0 }: MeltCurveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Filter pairs that have an amplicon Tm
  const validPairs = pairs.filter((p) => p.ampliconTm !== undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || validPairs.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#faf7f2";
    ctx.fillRect(0, 0, W, H);

    // Determine temperature range from all valid Tms
    const tms = validPairs.map((p) => p.ampliconTm!);
    const tmMid = tms[highlightIndex] ?? tms[0]!;
    const tMin = Math.min(...tms) - 18;
    const tMax = Math.max(...tms) + 18;

    const xScale = (T: number) => MARGIN.left + ((T - tMin) / (tMax - tMin)) * PLOT_W;
    const yScale = (v: number) => MARGIN.top + PLOT_H - v * PLOT_H;

    // Compute curves and find max derivative for normalisation
    const curves = validPairs.map((pair, idx) => {
      const ampliconSeq = seq.slice(pair.fwd.start, pair.rev.end).toUpperCase();
      const k = steepness(ampliconSeq || "A".repeat(pair.productSize));
      const Tm = pair.ampliconTm!;
      const Ts: number[] = [];
      const Ys: number[] = [];
      for (let T = tMin; T <= tMax; T += 0.5) {
        Ts.push(T);
        Ys.push(meltDerivative(T, Tm, k));
      }
      return { Ts, Ys, Tm, idx };
    });

    const globalMax = Math.max(...curves.flatMap((c) => c.Ys));
    if (globalMax === 0) return;

    // Grid lines
    ctx.strokeStyle = "rgba(200,192,184,0.35)";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    for (let t = Math.ceil(tMin / 5) * 5; t <= tMax; t += 5) {
      ctx.beginPath();
      ctx.moveTo(xScale(t), MARGIN.top);
      ctx.lineTo(xScale(t), MARGIN.top + PLOT_H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw non-highlighted curves first (thinner, dimmer)
    for (const { Ts, Ys, idx } of curves) {
      if (idx === highlightIndex) continue;
      const color = PAIR_COLORS[idx % PAIR_COLORS.length] ?? "#9a9284";
      ctx.beginPath();
      ctx.strokeStyle = color + "55"; // translucent
      ctx.lineWidth = 1.2;
      ctx.lineJoin = "round";
      for (let i = 0; i < Ts.length; i++) {
        const x = xScale(Ts[i]!);
        const y = yScale(Ys[i]! / globalMax);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Draw highlighted curve (thicker, full opacity)
    const highlighted = curves[highlightIndex] ?? curves[0];
    if (highlighted) {
      const color = PAIR_COLORS[highlighted.idx % PAIR_COLORS.length] ?? "#1a4731";
      // Fill under the curve
      ctx.beginPath();
      for (let i = 0; i < highlighted.Ts.length; i++) {
        const x = xScale(highlighted.Ts[i]!);
        const y = yScale(highlighted.Ys[i]! / globalMax);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.lineTo(xScale(highlighted.Ts[highlighted.Ts.length - 1]!), MARGIN.top + PLOT_H);
      ctx.lineTo(xScale(highlighted.Ts[0]!), MARGIN.top + PLOT_H);
      ctx.closePath();
      ctx.fillStyle = color + "18";
      ctx.fill();

      // Stroke
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      for (let i = 0; i < highlighted.Ts.length; i++) {
        const x = xScale(highlighted.Ts[i]!);
        const y = yScale(highlighted.Ys[i]! / globalMax);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Tm vertical line
      const tmX = xScale(highlighted.Tm);
      ctx.beginPath();
      ctx.strokeStyle = color + "88";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.moveTo(tmX, MARGIN.top);
      ctx.lineTo(tmX, MARGIN.top + PLOT_H);
      ctx.stroke();
      ctx.setLineDash([]);

      // Tm label
      ctx.fillStyle = color;
      ctx.font = `bold 8.5px "Courier Prime", monospace`;
      ctx.textAlign = "center";
      ctx.fillText(`${highlighted.Tm.toFixed(1)}°C`, tmX, MARGIN.top - 3);
    }

    // X axis
    ctx.strokeStyle = "rgba(200,192,184,0.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, MARGIN.top + PLOT_H);
    ctx.lineTo(MARGIN.left + PLOT_W, MARGIN.top + PLOT_H);
    ctx.stroke();

    // X axis labels
    ctx.fillStyle = "#9a9284";
    ctx.font = `8px "Courier Prime", monospace`;
    ctx.textAlign = "center";
    for (let t = Math.ceil(tMin / 5) * 5; t <= tMax; t += 5) {
      ctx.fillText(`${t}°`, xScale(t), MARGIN.top + PLOT_H + 12);
    }

    // Y axis label
    ctx.save();
    ctx.translate(11, MARGIN.top + PLOT_H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillStyle = "#9a9284";
    ctx.font = `8px "Courier Prime", monospace`;
    ctx.fillText("–dF/dT", 0, 0);
    ctx.restore();

    // X axis title
    ctx.fillStyle = "#9a9284";
    ctx.font = `8px "Courier Prime", monospace`;
    ctx.textAlign = "center";
    ctx.fillText("Temperature (°C)", MARGIN.left + PLOT_W / 2, H - 4);
  }, [pairs, seq, highlightIndex, validPairs]);

  if (validPairs.length === 0) {
    return (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-courier)",
          fontSize: "9px",
          color: "#9a9284",
          background: "#faf7f2",
        }}
      >
        Amplicon Tm not available — run qPCR design to generate melt curves.
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ display: "block" }} />;
}
