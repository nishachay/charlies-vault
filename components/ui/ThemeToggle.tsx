"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

function applyTheme(theme: "dark" | "light") {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("outtake_theme", theme);
  } catch {
    /* noop */
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved =
      (typeof localStorage !== "undefined" && localStorage.getItem("outtake_theme")) ||
      (window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark");
    setTheme(saved as "dark" | "light");
    applyTheme(saved as "dark" | "light");
  }, []);

  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      aria-label={`Switch to ${next} theme`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-mut transition hover:text-fg"
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}