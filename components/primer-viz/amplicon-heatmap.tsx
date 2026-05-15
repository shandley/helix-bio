"use client";

import { useEffect, useRef } from "react";
import { calcAccessibilityProfile } from "@shandley/primd";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PairMin {
  fwd: { start: number; end: number; len: number };
  rev: { start: number; end: number; len: number };
  productSize: number;
}

interface AmpliconHeatmapProps {
  pair: PairMin;
  seq: string;
  /** Annealing temperature for accessibility calculation. */
  temperature?: number;
}

// ── Canvas constants ──────────────────────────────────────────────────────────

const W = 380;
const BAR_H = 18;
const LABEL_H = 22;
const H = BAR_H + LABEL_H + 32; // bar + label + primers
const MARGIN_X = 12;

// ── Color helpers ─────────────────────────────────────────────────────────────

/** Map accessibility [0,1] to a CSS color: red (structured) → green (open). */
function accessColor(v: number): string {
  if (v >= 0.75) return `rgba(26,71,49,${0.3 + v * 0.5})`; // green
  if (v >= 0.4) return `rgba(184,147,58,${0.4 + v * 0.4})`; // amber
  return `rgba(160,40,40,${0.5 + (1 - v) * 0.4})`; // red
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AmpliconHeatmap({ pair, seq, temperature = 55 }: AmpliconHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#faf7f2";
    ctx.fillRect(0, 0, W, H);

    // Extract amplicon sequence
    const ampStart = pair.fwd.start;
    const ampEnd = pair.rev.end;
    if (ampEnd <= ampStart || ampEnd > seq.length) return;
    const ampliconSeq = seq.slice(ampStart, ampEnd).toUpperCase();

    // Compute accessibility profile
    let profile: number[];
    try {
      profile = Array.from(calcAccessibilityProfile(ampliconSeq, temperature));
    } catch {
      return;
    }

    const barW = W - MARGIN_X * 2;
    const pxPerBase = barW / ampliconSeq.length;

    // Draw per-base colored blocks
    for (let i = 0; i < profile.length; i++) {
      const x = MARGIN_X + i * pxPerBase;
      ctx.fillStyle = accessColor(profile[i] ?? 0);
      ctx.fillRect(x, 6, Math.max(1, pxPerBase - 0.3), BAR_H);
    }

    // Primer brackets — fwd (left end) and rev (right end)
    const fwdLen = pair.fwd.len;
    const revLen = pair.rev.len;
    const fwdEndPx = MARGIN_X + fwdLen * pxPerBase;
    const revStartPx = MARGIN_X + (ampliconSeq.length - revLen) * pxPerBase;

    // Forward primer bracket (left)
    ctx.strokeStyle = "rgba(26,71,49,0.7)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X, 6);
    ctx.lineTo(MARGIN_X, 6 + BAR_H + 4);
    ctx.lineTo(fwdEndPx, 6 + BAR_H + 4);
    ctx.stroke();

    // Reverse primer bracket (right)
    ctx.beginPath();
    ctx.moveTo(W - MARGIN_X, 6);
    ctx.lineTo(W - MARGIN_X, 6 + BAR_H + 4);
    ctx.lineTo(revStartPx, 6 + BAR_H + 4);
    ctx.stroke();

    // Primer labels
    ctx.fillStyle = "rgba(26,71,49,0.8)";
    ctx.font = `7.5px "Courier Prime", monospace`;
    ctx.textAlign = "left";
    ctx.fillText(`→ ${fwdLen} bp`, MARGIN_X, 6 + BAR_H + 16);
    ctx.textAlign = "right";
    ctx.fillText(`${revLen} bp ←`, W - MARGIN_X, 6 + BAR_H + 16);

    // Amplicon size center label
    ctx.textAlign = "center";
    ctx.fillStyle = "#9a9284";
    ctx.fillText(`${ampliconSeq.length} bp amplicon`, W / 2, 6 + BAR_H + 16);

    // Position scale (start/end)
    ctx.fillStyle = "#b8b0a4";
    ctx.font = `7px "Courier Prime", monospace`;
    ctx.textAlign = "left";
    ctx.fillText(`${ampStart + 1}`, MARGIN_X, 5);
    ctx.textAlign = "right";
    ctx.fillText(`${ampEnd}`, W - MARGIN_X, 5);

    // Legend hint
    ctx.font = `7px "Courier Prime", monospace`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#b8b0a4";
    ctx.fillText(`Accessibility at ${temperature}°C`, W / 2, 5);
  }, [pair, seq, temperature]);

  return <canvas ref={canvasRef} style={{ display: "block" }} />;
}
