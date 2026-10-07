import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MusicQueueItem, MusicQueueSummary } from "../api/client.ts";
import { api } from "../api/client.ts";
import { useToastStore } from "../store/toast.ts";
import { ICON_PATHS } from "./icons.ts";
import { ErrorNotice, errorMessage } from "./MusicErrorNotice.tsx";
import { MusicArt } from "./MusicArt.tsx";

const AXIS_LOCK_PX = 8; // movement needed before a gesture commits to horizontal (swipe) or vertical (drag)
const ROW_GAP_PX = 6; // matches the list's space-y-1.5
const SWIPE_REVEAL_PX = 88; // width of the Delete button revealed behind a row
const SWIPE_OPEN_THRESHOLD_PX = SWIPE_REVEAL_PX / 2;

interface MusicQueueViewProps {
  entityId: string;
}

/**
 * The player's queue, polled every 5s. Shared between the queue list and the
 * now-playing heart so both read one cache entry (and one set of updates).
 */
export function useMusicQueue(entityId: string) {
  return useQuery({
    queryKey: ["music-queue", entityId],
    queryFn: () => api.ha.getQueue(entityId),
    enabled: entityId !== "",
    refetchInterval: 5000,
    retry: false,
  });
}

/**
 * Shows a player's Music Assistant queue: current + up to 50 upcoming tracks
 * in a scrolling list when the backend has direct Music Assistant server
 * access configured (MA_BASE_URL/MA_TOKEN), since HA's own get_queue service
 * only ever exposes current_item/next_item. Falls back to that current/next
 * pair when the fuller list isn't available.
 *
 * Upcoming tracks can be swiped left to reveal a Delete button, or reordered by
 * dragging the handle on their right up or down — see QueueList. The currently
 * playing track (always the first item) has neither, since Music Assistant
 * rejects reordering it.
 */
export function MusicQueueView({ entityId }: MusicQueueViewProps) {
  const { data: queue, isLoading, isError, error, refetch } = useMusicQueue(entityId);

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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
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

/**
 * One pointer interaction at a time. A swipe starts on a row's body and moves it
 * sideways to reveal Delete; a drag starts on the handle and moves the row to a new
 * position in the queue.
 */
type Gesture =
  | {
      kind: "swipe";
      itemId: string;
      pointerId: number;
      startX: number;
      startY: number;
      startOffset: number;
      axis: "none" | "horizontal" | "vertical";
      offset: number;
    }
  | {
      kind: "drag";
      itemId: string;
      pointerId: number;
      startY: number;
      sourceIndex: number;
      targetIndex: number;
      rowHeight: number;
    };

function QueueList({ entityId, queue, items }: { entityId: string; queue: MusicQueueSummary; items: MusicQueueItem[] }) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const currentItemId = queue.current_item?.queue_item_id;

  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const deleteButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const gestureRef = useRef<Gesture | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);

  const setRowTransform = useCallback((id: string, transform: string, withTransition: boolean) => {
    const el = rowRefs.current.get(id);
    if (!el) return;
    el.style.transition = withTransition ? "transform 150ms ease" : "none";
    el.style.transform = transform;
  }, []);

  // Fades a row's Delete button in step with how far the row has been swiped.
  const setDeleteReveal = useCallback((id: string, progress: number, withTransition: boolean) => {
    const btn = deleteButtonRefs.current.get(id);
    if (!btn) return;
    btn.style.transition = withTransition ? "opacity 150ms ease" : "none";
    btn.style.opacity = String(Math.max(0, Math.min(1, progress)));
  }, []);

  // Snaps a row either fully open (Delete showing) or fully closed.
  const settleSwipe = useCallback(
    (id: string, open: boolean) => {
      setRowTransform(id, open ? `translateX(-${SWIPE_REVEAL_PX}px)` : "translateX(0)", true);
      setDeleteReveal(id, open ? 1 : 0, true);
      setOpenSwipeId((prev) => (open ? id : prev === id ? null : prev));
    },
    [setRowTransform, setDeleteReveal],
  );

  const closeOpenSwipe = useCallback(() => {
    if (openSwipeId) settleSwipe(openSwipeId, false);
  }, [openSwipeId, settleSwipe]);

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

  // ── Swipe: starts on the row body and moves it sideways ──

  const handleBodyPointerDown = (e: React.PointerEvent<HTMLDivElement>, item: MusicQueueItem) => {
    if (item.queue_item_id === currentItemId) return; // the playing track can't be swiped away
    if (openSwipeId && openSwipeId !== item.queue_item_id) closeOpenSwipe();
    gestureRef.current = {
      kind: "swipe",
      itemId: item.queue_item_id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startOffset: openSwipeId === item.queue_item_id ? -SWIPE_REVEAL_PX : 0,
      axis: "none",
      offset: openSwipeId === item.queue_item_id ? -SWIPE_REVEAL_PX : 0,
    };
  };

  const handleBodyPointerMove = (e: React.PointerEvent<HTMLDivElement>, item: MusicQueueItem) => {
    const g = gestureRef.current;
    if (!g || g.kind !== "swipe" || g.itemId !== item.queue_item_id) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (g.axis === "none") {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
      g.axis = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      // Keep receiving moves even if the finger or cursor leaves the row mid-swipe.
      if (g.axis === "horizontal") e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (g.axis !== "horizontal") return; // vertical movement is left to the list to scroll
    g.offset = Math.max(-SWIPE_REVEAL_PX, Math.min(0, g.startOffset + dx));
    setRowTransform(g.itemId, `translateX(${g.offset}px)`, false);
    setDeleteReveal(g.itemId, -g.offset / SWIPE_REVEAL_PX, false);
  };

  const handleBodyPointerEnd = (item: MusicQueueItem) => {
    const g = gestureRef.current;
    if (!g || g.kind !== "swipe" || g.itemId !== item.queue_item_id) return;
    gestureRef.current = null;
    if (g.axis === "horizontal") {
      settleSwipe(g.itemId, g.offset < -SWIPE_OPEN_THRESHOLD_PX);
    } else if (openSwipeId === g.itemId) {
      settleSwipe(g.itemId, false); // a tap on an open row closes it
    }
  };

  // ── Drag: starts on the handle and moves the row up or down the queue ──

  const handleHandlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, item: MusicQueueItem, index: number) => {
    if (item.queue_item_id === currentItemId) return;
    const el = rowRefs.current.get(item.queue_item_id);
    if (!el) return;
    if (openSwipeId) closeOpenSwipe();
    e.currentTarget.setPointerCapture(e.pointerId);
    navigator.vibrate?.(10);
    gestureRef.current = {
      kind: "drag",
      itemId: item.queue_item_id,
      pointerId: e.pointerId,
      startY: e.clientY,
      sourceIndex: index,
      targetIndex: index,
      rowHeight: el.getBoundingClientRect().height + ROW_GAP_PX,
    };
    setArmedId(item.queue_item_id);
  };

  const handleHandlePointerMove = (e: React.PointerEvent<HTMLButtonElement>, item: MusicQueueItem) => {
    const g = gestureRef.current;
    if (!g || g.kind !== "drag" || g.itemId !== item.queue_item_id) return;
    const dy = e.clientY - g.startY;
    setRowTransform(g.itemId, `translateY(${dy}px) scale(1.02)`, false);
    // z-index goes on the row's wrapper (the content div's parent), which is what
    // actually establishes a stacking context — setting it on the content div alone
    // left it trapped inside the wrapper's paint order, so it rendered under later rows.
    const wrapper = rowRefs.current.get(g.itemId)?.parentElement;
    if (wrapper) wrapper.style.zIndex = "10";
    const shift = Math.round(dy / g.rowHeight);
    // Index 0 is always the currently playing track — nothing can be dragged into its slot.
    const newTarget = Math.max(1, Math.min(items.length - 1, g.sourceIndex + shift));
    if (newTarget !== g.targetIndex) {
      g.targetIndex = newTarget;
      applySiblingShifts(g.sourceIndex, newTarget, g.rowHeight);
    }
  };

  const handleHandlePointerEnd = (item: MusicQueueItem) => {
    const g = gestureRef.current;
    if (!g || g.kind !== "drag" || g.itemId !== item.queue_item_id) return;
    gestureRef.current = null;
    setArmedId(null);
    const wrapper = rowRefs.current.get(g.itemId)?.parentElement;
    if (wrapper) wrapper.style.zIndex = "";
    resetAllTransforms();
    const posShift = g.targetIndex - g.sourceIndex;
    if (posShift !== 0) void commitMove(item, posShift);
  };

  return (
    <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
      {items.map((item, index) => {
        const isCurrent = item.queue_item_id === currentItemId;
        return (
          <QueueRow
            key={item.queue_item_id}
            item={item}
            isCurrent={isCurrent}
            armed={armedId === item.queue_item_id}
            swipeOpen={openSwipeId === item.queue_item_id}
            onRef={(el) => {
              if (el) rowRefs.current.set(item.queue_item_id, el);
              else rowRefs.current.delete(item.queue_item_id);
            }}
            onDeleteButtonRef={(el) => {
              if (el) deleteButtonRefs.current.set(item.queue_item_id, el);
              else deleteButtonRefs.current.delete(item.queue_item_id);
            }}
            onDelete={() => {
              setOpenSwipeId(null);
              void commitRemove(item);
            }}
            onBodyPointerDown={(e) => handleBodyPointerDown(e, item)}
            onBodyPointerMove={(e) => handleBodyPointerMove(e, item)}
            onBodyPointerEnd={() => handleBodyPointerEnd(item)}
            onHandlePointerDown={(e) => handleHandlePointerDown(e, item, index)}
            onHandlePointerMove={(e) => handleHandlePointerMove(e, item)}
            onHandlePointerEnd={() => handleHandlePointerEnd(item)}
          />
        );
      })}
    </div>
  );
}

function QueueRow({
  item,
  isCurrent,
  armed,
  swipeOpen,
  onRef,
  onDeleteButtonRef,
  onDelete,
  onBodyPointerDown,
  onBodyPointerMove,
  onBodyPointerEnd,
  onHandlePointerDown,
  onHandlePointerMove,
  onHandlePointerEnd,
}: {
  item: MusicQueueItem;
  isCurrent: boolean;
  armed: boolean;
  swipeOpen: boolean;
  onRef: (el: HTMLDivElement | null) => void;
  onDeleteButtonRef: (el: HTMLButtonElement | null) => void;
  onDelete: () => void;
  onBodyPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onBodyPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onBodyPointerEnd: () => void;
  onHandlePointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onHandlePointerMove: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onHandlePointerEnd: () => void;
}) {
  const artist = item.media_item?.artists?.map((a) => a.name).join(", ");
  const album = item.media_item?.album?.name;
  const artUrl = item.media_item?.image;
  const name = item.media_item?.name ?? item.name;

  return (
    // No overflow-hidden here: a row being drag-reordered needs to translate well
    // outside its own resting footprint (see QueueList's vertical drag handling),
    // and clipping it here was cutting it from view once it moved past ~1 row height.
    <div className="relative rounded-lg">
      <button
        ref={onDeleteButtonRef}
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${name} from queue`}
        // Visibility is explicit (opacity/pointer-events), not "whatever the content
        // above happens to cover" — the content only ever moves horizontally at rest,
        // but during a vertical drag it (and sibling rows being shifted to make room)
        // translate away vertically too, which used to uncover this button since it
        // never moves with them.
        style={{ opacity: swipeOpen ? 1 : 0, pointerEvents: swipeOpen ? "auto" : "none" }}
        className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center rounded-lg bg-red-500/90 text-sm font-medium text-white transition-opacity duration-150"
        tabIndex={swipeOpen ? 0 : -1}
        aria-hidden={!swipeOpen}
      >
        Delete
      </button>
      <div
        ref={onRef}
        style={{ touchAction: "pan-y" }}
        className={[
          "relative flex items-center gap-2 rounded-lg p-2.5 select-none",
          isCurrent ? "bg-white/10" : "bg-surface-raised",
          armed ? "shadow-lg" : "",
        ].join(" ")}
      >
        <div
          className="flex min-w-0 flex-1 items-center gap-3"
          onPointerDown={onBodyPointerDown}
          onPointerMove={onBodyPointerMove}
          onPointerUp={onBodyPointerEnd}
          onPointerCancel={onBodyPointerEnd}
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
            <p className="truncate text-sm font-medium text-white">{name}</p>
            {artist && <p className="truncate text-[12px] text-gray-400">{artist}</p>}
            {album && <p className="truncate text-[11px] text-gray-500">{album}</p>}
          </div>
        </div>
        {!isCurrent && (
          <button
            type="button"
            aria-label={`Drag ${name} to reorder`}
            // touch-action none: without it, touch-dragging the handle would scroll the list instead.
            style={{ touchAction: "none" }}
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerEnd}
            onPointerCancel={onHandlePointerEnd}
            className="shrink-0 cursor-grab rounded p-1.5 text-gray-500 hover:bg-white/10 hover:text-white active:cursor-grabbing"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d={ICON_PATHS["mdi:drag"]} fill="currentColor" />
            </svg>
          </button>
        )}
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
