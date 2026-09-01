import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import CoverArt from "@/components/player/CoverArt";
import { getArtistBySlug, getSongsForArtist } from "@/lib/dataloader";
import { formatDuration, initials } from "@/lib/utils";

export const revalidate = 3600;

export async function generateStaticParams() {
  const { getCatalog } = await import("@/lib/dataloader");
  return getCatalog().artists.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const artist = getArtistBySlug(slug);
  if (!artist) return { title: "Artist not found" };
  return {
    title: artist.name,
    description: `${artist.trackCount} verified tracks by ${artist.name} — currently playable originals on OUTTAKE.`,
  };
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const artist = getArtistBySlug(slug);
  if (!artist) notFound();

  const tracks = getSongsForArtist(artist.slug).filter((t) => t.status === "active");
  const canonical = tracks.filter((t) => !t.id.includes("__v"));

  return (
    <div className="container py-12">
      <Link
        href="/#vault"
        className="inline-flex items-center gap-1.5 text-sm text-mut transition hover:text-fg"
      >
        <ArrowLeft size={15} /> Back to vault
      </Link>

      <header className="mt-8 flex items-center gap-6">
        {artist.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={artist.avatarUrl}
            alt={artist.name}
            width={96}
            height={96}
            className="h-24 w-24 rounded-full object-cover"
          />
        ) : (
          <span
            className="grid h-24 w-24 place-items-center rounded-full text-3xl font-extrabold"
            style={{ background: "var(--color-panel-2)", color: "var(--color-gold)" }}
          >
            {initials(artist.name)}
          </span>
        )}
        <div>
          <p className="chip">{artist.tag ?? "verified vault artist"}</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight">
            {artist.name}
          </h1>
          <p className="mt-1 text-mut">
            {canonical.length} verified tracks · {tracks.length} playable cuts
            incl. versions
          </p>
        </div>
      </header>

      <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {tracks.map((t) => (
          <Link
            key={t.id}
            href={`/song/${encodeURIComponent(t.songId)}`}
            className="group"
          >
            <CoverArt
              seed={t.youtubeId}
              title={t.title}
              sublabel={t.label}
              className="aspect-square transition group-hover:-translate-y-0.5"
              titleClassName="text-sm"
            />
            <p className="mt-2 truncate text-sm font-medium">{t.title}</p>
            <p className="text-xs text-mut">
              {t.label ?? "Original"} · {formatDuration(t.durationSec)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}