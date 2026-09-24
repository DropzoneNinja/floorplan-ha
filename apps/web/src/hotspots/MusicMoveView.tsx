import { useState } from "react";
import type { MusicSpeaker } from "@floorplan-ha/shared";
import { api } from "../api/client.ts";
import { useToastStore } from "../store/toast.ts";

interface MusicMoveViewProps {
  /** The speaker whose dialog this view is shown from */
  current: MusicSpeaker;
  /** Every other configured speaker on this hotspot */
  otherSpeakers: MusicSpeaker[];
  /** Called after a successful transfer — the caller switches straight to this speaker's own dialog. */
  onTransferred: (targetSpeakerId: string) => void;
  /** Called after a successful group/ungroup — stays on the current speaker's dialog. */
  onDone: () => void;
}

/**
 * Move-or-group view: transfer the currently playing queue to a single other
 * speaker, or group several speakers to play the same audio in sync.
 * Uses Music Assistant's transfer_queue and the standard HA media_player
 * join/unjoin services (both confirmed against the live services list).
 */
export function MusicMoveView({ current, otherSpeakers, onTransferred, onDone }: MusicMoveViewProps) {
  const addToast = useToastStore((s) => s.addToast);
  const [isPending, setIsPending] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const candidates = otherSpeakers.filter((s) => s.entityId);

  async function transferTo(target: MusicSpeaker) {
    if (!current.entityId || !target.entityId || isPending) return;
    setIsPending(true);
    try {
      await api.ha.callService("music_assistant", "transfer_queue", {
        serviceData: { source_player: current.entityId },
        target: { entityId: target.entityId },
      });
      addToast(`Moved to ${target.name}`, "success");
      onTransferred(target.id);
    } catch (err) {
      addToast(`Move failed: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setIsPending(false);
    }
  }

  async function groupSelected() {
    if (!current.entityId || checked.size === 0 || isPending) return;
    setIsPending(true);
    try {
      await api.ha.callService("media_player", "join", {
        serviceData: { group_members: Array.from(checked) },
        target: { entityId: current.entityId },
      });
      addToast(`Grouped ${checked.size} speaker${checked.size === 1 ? "" : "s"} with ${current.name}`, "success");
      onDone();
    } catch (err) {
      addToast(`Group failed: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setIsPending(false);
    }
  }

  async function ungroup() {
    if (!current.entityId || isPending) return;
    setIsPending(true);
    try {
      await api.ha.callService("media_player", "unjoin", { target: { entityId: current.entityId } });
      addToast(`${current.name} left its group`, "success");
      onDone();
    } catch (err) {
      addToast(`Ungroup failed: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setIsPending(false);
    }
  }

  function toggle(entityId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) next.delete(entityId);
      else next.add(entityId);
      return next;
    });
  }

  if (candidates.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-500">No other speakers configured yet.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">
          Move what's playing to a single speaker
        </p>
        <ul className="flex flex-col gap-1.5">
          {candidates.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                disabled={isPending}
                onClick={() => void transferTo(s)}
                className="flex w-full items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-left text-sm text-white hover:bg-white/10 disabled:opacity-40"
              >
                <span>{s.name}</span>
                <span className="text-gray-500">Move here →</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">
          Or play in sync with {current.name}
        </p>
        <ul className="flex flex-col gap-1.5">
          {candidates.map((s) => (
            <li key={s.id}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={checked.has(s.entityId!)}
                  onChange={() => toggle(s.entityId!)}
                  className="rounded accent-accent"
                />
                {s.name}
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={isPending || checked.size === 0}
            onClick={() => void groupSelected()}
            className="flex-1 rounded-lg bg-accent/80 py-1.5 text-[13px] font-medium text-white hover:bg-accent disabled:opacity-40"
          >
            Group selected
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => void ungroup()}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-[13px] text-gray-300 hover:bg-white/20 disabled:opacity-40"
          >
            Leave group
          </button>
        </div>
      </div>
    </div>
  );
}
