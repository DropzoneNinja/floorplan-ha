import { useState } from "react";
import { createPortal } from "react-dom";
import type { PowerpointItem, PowerpointOutlet } from "@floorplan-ha/shared";
import { api } from "../api/client.ts";
import { useToastStore } from "../store/toast.ts";
import { useEntityStateStore } from "../store/entity-states.ts";
import { isOnState } from "./state-utils.ts";
import { AustralianSocketOutlet } from "./icons/AustralianSocket.tsx";

interface PowerpointControlDialogProps {
  item: PowerpointItem;
  onClose: () => void;
}

/**
 * Dialog opened by tapping a powerpoint pin on the floorplan. Shows the two
 * outlets side by side; tapping either socket toggles that outlet directly.
 */
export function PowerpointControlDialog({ item, onClose }: PowerpointControlDialogProps) {
  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl border border-white/10 bg-surface-raised pb-6 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-[21px] font-semibold text-white">{item.name}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[27px] leading-none text-gray-500 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-3 px-5 pt-5">
          <OutletControl outlet={item.outletA} />
          <OutletControl outlet={item.outletB} />
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function OutletControl({ outlet }: { outlet: PowerpointOutlet }) {
  const addToast = useToastStore((s) => s.addToast);
  const entityState = useEntityStateStore((s) =>
    outlet.entityId ? s.getState(outlet.entityId) : undefined,
  );
  const [isPending, setIsPending] = useState(false);

  const isOn = isOnState(entityState?.state ?? "");

  const handleTap = async () => {
    if (!outlet.entityId || isPending) return;
    setIsPending(true);
    try {
      await api.ha.callService("switch", "toggle", { target: { entityId: outlet.entityId } });
    } catch (err) {
      addToast(
        `Powerpoint toggle failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error",
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleTap()}
      disabled={!outlet.entityId || isPending}
      className={[
        "flex flex-1 flex-col items-center gap-2 rounded-xl border py-4 transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        isOn ? "border-yellow-400/40 bg-yellow-400/10" : "border-white/10 bg-white/5 hover:bg-white/10",
      ].join(" ")}
      aria-label={`${outlet.name} — ${isOn ? "on" : "off"}, tap to toggle`}
    >
      <AustralianSocketOutlet on={isOn} size={84} />
      <span className="max-w-[100px] truncate text-[15px] font-medium text-white">{outlet.name}</span>
      <span
        className={[
          "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
          isOn ? "bg-yellow-500/20 text-yellow-300" : "bg-gray-500/20 text-gray-400",
        ].join(" ")}
      >
        {outlet.entityId ? (isOn ? "On" : "Off") : "Unassigned"}
      </span>
    </button>
  );
}
