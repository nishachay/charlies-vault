"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";

export default function SubmitForm() {
  const [url, setUrl] = useState("");
  const [artist, setArtist] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setMsg("");
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeUrl: url.trim(),
          suggestedArtist: artist.trim() || undefined,
          suggestedTitle: title.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
      if (res.ok && data.ok) {
        setState("done");
        setMsg("Thanks — it's in the review queue.");
        setUrl("");
        setNote("");
      } else {
        setState("error");
        setMsg(data.error ?? "Something went wrong.");
      }
    } catch {
      setState("error");
      setMsg("Network error — try again.");
    }
  }

  if (state === "done") {
    return (
      <div className="card grain relative overflow-hidden p-6">
        <p className="text-lg font-semibold">Locked in.</p>
        <p className="mt-1 text-sm text-mut">{msg}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6">
      <div>
        <label htmlFor="su-url" className="label">
          YouTube URL or id
        </label>
        <input
          id="su-url"
          className="input"
          required
          placeholder="https://youtube.com/watch?v=…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="su-artist" className="label">
            Artist <span className="opacity-60">(optional)</span>
          </label>
          <input
            id="su-artist"
            className="input"
            placeholder="Frank Ocean"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="su-title" className="label">
            Title <span className="opacity-60">(optional)</span>
          </label>
          <input
            id="su-title"
            className="input"
            placeholder="Unreleased track"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label htmlFor="su-note" className="label">
          Note <span className="opacity-60">(optional)</span>
          </label>
        <textarea
          id="su-note"
          className="input min-h-20 resize-y"
          placeholder="Found it in a leak archive…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {state === "error" ? (
        <p className="text-sm text-rose">{msg}</p>
      ) : null}
      <button type="submit" className="btn btn-gold w-full" disabled={state === "sending"}>
        {state === "sending" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        Submit to the queue
      </button>
    </form>
  );
}