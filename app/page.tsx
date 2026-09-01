import Link from "next/link";
import { ArrowUpRight, Disc3, Search } from "lucide-react";

import SubmitForm from "@/components/SubmitForm";
import CoverArt from "@/components/player/CoverArt";
import { getCatalog } from "@/lib/dataloader";
import { formatDuration } from "@/lib/utils";
import { initials } from "@/lib/utils";

export const revalidate = 3600;

export default function HomePage() {
  const { artists, tracks } = getCatalog();
  const active = tracks.filter((t) => t.status === "active");
  const recent = [...active]
    .sort((a, b) => a.songId.localeCompare(b.songId))
    .slice(0, 8);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "OUTTAKE — verified archive of unreleased music",
    description: "Machine-verified, currently-playable unreleased tracks on YouTube.",
    numberOfItems: active.length,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="border-b border-line">
        <div className="container grid gap-10 py-20 md:grid-cols-[1.4fr_1fr] md:items-center md:py-28">
          <div className="rise">
            <p className="chip">machine-verified · fresh daily</p>
            <h1 className="mt-6 text-5xl font-extrabold leading-[0.95] tracking-tight md:text-7xl">
              Unreleased music
              <br />
              <span className="text-gold">that actually</span>
              <br />
              plays.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-mut">
              OUTTAKE is a verified archive of unreleased music. Every track on
              the site is a currently-playable YouTube original — re-checked
              every day. If a video dies, we say so. We never host files, we
              only link.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#vault" className="btn btn-gold">
                <Search size={16} /> Explore the vault
              </a>
              <a href="#submit" className="btn btn-ghost">
                Found a grail? <ArrowUpRight size={16} />
              </a>
            </div>
            <div className="mt-10 flex gap-8">
              <Stat value={`${artists.length}`} label="artists" />
              <Stat value={`${active.length}`} label="verified tracks" />
              <Stat value="100%" label="playable now" />
            </div>
          </div>

          <div className="relative mx-auto hidden aspect-square w-full max-w-sm md:block">
            <div className="vinyl absolute inset-0 spin" aria-hidden>
              <div className="vinyl-label">
                <Disc3 size={44} strokeWidth={1.6} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Artists */}
      <section id="vault" className="container scroll-mt-20 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">The Vault</h2>
            <p className="mt-1 text-mut">12 verified artists · 288 recovered cuts</p>
          </div>
          <p className="hidden text-sm text-mut md:block">
            every id oEmbed-verified before it ships
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {artists.map((a) => (
            <Link
              key={a.slug}
              href={`/artist/${a.slug}`}
              className="card group flex items-center gap-4 p-4 transition hover:border-gold/50"
            >
              {a.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.avatarUrl}
                  alt={a.name}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-bold"
                  style={{ background: "var(--color-panel-2)", color: "var(--color-gold)" }}
                >
                  {initials(a.name)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{a.name}</p>
                <p className="text-sm text-mut">
                  {a.activeCount === a.trackCount
                    ? `${a.trackCount} verified`
                    : `${a.activeCount} / ${a.trackCount} playable`}
                </p>
              </div>
              <ArrowUpRight
                size={18}
                className="text-mut transition group-hover:text-gold"
              />
            </Link>
          ))}
        </div>
      </section>

      {/* Recently in the vault */}
      <section className="border-t border-line">
        <div className="container py-16">
          <h2 className="mb-8 text-2xl font-extrabold tracking-tight">
            Fresh in the vault
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {recent.map((t) => (
              <Link key={t.id} href={`/song/${encodeURIComponent(t.songId)}`}>
                <div className="transition hover:-translate-y-0.5">
                  <CoverArt
                    seed={t.youtubeId}
                    title={t.title}
                    sublabel={t.label}
                    className="aspect-square"
                    titleClassName="text-sm"
                  />
                  <p className="mt-2 truncate text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-mut">
                    {t.artistName} · {formatDuration(t.durationSec)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Submit */}
      <section id="submit" className="container scroll-mt-20 pb-24">
        <div className="grid gap-10 md:grid-cols-[1fr_1.2fr] md:items-start">
          <div className="rise">
            <h2 className="text-3xl font-extrabold tracking-tight">
              Found a grail?
            </h2>
            <p className="mt-3 leading-relaxed text-mut">
              Found an unreleased track floating on YouTube? Drop the link. It
              goes to the review queue, gets probed, and ships only if it&apos;s
              actually playable.
            </p>
          </div>
          <SubmitForm />
        </div>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-3xl font-extrabold tracking-tight">{value}</p>
      <p className="text-sm text-mut">{label}</p>
    </div>
  );
}