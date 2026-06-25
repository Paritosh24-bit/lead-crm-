import React from "react";
import logoSrc from "../assets/sync-ai-logo.png";

interface SyncAILogoProps {
  className?: string;
  variant?: "light" | "original";
  height?: number | string;
}

// Renders the official SyncAI Consultancy Pvt. Ltd. logo artwork everywhere
// in the app. The logo's text is dark navy/teal, so when it's placed on a
// dark surface (variant="light", e.g. the app header) we wrap it in a small
// light pill so it stays legible without altering the artwork itself.
export default function SyncAILogo({ className = "", variant = "original", height = 48 }: SyncAILogoProps) {
  const onDarkSurface = variant === "light";

  const img = (
    <img
      src={logoSrc}
      alt="SyncAI Consultancy Pvt. Ltd. Logo"
      className={onDarkSurface ? "" : className}
      style={{ height, width: "auto", display: "block" }}
    />
  );

  if (!onDarkSurface) {
    return img;
  }

  return (
    <span
      className={`inline-flex items-center rounded-lg bg-white/95 shadow-sm ${className}`}
      style={{ padding: "4px 10px" }}
    >
      {img}
    </span>
  );
}
