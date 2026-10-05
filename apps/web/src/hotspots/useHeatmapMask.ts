import { useEffect, useState } from "react";
import { api } from "../api/client.ts";
import { buildAlphaMask } from "./heatmap-render.ts";

/**
 * Loads a heatmap mask asset as an alpha canvas. Returns null when no mask is
 * set or while the current mask is still loading.
 */
export function useHeatmapMask(maskAssetId: string | null): OffscreenCanvas | null {
  const [loaded, setLoaded] = useState<{ id: string; canvas: OffscreenCanvas } | null>(null);

  useEffect(() => {
    if (!maskAssetId) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!cancelled) setLoaded({ id: maskAssetId, canvas: buildAlphaMask(img) });
    };
    img.src = api.assets.fileUrl(maskAssetId);
    return () => {
      cancelled = true;
    };
  }, [maskAssetId]);

  return loaded && loaded.id === maskAssetId ? loaded.canvas : null;
}
