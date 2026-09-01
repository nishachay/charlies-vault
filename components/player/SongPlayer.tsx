"use client";

import { useMemo, useState } from "react";
import { Play, Square } from "lucide-react";

import { paletteFor } from "@/lib/cover";
import { formatDuration, youtubeEmbedUrl } from "@/lib/utils";
import CoverArt from "./CoverArt";

export interface TrackLike {
  id: string;
  title: string;
  youtubeId: string;
  artistName: string;
  artistSlug: string;
  durationSec: number | null;
  label: string | null;
}

interface SongPlayerProps {
  song: TrackLike;
  versions: TrackLike[];
}

export default function SongPlayer({ song, versions }: SongPlayerProps) {
  const all = useMemo(() => [song, ...versions], [song, versions]);
  const total = useMemo(() => {
    const ids = new Map<string, TrackLike>();
    for (const v of all) ids.set(v.id, v);
    return [...ids.values()];
  }, [all]);

  const active =
    total.find((t) => t.id === song.id) ?? total[total.length - 1] ?? song;
  const [currentId, setCurrentId] = useState<string>(active.id);
  const [playing, setPlaying] = useState(false);

  const current = total.find((t) => t.id === currentId) ?? total[0] ?? song;
  const palette = paletteFor(current.youtubeId);
  const isVersion = current.id !== song.id;

  function select(id: string) {
    setCurrentId(id);
    setPlaying(true);
  }

  return (
    <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-center">
      {/* Deck */}
      <div className="relative mx-auto w-full max-w-md">
        <div className="relative aspect-square">
          <CoverArt
            seed={current.youtubeId}
            title={current.title}
            sublabel={current.label}
            className="absolute inset-0"
          />
          {playing ? (
            <div className="absolute inset-0 overflow-hidden rounded-[18px]">
              <iframe
                className="h-full w-full"
                src={youtubeEmbedUrl(current.youtubeId, 1)}
                title={current.title}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : null}
        </div>
        <div
          className={`vinyl absolute -right-10 top-1/2 h-40 w-40 -translate-y-1/2 md:-right-16 md:h-52 md:w-52 ${
            playing ? "spin" : ""
          }`}
          aria-hidden
        >
          <div className="vinyl-label" style={{ ["--label-color" as string]: palette.from }}>
            <span className="text-lg">OUT</span>
          </div>
        </div>
      </div>

      {/* Meta + controls */}
      <div>
        <p className="chip">{isVersion ? current.label : "Canonical"}</p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-4xl">
          {current.title}
        </h1>
        <p className="mt-1 text-mut">
          {current.artistName} · {formatDuration(current.durationSec)}
        </p>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="btn btn-gold px-8"
          >
            {playing ? <Square size={16} /> : <Play size={16} />}
            {playing ? "Stop" : "Play"}
          </button>
          <a
            className="btn btn-ghost"
            href={`https://www.youtube.com/watch?v=${current.youtubeId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Watch on YouTube
          </a>
        </div>

        {versions.length > 0 ? (
          <div className="mt-8">
            <p className="label">Versions</p>
            <div className="flex flex-wrap gap-2">
              {total.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => select(v.id)}
                  className={`chip cursor-pointer transition ${
                    v.id === current.id ? "!border-gold !text-gold" : ""
                  }`}
                >
                  {v.label ?? "Original"}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <p className="mt-8 text-xs text-mut">
          Track <span className="font-mono text-mut">#{current.id}</span> ·
          verified playable. Report it if the video dies.
        </p>
      </div>
    </div>
  );
}