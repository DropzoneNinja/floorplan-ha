import { useState, useCallback, useEffect, type RefObject } from "react";

/**
 * Bounds of the rendered image within its container, expressed as fractions
 * of the container dimensions (0–1 range).
 *
 * For object-fill or when aspect ratios match exactly, all four values are
 * { x:0, y:0, width:1, height:1 } — the image fills the container.
 */
export interface ImageFitBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const FULL_BOUNDS: ImageFitBounds = { x: 0, y: 0, width: 1, height: 1 };

/**
 * Computes where an `object-contain` image actually renders within its
 * container, accounting for letterboxing and pillarboxing.
 *
 * Recomputes whenever the container is resized or the image finishes loading.
 * Returns FULL_BOUNDS when imageStretch is true (object-fill fills the container).
 */
export function useImageFitBounds(
  containerRef: RefObject<HTMLElement | null>,
  imageRef: RefObject<HTMLImageElement | null>,
  imageStretch: boolean,
): ImageFitBounds {
  const [bounds, setBounds] = useState<ImageFitBounds>(FULL_BOUNDS);

  const compute = useCallback(() => {
    if (imageStretch) {
      setBounds(FULL_BOUNDS);
      return;
    }
    const container = containerRef.current;
    const img = imageRef.current;
    if (!container || !img || !img.naturalWidth || !img.naturalHeight) return;

    const cw = container.offsetWidth;
    const ch = container.offsetHeight;
    if (!cw || !ch) return;

    const containerAspect = cw / ch;
    const imageAspect = img.naturalWidth / img.naturalHeight;

    if (imageAspect >= containerAspect) {
      // Image is wider relative to container → letterboxed (bars top & bottom)
      const renderH = cw / imageAspect;
      setBounds({ x: 0, y: (ch - renderH) / 2 / ch, width: 1, height: renderH / ch });
    } else {
      // Image is taller relative to container → pillarboxed (bars left & right)
      const renderW = ch * imageAspect;
      setBounds({ x: (cw - renderW) / 2 / cw, y: 0, width: renderW / cw, height: 1 });
    }
  }, [containerRef, imageRef, imageStretch]);

  // Recompute when the image loads (or if it's already cached)
  useEffect(() => {
    const img = imageRef.current;
    if (!img) return;
    if (img.complete && img.naturalWidth) {
      compute();
    }
    img.addEventListener("load", compute);
    return () => img.removeEventListener("load", compute);
  }, [imageRef, compute]);

  // Recompute when the container is resized
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    return () => ro.disconnect();
  }, [containerRef, compute]);

  return bounds;
}
