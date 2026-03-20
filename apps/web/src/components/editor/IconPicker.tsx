import { ICON_PATHS, ICON_CATEGORIES } from "../../hotspots/icons.ts";

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

/**
 * Scrollable grid of MDI icons organised by home-automation category.
 * Clicking an icon selects it; the selected icon is highlighted.
 */
export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="flex max-h-56 flex-col gap-3 overflow-y-auto pr-1">
      {ICON_CATEGORIES.map((category) => (
        <div key={category.label}>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            {category.label}
          </p>
          <div className="grid grid-cols-6 gap-1">
            {category.icons.map(({ key, label }) => {
              const path = ICON_PATHS[key] ?? ICON_PATHS["default"];
              const isSelected = value === key;
              return (
                <button
                  key={key}
                  type="button"
                  title={`${label} (${key})`}
                  onClick={() => onChange(key)}
                  className={[
                    "flex flex-col items-center gap-0.5 rounded p-1 transition-colors",
                    isSelected
                      ? "bg-accent/30 ring-1 ring-accent"
                      : "hover:bg-white/10",
                  ].join(" ")}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5 shrink-0"
                    aria-hidden="true"
                  >
                    <path
                      d={path}
                      fill={isSelected ? "rgb(251 191 36)" : "currentColor"}
                    />
                  </svg>
                  <span className="w-full truncate text-center text-[9px] leading-tight text-gray-400">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
