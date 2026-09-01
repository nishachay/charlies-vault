"use client";

import { useState } from "react";
import { Flag } from "lucide-react";

interface ReportButtonProps {
  songId: string;
  versionId?: string | null;
}

export default function ReportButton({ songId, versionId }: ReportButtonProps) {
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");

  async function report() {
    setState("idle");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId, versionId: versionId ?? undefined }),
      });
      if (res.ok) setState("sent");
      else setState("error");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <span className="text-sm text-gold">Thanks — flagged for review.</span>
    );
  }

  return (
    <button
      type="button"
      onClick={report}
      className="inline-flex items-center gap-1.5 text-sm text-mut transition hover:text-rose"
    >
      {state === "error" ? "Try again · " : null}
      <Flag size={13} /> Report broken link
    </button>
  );
}