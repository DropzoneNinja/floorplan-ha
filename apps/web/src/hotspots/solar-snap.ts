/**
 * Magnetic edge-snapping for solar panel tiles.
 *
 * While a panel is being dragged, if one of its edges lands close to a
 * neighbouring panel's opposite edge, the panel snaps flush against it and
 * aligns on the perpendicular axis too — top-aligned when snapping
 * left/right (same row), left-aligned when snapping top/bottom (same
 * column) — so panels tile into a clean grid the way they would on a roof.
 */

export interface SnapCandidate {
  id: string;
  x: number;
  y: number;
}

/** Snap distance, as a normalized fraction of the floorplan. */
const SNAP_THRESHOLD = 0.015;

export function snapPanelPosition(
  candidate: { x: number; y: number },
  excludeId: string | null,
  others: SnapCandidate[],
  panelWidth: number,
  panelHeight: number,
): { x: number; y: number } {
  let bestX: number | null = null;
  let bestXDist = SNAP_THRESHOLD;
  let alignYForX: number | null = null;

  let bestY: number | null = null;
  let bestYDist = SNAP_THRESHOLD;
  let alignXForY: number | null = null;

  for (const other of others) {
    if (other.id === excludeId) continue;

    // Rows roughly overlapping vertically are candidates for left/right snapping.
    const vOverlap = Math.abs(candidate.y - other.y) < panelHeight;
    if (vOverlap) {
      const leftToRight = Math.abs(candidate.x - (other.x + panelWidth));
      if (leftToRight < bestXDist) {
        bestXDist = leftToRight;
        bestX = other.x + panelWidth;
        alignYForX = other.y;
      }
      const rightToLeft = Math.abs(candidate.x + panelWidth - other.x);
      if (rightToLeft < bestXDist) {
        bestXDist = rightToLeft;
        bestX = other.x - panelWidth;
        alignYForX = other.y;
      }
    }

    // Columns roughly overlapping horizontally are candidates for top/bottom snapping.
    const hOverlap = Math.abs(candidate.x - other.x) < panelWidth;
    if (hOverlap) {
      const topToBottom = Math.abs(candidate.y - (other.y + panelHeight));
      if (topToBottom < bestYDist) {
        bestYDist = topToBottom;
        bestY = other.y + panelHeight;
        alignXForY = other.x;
      }
      const bottomToTop = Math.abs(candidate.y + panelHeight - other.y);
      if (bottomToTop < bestYDist) {
        bestYDist = bottomToTop;
        bestY = other.y - panelHeight;
        alignXForY = other.x;
      }
    }
  }

  let x = candidate.x;
  let y = candidate.y;

  if (bestX !== null) {
    x = bestX;
    if (alignYForX !== null) y = alignYForX;
  }
  if (bestY !== null) {
    y = bestY;
    // Only follow the column's x-alignment if no row snap already set x.
    if (alignXForY !== null && bestX === null) x = alignXForY;
  }

  return {
    x: Math.max(0, Math.min(1 - panelWidth, x)),
    y: Math.max(0, Math.min(1 - panelHeight, y)),
  };
}
