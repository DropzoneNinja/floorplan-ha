import type { HotspotType } from "@floorplan-ha/shared";
import { getAllHotspotTypes } from "../../hotspots/registry.ts";

interface TypePickerModalProps {
  onSelect: (type: HotspotType) => void;
  onClose: () => void;
}

/**
 * Modal shown when adding a new hotspot.
 * Type options are driven by the hotspot registry so new types appear
 * automatically without changes here.
 */
export function TypePickerModal({ onSelect, onClose }: TypePickerModalProps) {
  const types = getAllHotspotTypes();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex w-full max-w-md flex-col rounded-xl border border-white/10 bg-surface-raised shadow-2xl"
        style={{ maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Add Hotspot — Choose Type</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <ul className="flex flex-1 flex-col gap-1.5 overflow-y-auto scrollbar-none p-5">
          {types.map((def) => (
            <li key={def.type}>
              <button
                type="button"
                onClick={() => onSelect(def.type)}
                className="flex w-full items-start gap-3 rounded-lg border border-white/5 bg-surface px-3 py-2.5 text-left hover:border-accent/40 hover:bg-accent/10 focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <span className="mt-0.5 text-lg leading-none">{def.icon}</span>
                <div>
                  <div className="text-xs font-medium text-white">{def.label}</div>
                  <div className="mt-0.5 text-[11px] text-gray-500">{def.description}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
