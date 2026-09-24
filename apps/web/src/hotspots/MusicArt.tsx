import { useEffect, useState, type ReactNode } from "react";

interface MusicArtProps {
  src: string | null;
  sizeClass: string;
  roundedClass?: string;
  fallback: ReactNode;
}

/**
 * Album art `<img>` with a fallback for missing/broken images. Music
 * Assistant's imageproxy URLs can 404 (e.g. a stale proxy id left behind in
 * an idle player's entity_picture after its cached image entry expires), so
 * this needs an onError handler, not just a presence check on `src`.
 */
export function MusicArt({ src, sizeClass, roundedClass = "rounded", fallback }: MusicArtProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt=""
      className={[sizeClass, "shrink-0", roundedClass, "object-cover"].join(" ")}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
