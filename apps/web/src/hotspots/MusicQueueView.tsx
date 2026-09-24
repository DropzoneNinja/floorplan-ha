import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MusicQueueItem, MusicQueueSummary } from "../api/client.ts";
import { api } from "../api/client.ts";
import { useToastStore } from "../store/toast.ts";
import { ICON_PATHS } from "./icons.ts";
import { ErrorNotice, errorMessage } from "./MusicErrorNotice.tsx";
import { MusicArt } from "./MusicArt.tsx";

const LONG_PRESS_MS = 600; // matches BlindHotspot's long-press convention
const PRE_ARM_MOVE_TOLERANCE_PX = 10; // movement before long-press fires cancels it (this is just a scroll)
const AXIS_LOCK_PX = 8; // movement after arming needed to commit to vertical (reorder) vs horizontal (swipe)
const ROW_GAP_PX = 6; // matches the list's space-y-1.5
const SWIPE_REVEAL_PX = 88;
const SWIPE_OPEN_THRESHOLD_PX = SWIPE_REVEAL_PX / 2;

interface MusicQueueViewProps {
  entityId: string;
}

/**
 * Shows a player's Music Assistant queue: current + up to 50 upcoming tracks
 * in a scrolling list when the backend has direct Music Assistant server
 * access configured (MA_BASE_URL/MA_TOKEN), since HA's own get_queue service
 * only ever exposes current_item/next_item. Falls back to that current/next
 * pair when the fuller list isn't available.
 *
 * Upcoming tracks support long-press to drag-reorder (vertical) or swipe left
 * to reveal a Remove button (horizontal) — see QueueList. The currently
 * playing track (always the first item) excludes both: Music Assistant
 * itself rejects reordering it ("already played/buffered").
 */
export function MusicQueueView({ entityId }: MusicQueueViewProps) {
  const { data: queue, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["music-queue", entityId],
    queryFn: () => api.ha.getQueue(entityId),
    refetchInterval: 5000,
    retry: false,
  });

  if (isLoading) return <p className="py-6 text-center text-sm text-gray-500">Loading queue…</p>;
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <ErrorNotice message={errorMessage(error)} />
        <button type="button" onClick={() => void refetch()} className="text-[12px] text-gray-400 underline hover:text-white">
          Try again
        </button>
      </div>
    );
  }
  if (!queue) return <p className="py-6 text-center text-sm text-gray-500">No active queue on this player</p>;

  return (
    <div className="flex max-h-[60vh] flex-col gap-3">
      <div className="flex items-center justify-between text-[11px] text-gray-500">
        <span>{queue.items} tracks in queue</span>
        <span>
          {queue.shuffle_enabled ? "Shuffle on" : "Shuffle off"} · Repeat {queue.repeat_mode}
        </span>
      </div>
      {queue.queue_items && queue.queue_items.length > 0 ? (
        <QueueList entityId={entityId} queue={queue} items={queue.queue_items} />
      ) : (
        <div className="flex flex-col gap-4">
          <QueueItemRow label="Now playing" item={queue.current_item} highlighted />
          <QueueItemRow label="Up next" item={queue.next_item} highlighted={false} />
        </div>
      )}
    </div>
  );
}

// ─── Gesture-enabled scrolling list ──────────────────────────────────────────

type DragAxis = "none" | "vertical" | "horizontal";

interface DragState {
  itemId: string;
  sourceIndex: number;
  targetIndex: number;
  startX: number;
  startY: number;
  axis: DragAxis;
  rowHeight: number;
}

function QueueList({ entityId, queue, items }: { entityId: string; queue: MusicQueueSummary; items: MusicQueueItem[] }) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const currentItemId = queue.current_item?.queue_item_id;

  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const removeButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragState = useRef<DragState | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);

  const setRowTransform = useCallback((id: string, transform: string, withTransition: boolean) => {
    const el = rowRefs.current.get(id);
    if (!el) return;
    el.style.transition = withTransition ? "transform 150ms ease" : "none";
    el.style.transform = transform;
  }, []);

  const closeOpenSwipe = useCallback(() => {
    setOpenSwipeId((prev) => {
      if (prev) {
        setRowTransform(prev, "translateX(0)", true);
        const btn = removeButtonRefs.current.get(prev);
        if (btn) {
          btn.style.transition = "opacity 150ms ease";
          btn.style.opacity = "0";
        }
      }
      return null;
    });
  }, [setRowTransform]);

  const applySiblingShifts = useCallback(
    (sourceIndex: number, targetIndex: number, rowHeight: number) => {
      items.forEach((it, idx) => {
        if (idx === sourceIndex) return;
        let shift = 0;
        if (sourceIndex < targetIndex && idx > sourceIndex && idx <= targetIndex) shift = -1;
        else if (sourceIndex > targetIndex && idx < sourceIndex && idx >= targetIndex) shift = 1;
        setRowTransform(it.queue_item_id, shift !== 0 ? `translateY(${shift * rowHeight}px)` : "translateY(0)", true);
      });
    },
    [items, setRowTransform],
  );

  const resetAllTransforms = useCallback(() => {
    for (const it of items) setRowTransform(it.queue_item_id, "translateX(0) translateY(0)", true);
  }, [items, setRowTransform]);

  const commitMove = useCallback(
    async (item: MusicQueueItem, posShift: number) => {
      const prevData = queryClient.getQueryData<MusicQueueSummary>(["music-queue", entityId]);
      try {
        await api.ha.moveQueueItem(entityId, item.queue_item_id, posShift);
        // Optimistic reorder of the cached list — the next 5s poll reconciles with the server.
        queryClient.setQueryData<MusicQueueSummary>(["music-queue", entityId], (old) => {
          if (!old?.queue_items) return old;
          const list = [...old.queue_items];
          const from = list.findIndex((i) => i.queue_item_id === item.queue_item_id);
          if (from === -1) return old;
          const to = Math.max(0, Math.min(list.length - 1, from + posShift));
          const [moved] = list.splice(from, 1);
          list.splice(to, 0, moved!);
          return { ...old, queue_items: list };
        });
      } catch (err) {
        addToast(`Couldn't move track: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
        if (prevData) queryClient.setQueryData(["music-queue", entityId], prevData);
      }
    },
    [entityId, queryClient, addToast],
  );

  const commitRemove = useCallback(
    async (item: MusicQueueItem) => {
      const prevData = queryClient.getQueryData<MusicQueueSummary>(["music-queue", entityId]);
      // Optimistic removal — instant feedback instead of waiting on the next poll.
      queryClient.setQueryData<MusicQueueSummary>(["music-queue", entityId], (old) => {
        if (!old?.queue_items) return old;
        return { ...old, queue_items: old.queue_items.filter((i) => i.queue_item_id !== item.queue_item_id) };
      });
      try {
        await api.ha.removeQueueItem(entityId, item.queue_item_id);
      } catch (err) {
        addToast(`Couldn't remove track: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
        if (prevData) queryClient.setQueryData(["music-queue", entityId], prevData);
      }
    },
    [entityId, queryClient, addToast],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, item: MusicQueueItem, index: number) => {
      if (item.queue_item_id === currentItemId) return; // MA won't let the current track be reordered/dragged
      if (openSwipeId) closeOpenSwipe(); // any fresh gesture starts from a clean (closed) state

      pointerStart.current = { x: e.clientX, y: e.clientY };
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        const el = rowRefs.current.get(item.queue_item_id);
        if (!el) return;
        setArmedId(item.queue_item_id);
        navigator.vibrate?.(10);
        dragState.current = {
          itemId: item.queue_item_id,
          sourceIndex: index,
          targetIndex: index,
          startX: e.clientX,
          startY: e.clientY,
          axis: "none",
          rowHeight: el.getBoundingClientRect().height + ROW_GAP_PX,
        };
        el.setPointerCapture(e.pointerId);
      }, LONG_PRESS_MS);
    },
    [currentItemId, openSwipeId, closeOpenSwipe],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, item: MusicQueueItem) => {
      // Still waiting for the long-press to fire — enough movement means this is just a scroll.
      if (longPressTimer.current) {
        if (pointerStart.current) {
          const dx = e.clientX - pointerStart.current.x;
          const dy = e.clientY - pointerStart.current.y;
          if (Math.hypot(dx, dy) > PRE_ARM_MOVE_TOLERANCE_PX) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }
        return;
      }
      const ds = dragState.current;
      if (!ds || ds.itemId !== item.queue_item_id) return;
      e.preventDefault();

      const dx = e.clientX - ds.startX;
      const dy = e.clientY - ds.startY;

      if (ds.axis === "none") {
        if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
        ds.axis = Math.abs(dy) >= Math.abs(dx) ? "vertical" : "horizontal";
      }

      if (ds.axis === "vertical") {
        setRowTransform(item.queue_item_id, `translateY(${dy}px) scale(1.02)`, false);
        // z-index goes on the row's wrapper (the content div's parent), which is what
        // actually establishes a stacking context — setting it on the content div alone
        // left it trapped inside the wrapper's paint order, so it rendered under later rows.
        const wrapper = rowRefs.current.get(item.queue_item_id)?.parentElement;
        if (wrapper) wrapper.style.zIndex = "10";
        const shift = Math.round(dy / ds.rowHeight);
        // Index 0 is always the currently playing track — nothing can be dragged into its slot.
        const newTarget = Math.max(1, Math.min(items.length - 1, ds.sourceIndex + shift));
        if (newTarget !== ds.targetIndex) {
          ds.targetIndex = newTarget;
          applySiblingShifts(ds.sourceIndex, newTarget, ds.rowHeight);
        }
      } else {
        const clamped = Math.max(-SWIPE_REVEAL_PX, Math.min(0, dx));
        setRowTransform(item.queue_item_id, `translateX(${clamped}px)`, false);
        const btn = removeButtonRefs.current.get(item.queue_item_id);
        if (btn) {
          btn.style.transition = "none";
          btn.style.opacity = String(Math.min(1, -clamped / SWIPE_REVEAL_PX));
        }
      }
    },
    [items, applySiblingShifts, setRowTransform],
  );

  const endGesture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, item: MusicQueueItem) => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      pointerStart.current = null;
      setArmedId(null);

      const ds = dragState.current;
      dragState.current = null;
      if (!ds || ds.itemId !== item.queue_item_id) return;

      const wrapper = rowRefs.current.get(item.queue_item_id)?.parentElement;
      if (wrapper) wrapper.style.zIndex = "";

      if (ds.axis === "vertical") {
        resetAllTransforms();
        const posShift = ds.targetIndex - ds.sourceIndex;
        if (posShift !== 0) void commitMove(item, posShift);
        else setRowTransform(item.queue_item_id, "translateY(0)", true);
      } else if (ds.axis === "horizontal") {
        const dx = e.clientX - ds.startX;
        const btn = removeButtonRefs.current.get(item.queue_item_id);
        const opensFullyNow = dx < -SWIPE_OPEN_THRESHOLD_PX;
        if (btn) {
          btn.style.transition = "opacity 150ms ease";
          btn.style.opacity = opensFullyNow ? "1" : "0";
        }
        if (opensFullyNow) {
          setRowTransform(item.queue_item_id, `translateX(-${SWIPE_REVEAL_PX}px)`, true);
          setOpenSwipeId(item.queue_item_id);
        } else {
          setRowTransform(item.queue_item_id, "translateX(0)", true);
        }
      }
    },
    [resetAllTransforms, setRowTransform, commitMove],
  );

  return (
    <div className="flex-1 space-y-1.5 overflow-y-auto">
      {items.map((item, index) => (
        <QueueRow
          key={item.queue_item_id}
          item={item}
          highlighted={item.queue_item_id === currentItemId}
          armed={armedId === item.queue_item_id}
          swipeOpen={openSwipeId === item.queue_item_id}
          onRef={(el) => {
            if (el) rowRefs.current.set(item.queue_item_id, el);
            else rowRefs.current.delete(item.queue_item_id);
          }}
          onButtonRef={(el) => {
            if (el) removeButtonRefs.current.set(item.queue_item_id, el);
            else removeButtonRefs.current.delete(item.queue_item_id);
          }}
          onRemove={() => void commitRemove(item)}
          onPointerDown={(e) => handlePointerDown(e, item, index)}
          onPointerMove={(e) => handlePointerMove(e, item)}
          onPointerUp={(e) => endGesture(e, item)}
          onPointerCancel={(e) => endGesture(e, item)}
        />
      ))}
    </div>
  );
}

function QueueRow({
  item,
  highlighted,
  armed,
  swipeOpen,
  onRef,
  onButtonRef,
  onRemove,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  item: MusicQueueItem;
  highlighted: boolean;
  armed: boolean;
  swipeOpen: boolean;
  onRef: (el: HTMLDivElement | null) => void;
  onButtonRef: (el: HTMLButtonElement | null) => void;
  onRemove: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const artist = item.media_item?.artists?.map((a) => a.name).join(", ");
  const album = item.media_item?.album?.name;
  const artUrl = item.media_item?.image;

  return (
    // No overflow-hidden here: a row being drag-reordered needs to translate well
    // outside its own resting footprint (see QueueList's vertical drag handling),
    // and clipping it here was cutting it from view once it moved past ~1 row height.
    <div className="relative rounded-lg">
      <button
        ref={onButtonRef}
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.media_item?.name ?? item.name} from queue`}
        // Visibility is explicit (opacity/pointer-events), not "whatever the content
        // above happens to cover" — the content only ever moves horizontally at rest,
        // but during a vertical drag it (and sibling rows being shifted to make room)
        // translate away vertically too, which used to uncover this button since it
        // never moves with them.
        style={{ opacity: swipeOpen ? 1 : 0, pointerEvents: swipeOpen ? "auto" : "none" }}
        className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center rounded-lg bg-red-500/90 text-sm font-medium text-white transition-opacity duration-150"
        tabIndex={swipeOpen ? 0 : -1}
      >
        Remove
      </button>
      <div
        ref={onRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{ touchAction: armed ? "none" : "pan-y" }}
        className={[
          "relative flex items-center gap-3 rounded-lg p-2.5 select-none",
          highlighted ? "bg-white/10" : "bg-surface-raised",
          armed ? "shadow-lg" : "",
        ].join(" ")}
      >
        <MusicArt
          src={artUrl ? api.ha.imageProxyUrl(artUrl) : null}
          sizeClass="h-12 w-12"
          fallback={
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-white/10">
              <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                <path d={ICON_PATHS["mdi:music-note"]} fill="#9ca3af" />
              </svg>
            </div>
          }
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{item.media_item?.name ?? item.name}</p>
          {artist && <p className="truncate text-[12px] text-gray-400">{artist}</p>}
          {album && <p className="truncate text-[11px] text-gray-500">{album}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Plain fallback row (current/next only, no gestures) ─────────────────────

function QueueItemRow({
  label,
  item,
  highlighted,
}: {
  label?: string | undefined;
  item: MusicQueueItem | null;
  highlighted: boolean;
}) {
  if (!item) {
    return (
      <div>
        {label && <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>}
        <p className="text-sm text-gray-600">—</p>
      </div>
    );
  }
  const artist = item.media_item?.artists?.map((a) => a.name).join(", ");
  const album = item.media_item?.album?.name;
  const artUrl = item.media_item?.image;

  return (
    <div>
      {label && <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>}
      <div className={["flex items-center gap-3 rounded-lg p-2.5", highlighted ? "bg-white/10" : "bg-white/5"].join(" ")}>
        <MusicArt
          src={artUrl ? api.ha.imageProxyUrl(artUrl) : null}
          sizeClass="h-12 w-12"
          fallback={
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-white/10">
              <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                <path d={ICON_PATHS["mdi:music-note"]} fill="#9ca3af" />
              </svg>
            </div>
          }
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{item.media_item?.name ?? item.name}</p>
          {artist && <p className="truncate text-[12px] text-gray-400">{artist}</p>}
          {album && <p className="truncate text-[11px] text-gray-500">{album}</p>}
        </div>
      </div>
    </div>
  );
}
