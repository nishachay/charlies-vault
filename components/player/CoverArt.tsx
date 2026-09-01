import { coverStyle } from "@/lib/cover";

interface CoverArtProps {
  seed: string; // youtubeId — deterministic palette source
  title: string;
  sublabel?: string | null;
  className?: string;
  titleClassName?: string;
}

/** Deterministic "vault label" cover. Rendered server-side; no YT thumbnails. */
export default function CoverArt({
  seed,
  title,
  sublabel,
  className = "",
  titleClassName = "",
}: CoverArtProps) {
  const style = coverStyle(seed);
  return (
    <div className={`label-cover ${className}`} style={style}>
      <div
        className={`relative z-10 flex h-full w-full flex-col justify-between p-4 ${titleClassName}`}
      >
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">
          <span>●</span> Outtake
        </div>
        <div>
          {sublabel ? (
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest opacity-70">
              {sublabel}
            </p>
          ) : null}
          <h3 className="line-clamp-2 text-lg font-extrabold leading-tight">
            {title}
          </h3>
        </div>
      </div>
    </div>
  );
}