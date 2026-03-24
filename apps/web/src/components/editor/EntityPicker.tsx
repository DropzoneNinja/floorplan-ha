import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.ts";

interface HaEntity {
  entityId: string;
  state: string;
  attributes: { friendly_name?: string; [key: string]: unknown };
}

interface EntityPickerProps {
  value: string | null;
  onChange: (entityId: string | null) => void;
  /** Optional label shown above the picker */
  label?: string;
}

/**
 * Searchable dropdown for selecting a Home Assistant entity.
 * Fetches the entity list from the backend HA proxy.
 */
export function EntityPicker({ value, onChange, label = "Entity" }: EntityPickerProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const { data: entities = [], isLoading } = useQuery({
    queryKey: ["ha-entities"],
    queryFn: () => api.ha.entities() as Promise<HaEntity[]>,
    staleTime: 5 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return entities.slice(0, 100); // limit initial render
    const q = search.toLowerCase();
    return entities.filter(
      (e) =>
        (e.entityId?.toLowerCase() ?? "").includes(q) ||
        (e.attributes?.friendly_name ?? "").toLowerCase().includes(q),
    );
  }, [entities, search]);

  const selected = entities.find((e) => e.entityId === value);

  return (
    <div className="relative flex flex-col gap-1">
      <label className="text-xs text-gray-400">{label}</label>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex h-8 w-full items-center justify-between rounded border border-white/10 bg-surface px-2 text-left text-xs text-white hover:border-white/20 focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <span className="truncate">
          {selected
            ? selected.attributes.friendly_name ?? selected.entityId
            : <span className="text-gray-500">— None —</span>
          }
        </span>
        <svg className="ml-1 h-3 w-3 shrink-0 text-gray-400" viewBox="0 0 10 6" fill="none">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full z-50 mt-1 w-full rounded border border-white/10 bg-surface-raised shadow-xl">
          {/* Search input */}
          <div className="p-1.5">
            <input
              autoFocus
              type="text"
              placeholder="Search entities…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded bg-surface px-2 py-1 text-xs text-white placeholder-gray-500 outline-none ring-1 ring-white/10 focus:ring-accent"
            />
          </div>

          {/* Entity list */}
          <ul className="max-h-52 overflow-y-auto">
            {/* Clear option */}
            <li>
              <button
                type="button"
                className="w-full px-2 py-1.5 text-left text-xs text-gray-500 hover:bg-white/5"
                onClick={() => { onChange(null); setIsOpen(false); setSearch(""); }}
              >
                — None —
              </button>
            </li>

            {isLoading && (
              <li className="px-2 py-2 text-center text-xs text-gray-500">Loading…</li>
            )}

            {!isLoading && filtered.length === 0 && (
              <li className="px-2 py-2 text-center text-xs text-gray-500">No entities found</li>
            )}

            {filtered.map((entity) => (
              <li key={entity.entityId}>
                <button
                  type="button"
                  className={[
                    "flex w-full flex-col px-2 py-1.5 text-left hover:bg-white/5",
                    entity.entityId === value ? "bg-accent/20" : "",
                  ].join(" ")}
                  onClick={() => {
                    onChange(entity.entityId);
                    setIsOpen(false);
                    setSearch("");
                  }}
                >
                  <span className="text-xs text-white">
                    {entity.attributes.friendly_name ?? entity.entityId}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {entity.entityId} · {entity.state}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
