import type { BurnOffConfig } from "@floorplan-ha/shared";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

interface BurnOffScheduleModalProps {
  config: BurnOffConfig;
  totalFireban: boolean;
  onClose: () => void;
}

/** Returns a local YYYY-MM-DD string (not UTC) for the given date. */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(dateStr: string): string {
  // YYYY-MM-DD → e.g. "1 May 2026"
  const parts = dateStr.split("-").map(Number);
  const [y, mo, d] = [parts[0] ?? 0, parts[1] ?? 1, parts[2] ?? 1];
  return new Date(y, mo - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function BurnOffScheduleModal({
  config,
  totalFireban,
  onClose,
}: BurnOffScheduleModalProps) {
  const today = new Date();
  const todayStr = localDateStr(today);
  const todayDow = today.getDay(); // 0 = Sunday

  const allowedDays = config.allowedDays ?? [];
  const noBurnPeriods = config.noBurnPeriods ?? [];

  const inNoBurnPeriod = noBurnPeriods.some(
    (p) => todayStr >= p.from && todayStr <= p.to,
  );
  const isBurnDay = !inNoBurnPeriod && allowedDays.includes(todayDow);

  // Determine status badge
  let statusLabel: string;
  let statusClass: string;
  if (totalFireban) {
    statusLabel = "Total Fire Ban active";
    statusClass = "bg-red-500/20 text-red-300 border border-red-500/40";
  } else if (inNoBurnPeriod) {
    statusLabel = "No-burn period active";
    statusClass = "bg-amber-500/20 text-amber-300 border border-amber-500/40";
  } else if (isBurnDay) {
    statusLabel = "Burn-off permitted today";
    statusClass = "bg-green-500/20 text-green-300 border border-green-500/40";
  } else {
    statusLabel = "No burn-off today";
    statusClass = "bg-gray-500/20 text-gray-400 border border-white/10";
  }

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-lg flex-col rounded-t-2xl bg-surface-raised sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-8 py-6">
          <h2 className="text-xl font-semibold text-white">Burn-off Schedule</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-6 p-8">
          {/* Status badge */}
          <div
            className={[
              "w-full rounded-lg px-4 py-3 text-center text-base font-medium",
              statusClass,
            ].join(" ")}
          >
            {statusLabel}
          </div>

          {/* Weekly schedule */}
          <div>
            <p className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-500">
              Permitted days
            </p>
            <div className="flex justify-between gap-1.5">
              {DAY_LABELS.map((label, dow) => {
                const isAllowed = allowedDays.includes(dow);
                const isToday = dow === todayDow;
                return (
                  <div key={dow} className="flex flex-1 flex-col items-center gap-2">
                    <span
                      className={[
                        "text-sm font-medium",
                        isToday ? "text-white" : "text-gray-500",
                      ].join(" ")}
                    >
                      {label}
                    </span>
                    <div
                      className={[
                        "flex h-12 w-full items-center justify-center rounded-md text-base font-semibold transition-colors",
                        isAllowed && !inNoBurnPeriod
                          ? "bg-accent/20 text-accent ring-1 ring-accent/40"
                          : "bg-white/5 text-gray-600",
                        isToday ? "ring-2 ring-white/30" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {isAllowed && !inNoBurnPeriod ? "✓" : "–"}
                    </div>
                    {isToday && (
                      <span className="text-xs font-semibold text-white/60">
                        TODAY
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* No-burn periods */}
          {noBurnPeriods.length > 0 && (
            <div>
              <p className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-500">
                No-burn periods
              </p>
              <ul className="space-y-2">
                {noBurnPeriods.map((p, i) => {
                  const isActive = todayStr >= p.from && todayStr <= p.to;
                  return (
                    <li
                      key={i}
                      className={[
                        "flex items-center justify-between rounded-md px-4 py-3 text-sm",
                        isActive
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-white/5 text-gray-400",
                      ].join(" ")}
                    >
                      <span>
                        {formatDate(p.from)} – {formatDate(p.to)}
                      </span>
                      {isActive && (
                        <span className="rounded bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-300">
                          Active
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
