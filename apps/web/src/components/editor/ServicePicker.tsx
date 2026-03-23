import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.ts";
import type { ServiceCall } from "@floorplan-ha/shared";
import { EntityPicker } from "./EntityPicker.tsx";

interface HaService {
  domain: string;
  service: string;
  description: string;
  fields?: Record<string, { description?: string; example?: unknown }>;
}

interface ServicePickerProps {
  /** Current service call value */
  value: ServiceCall | null;
  onChange: (call: ServiceCall | null) => void;
  /** If provided, only show services for this entity's domain */
  entityId?: string | null;
  label?: string;
}

/**
 * Picker for selecting a Home Assistant service call.
 * Shows domain-filtered services and provides a basic service data JSON editor.
 */
export function ServicePicker({ value, onChange, entityId, label = "Service" }: ServicePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [serviceDataText, setServiceDataText] = useState(
    value?.serviceData ? JSON.stringify(value.serviceData, null, 2) : "",
  );
  const [dataError, setDataError] = useState<string | null>(null);

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["ha-services"],
    queryFn: () => api.ha.services() as Promise<HaService[]>,
    staleTime: 60 * 1000,
  });

  const entityDomain = entityId?.split(".")[0];

  const filtered = useMemo(() => {
    const list = entityDomain
      ? services.filter((s) => s.domain === entityDomain)
      : services;

    if (!search.trim()) return list.slice(0, 100);
    const q = search.toLowerCase();
    return list.filter(
      (s) =>
        `${s.domain}.${s.service}`.includes(q) ||
        s.description.toLowerCase().includes(q),
    );
  }, [services, entityDomain, search]);

  const currentLabel = value ? `${value.domain}.${value.service}` : null;

  const handleSelect = (s: HaService) => {
    const call: ServiceCall = {
      domain: s.domain,
      service: s.service,
      ...(entityId ? { target: { entityId } } : {}),
      ...(value?.serviceData ? { serviceData: value.serviceData } : {}),
    };
    onChange(call);
    setIsOpen(false);
    setSearch("");
  };

  const handleServiceDataChange = (text: string) => {
    setServiceDataText(text);
    if (!text.trim()) {
      setDataError(null);
      if (value) {
        const { serviceData: _removed, ...rest } = value;
        onChange(rest);
      }
      return;
    }
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      setDataError(null);
      if (value) onChange({ ...value, serviceData: parsed });
    } catch {
      setDataError("Invalid JSON");
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-400">{label}</label>

      {/* Service selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((o) => !o)}
          className="flex h-8 w-full items-center justify-between rounded border border-white/10 bg-surface px-2 text-left text-xs text-white hover:border-white/20 focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <span className="truncate font-mono">
            {currentLabel ?? <span className="text-gray-500 font-sans">— None —</span>}
          </span>
          <svg className="ml-1 h-3 w-3 shrink-0 text-gray-400" viewBox="0 0 10 6" fill="none">
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute top-full z-50 mt-1 w-full rounded border border-white/10 bg-surface-raised shadow-xl">
            <div className="p-1.5">
              <input
                autoFocus
                type="text"
                placeholder="Search services…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded bg-surface px-2 py-1 text-xs text-white placeholder-gray-500 outline-none ring-1 ring-white/10 focus:ring-accent"
              />
            </div>
            <ul className="max-h-52 overflow-y-auto">
              <li>
                <button
                  type="button"
                  className="w-full px-2 py-1.5 text-left text-xs text-gray-500 hover:bg-white/5"
                  onClick={() => { onChange(null); setIsOpen(false); }}
                >
                  — None —
                </button>
              </li>
              {isLoading && (
                <li className="px-2 py-2 text-center text-xs text-gray-500">Loading…</li>
              )}
              {!isLoading && filtered.length === 0 && (
                <li className="px-2 py-2 text-center text-xs text-gray-500">No services found</li>
              )}
              {filtered.map((s) => (
                <li key={`${s.domain}.${s.service}`}>
                  <button
                    type="button"
                    className={[
                      "flex w-full flex-col px-2 py-1.5 text-left hover:bg-white/5",
                      value?.domain === s.domain && value?.service === s.service ? "bg-accent/20" : "",
                    ].join(" ")}
                    onClick={() => handleSelect(s)}
                  >
                    <span className="font-mono text-xs text-white">{s.domain}.{s.service}</span>
                    {s.description && (
                      <span className="line-clamp-1 text-[10px] text-gray-500">{s.description}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Target entity override */}
      {value && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Target entity</label>
          <EntityPicker
            value={value.target?.entityId ?? null}
            onChange={(id) => {
              const { target } = value;
              if (id) {
                onChange({ ...value, target: { ...(target ?? {}), entityId: id } });
              } else {
                const next: ServiceCall["target"] = {};
                if (target?.deviceId) next.deviceId = target.deviceId;
                if (target?.areaId) next.areaId = target.areaId;
                onChange({ ...value, target: next });
              }
            }}
          />
          {value.target?.entityId == null && entityId && (
            <p className="text-[10px] text-yellow-500">
              No target entity set — service will run without an entity target.
            </p>
          )}
          {value.target?.entityId && entityId && value.target.entityId !== entityId && (
            <div className="flex items-center justify-between gap-2 rounded bg-yellow-500/10 px-2 py-1">
              <p className="text-[10px] text-yellow-400">
                Target differs from hotspot entity.
              </p>
              <button
                type="button"
                onClick={() => onChange({ ...value, target: { ...value.target, entityId } })}
                className="shrink-0 text-[10px] text-yellow-300 underline hover:text-yellow-100"
              >
                Sync
              </button>
            </div>
          )}
        </div>
      )}

      {/* Service data editor */}
      {value && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Service data (JSON)</label>
          <textarea
            rows={3}
            placeholder="{}"
            value={serviceDataText}
            onChange={(e) => handleServiceDataChange(e.target.value)}
            className="w-full resize-none rounded border border-white/10 bg-surface px-2 py-1 font-mono text-xs text-white placeholder-gray-600 focus:border-accent focus:outline-none"
            spellCheck={false}
          />
          {dataError && <p className="text-[10px] text-red-400">{dataError}</p>}
        </div>
      )}
    </div>
  );
}
