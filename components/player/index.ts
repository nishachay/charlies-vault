import type { Variant } from "@/lib/dataloader";
import SongPlayer, { type TrackLike } from "./SongPlayer";

function toTrackLike(v: Variant): TrackLike {
  return {
    id: v.id,
    title: v.title,
    youtubeId: v.youtubeId,
    artistName: v.artistName,
    artistSlug: v.artistSlug,
    durationSec: v.durationSec,
    label: v.label,
  };
}

export { toTrackLike };
export default SongPlayer;