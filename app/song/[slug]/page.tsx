import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import ReportButton from "@/components/ReportButton";
import SongPlayer from "@/components/player/SongPlayer";
import { getCatalog } from "@/lib/dataloader";
import { youtubeWatchUrl } from "@/lib/utils";

export const revalidate = 3600;

export async function generateStaticParams() {
  const { getCatalog } = await import("@/lib/dataloader");
  return getCatalog()
    .tracks.filter((t) => !t.id.includes("__v"))
    .map((t) => ({ slug: t.songId }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { tracks } = getCatalog();
  const variant = tracks.find((t) => t.songId === slug && !t.id.includes("__v"));
  if (!variant) return { title: "Song not found" };
  const ogImage = `https://i.ytimg.com/vi/${variant.youtubeId}/hqdefault.jpg`;
  return {
    title: `${variant.title} — ${variant.artistName}`,
    description: `${variant.title} by ${variant.artistName} — currently playable unreleased original on OUTTAKE.`,
    openGraph: {
      title: `${variant.title} — ${variant.artistName}`,
      images: [{ url: ogImage }],
    },
  };
}

export default async function SongPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { tracks } = getCatalog();
  const variants = tracks.filter((t) => t.songId === slug);
  const canonical = variants.find((t) => !t.id.includes("__v"));
  if (!canonical) notFound();

  const active = variants.filter((t) => t.status === "active");
  const primary = active[0] ?? canonical;
  const versions = active.filter((t) => t.id !== primary.id);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicRecording",
    name: primary.title,
    byArtist: { "@type": "MusicGroup", name: primary.artistName },
    url: youtubeWatchUrl(primary.youtubeId),
    duration: primary.durationSec
      ? `PT${Math.floor(primary.durationSec / 60)}M${primary.durationSec % 60}S`
      : undefined,
  };

  return (
    <div className="container py-12">
      <Link
        href={`/artist/${primary.artistSlug}`}
        className="inline-flex items-center gap-1.5 text-sm text-mut transition hover:text-fg"
      >
        <ArrowLeft size={15} /> Back to {primary.artistName}
      </Link>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mt-8">
        <SongPlayer
          song={{
            id: primary.id,
            title: primary.title,
            youtubeId: primary.youtubeId,
            artistName: primary.artistName,
            artistSlug: primary.artistSlug,
            durationSec: primary.durationSec,
            label: primary.label,
          }}
          versions={versions.map((v) => ({
            id: v.id,
            title: v.title,
            youtubeId: v.youtubeId,
            artistName: v.artistName,
            artistSlug: v.artistSlug,
            durationSec: v.durationSec,
            label: v.label,
          }))}
        />
      </div>

      <div className="mt-12 border-t border-line pt-6">
        <ReportButton songId={primary.songId} versionId={null} />
        <p className="mt-2 text-xs text-mut">
          Verified playable · <Link className="underline" href={`https://www.youtube.com/watch?v=${primary.youtubeId}`} target="_blank">source on YouTube</Link>
        </p>
      </div>
    </div>
  );
}