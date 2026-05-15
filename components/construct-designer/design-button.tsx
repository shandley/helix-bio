"use client";

import { useState } from "react";
import { ConstructDesignerModal } from "./construct-designer-modal";

export function DesignButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          fontFamily: "var(--font-courier)",
          fontSize: "9px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          background: "#2d4a7a",
          color: "white",
          border: "none",
          borderRadius: "2px",
          cursor: "pointer",
          padding: "6px 12px",
        }}
      >
        + Design
      </button>
      {open && <ConstructDesignerModal onClose={() => setOpen(false)} />}
    </>
  );
}
