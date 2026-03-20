import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.ts";

interface RevisionRaw {
  id: string;
  entityType: string;
  entityId: string;
  action: "create" | "update" | "delete";
  beforeJson: unknown;
  afterJson: unknown;
  createdAt: string;
  user?: { id: string; email: string } | null;
}

interface RevisionHistoryModalProps {
  entityType: "hotspot" | "floorplan";
  entityId: string;
  entityName?: string;
  onClose: () => void;
}

/**
 * Modal that displays the revision history for a given entity.
 * Accessible from the editor config panel.
 */
export function RevisionHistoryModal({
  entityType,
  entityId,
  entityName,
  onClose,
}: RevisionHistoryModalProps) {
  const { data: revisions = [], isLoading } = useQuery<RevisionRaw[]>({
    queryKey: ["revisions", entityType, entityId],
    queryFn: () =>
      api.revisions.list({ entity_type: entityType, entity_id: entityId }) as Promise<RevisionRaw[]>,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-xl flex-col rounded-t-2xl bg-surface-raised sm:rounded-2xl"
        style={{ maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Revision History</h2>
            {entityName && (
              <p className="text-xs text-gray-500 mt-0.5">{entityName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-white text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-none p-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : revisions.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-600">No revision history found.</p>
          ) : (
            <ol className="relative border-l border-white/10 pl-5 space-y-4">
              {revisions.map((rev) => (
                <li key={rev.id} className="relative">
                  {/* Timeline dot */}
                  <span
                    className={[
                      "absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full border-2",
                      rev.action === "create" ? "border-green-500 bg-green-500/30"
                        : rev.action === "delete" ? "border-red-500 bg-red-500/30"
                        : "border-accent bg-accent/30",
                    ].join(" ")}
                  />
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className={[
                          "text-[11px] font-medium capitalize",
                          rev.action === "create" ? "text-green-400"
                            : rev.action === "delete" ? "text-red-400"
                            : "text-accent",
                        ].join(" ")}
                      >
                        {rev.action}
                      </span>
                      {rev.user && (
                        <span className="ml-1.5 text-[11px] text-gray-500">
                          by {rev.user.email}
                        </span>
                      )}
                    </div>
                    <time className="shrink-0 text-[10px] text-gray-600">
                      {new Date(rev.createdAt).toLocaleString()}
                    </time>
                  </div>

                  {/* Diff summary */}
                  {rev.action === "update" && !!rev.beforeJson && !!rev.afterJson && (
                    <DiffSummary
                      before={rev.beforeJson as Record<string, unknown>}
                      after={rev.afterJson as Record<string, unknown>}
                    />
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Diff summary ─────────────────────────────────────────────────────────────

function DiffSummary({
  before,
  after,
}: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}) {
  const SKIP_KEYS = new Set(["updatedAt", "createdAt"]);
  const changes: { key: string; from: string; to: string }[] = [];

  for (const key of Object.keys(after)) {
    if (SKIP_KEYS.has(key)) continue;
    const bVal = JSON.stringify(before[key]);
    const aVal = JSON.stringify(after[key]);
    if (bVal !== aVal) {
      changes.push({ key, from: bVal ?? "—", to: aVal ?? "—" });
    }
  }

  if (changes.length === 0) return null;

  return (
    <ul className="mt-1.5 space-y-1">
      {changes.slice(0, 6).map(({ key, from, to }) => (
        <li key={key} className="text-[10px] text-gray-500">
          <span className="font-mono text-gray-400">{key}</span>:{" "}
          <span className="text-red-400/80 line-through">{truncate(from)}</span>
          {" → "}
          <span className="text-green-400/80">{truncate(to)}</span>
        </li>
      ))}
      {changes.length > 6 && (
        <li className="text-[10px] text-gray-600">+{changes.length - 6} more changes</li>
      )}
    </ul>
  );
}

function truncate(s: string, max = 40): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
