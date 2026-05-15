"use client";

import { useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DesignPairMin {
  fwd: { tm: number };
  rev: { tm: number };
  productSize: number;
  tmDiff: number;
  efficiencyScore?: number;
  ampliconTm?: number;
}

interface PairScatterProps {
  pairs: DesignPairMin[];
  mode: "pcr" | "qpcr";
}

// ── Canvas constants ──────────────────────────────────────────────────────────

const W = 380;
const H = 200;
const MARGIN = { top: 14, right: 20, bottom: 38, left: 48 };
const PLOT_W = W - MARGIN.left - MARGIN.right;
const PLOT_H = H - MARGIN.top - MARGIN.bottom;
const R = 5; // circle radius

// ── Color helpers ─────────────────────────────────────────────────────────────

function qualityColor(v: number): string {
  // v in [0,1]: 0=worst, 1=best
  if (v >= 0.8) return "#1a4731";
  if (v >= 0.6) return "#b8933a";
  return "#a02828";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PairScatter({ pairs, mode }: PairScatterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  // Axis data depends on mode
  function getAxes(pair: DesignPairMin, rank: number) {
    if (mode === "qpcr") {
      const x = pair.ampliconTm ?? (pair.fwd.tm + pair.rev.tm) / 2;
      const y = pair.efficiencyScore ?? 0;
      const quality = pair.efficiencyScore ?? 0;
      return { x, y, quality };
    }
    // PCR: productSize vs ΔTm (lower ΔTm = better)
    const x = pair.productSize;
    const y = Math.max(0, 1 - pair.tmDiff / 8); // normalize ΔTm [0,8°] → [1,0]
    const quality = y;
    return { x, y, quality };
  }

  const points = pairs.map((p, i) => ({ ...getAxes(p, i), pair: p, rank: i + 1 }));

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = 0;
  const yMax = 1;
  const xPad = (xMax - xMin) * 0.15 || 5;

  const xScale = (v: number) =>
    MARGIN.left + ((v - (xMin - xPad)) / (xMax - xMin + 2 * xPad)) * PLOT_W;
  const yScale = (v: number) =>
    MARGIN.top + PLOT_H - ((v - yMin) / (yMax - yMin)) * PLOT_H;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || pairs.length === 0) return;
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

    // Grid
    ctx.strokeStyle = "rgba(200,192,184,0.35)";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    const yGridSteps = [0.2, 0.4, 0.6, 0.8, 1.0];
    for (const v of yGridSteps) {
      const y = yScale(v);
      ctx.beginPath();
      ctx.moveTo(MARGIN.left, y);
      ctx.lineTo(MARGIN.left + PLOT_W, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw all circles (non-hovered first)
    for (const pt of [...points].reverse()) {
      if (pt.rank - 1 === hovered) continue;
      const x = xScale(pt.x);
      const y = yScale(pt.y);
      const color = qualityColor(pt.quality);
      ctx.beginPath();
      ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fillStyle = color + (pt.rank === 1 ? "ff" : "88");
      ctx.fill();
      if (pt.rank === 1) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Hovered circle (on top, with label)
    if (hovered !== null && points[hovered]) {
      const pt = points[hovered]!;
      const x = xScale(pt.x);
      const y = yScale(pt.y);
      const color = qualityColor(pt.quality);
      ctx.beginPath();
      ctx.arc(x, y, R + 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#faf7f2";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Tooltip
      const label =
        mode === "qpcr"
          ? `#${pt.rank} · amp ${pt.x.toFixed(1)}°C · eff ${(pt.quality * 100).toFixed(0)}%`
          : `#${pt.rank} · ${points[hovered]!.pair.productSize} bp · ΔTm ${points[hovered]!.pair.tmDiff.toFixed(1)}°`;

      ctx.font = `bold 8.5px "Courier Prime", monospace`;
      const tw = ctx.measureText(label).width + 10;
      const tx = Math.min(Math.max(x - tw / 2, MARGIN.left), MARGIN.left + PLOT_W - tw);
      const ty = y - 14;

      ctx.fillStyle = "rgba(245,240,232,0.95)";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tx, ty - 11, tw, 14, 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.textAlign = "left";
      ctx.fillText(label, tx + 5, ty - 1);
    }

    // Axes
    ctx.strokeStyle = "rgba(200,192,184,0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, MARGIN.top);
    ctx.lineTo(MARGIN.left, MARGIN.top + PLOT_H);
    ctx.lineTo(MARGIN.left + PLOT_W, MARGIN.top + PLOT_H);
    ctx.stroke();

    // X axis labels
    ctx.fillStyle = "#9a9284";
    ctx.font = `7.5px "Courier Prime", monospace`;
    ctx.textAlign = "center";
    const xTicks = mode === "qpcr" ? 5 : 4;
    for (let i = 0; i <= xTicks; i++) {
      const v = xMin - xPad + (i / xTicks) * (xMax - xMin + 2 * xPad);
      ctx.fillText(mode === "qpcr" ? `${v.toFixed(0)}°` : `${v.toFixed(0)}`, xScale(v), MARGIN.top + PLOT_H + 11);
    }

    // Y axis labels
    ctx.textAlign = "right";
    for (const v of yGridSteps) {
      ctx.fillText(`${(v * 100).toFixed(0)}%`, MARGIN.left - 4, yScale(v) + 3);
    }

    // Axis titles
    ctx.textAlign = "center";
    const xTitle = mode === "qpcr" ? "Amplicon Tm (°C)" : "Product size (bp)";
    const yTitle = mode === "qpcr" ? "Efficiency" : "Tm match";
    ctx.fillText(xTitle, MARGIN.left + PLOT_W / 2, H - 4);

    ctx.save();
    ctx.translate(10, MARGIN.top + PLOT_H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yTitle, 0, 0);
    ctx.restore();

    // "Best" annotation on rank 1
    if (points[0]) {
      const pt = points[0];
      ctx.fillStyle = qualityColor(pt.quality);
      ctx.font = `7px "Courier Prime", monospace`;
      ctx.textAlign = "center";
      ctx.fillText("#1", xScale(pt.x), yScale(pt.y) - R - 3);
    }
  }, [pairs, mode, hovered, points, xMin, xMax, xPad]);

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let closest: number | null = null;
    let minDist = 14;
    for (let i = 0; i < points.length; i++) {
      const dx = xScale(points[i]!.x) - mx;
      const dy = yScale(points[i]!.y) - my;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minDist) {
        minDist = d;
        closest = i;
      }
    }
    setHovered(closest);
  }

  if (pairs.length === 0) {
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
        No primer pairs to display.
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", cursor: hovered !== null ? "pointer" : "default" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHovered(null)}
    />
  );
}
