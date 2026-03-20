import type { TextConfig } from "@floorplan-ha/shared";
import type { HotspotRendererProps } from "../types.ts";

/**
 * Text/value hotspot: displays a sensor value using a configurable template.
 * Supports `{{state}}` and `{{attr.<name>}}` substitutions.
 * Updates in real time as entity state changes.
 */
export function TextHotspot({ hotspot, entityState, ruleResult }: HotspotRendererProps) {
  const config = hotspot.configJson as TextConfig;

  const template = ruleResult?.textOverride ?? config.template ?? "{{state}}";
  const stateStyle = ruleResult?.styleOverrides ?? {};

  const displayText = renderTemplate(template, entityState);

  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[config.align ?? "center"];

  return (
    <div
      aria-label={hotspot.name}
      role="status"
      aria-live="polite"
      className={`flex h-full w-full items-center justify-center overflow-hidden ${alignClass}`}
      style={{
        fontSize: `${config.fontSize ?? 14}px`,
        color: stateStyle.color ?? config.color ?? "#ffffff",
        opacity: stateStyle.opacity,
        backgroundColor: stateStyle.backgroundColor,
        textShadow: stateStyle.glow ? `0 0 8px ${stateStyle.glow}` : "0 1px 3px rgba(0,0,0,0.8)",
      }}
    >
      <span className="truncate font-medium leading-tight">{displayText}</span>
    </div>
  );
}

/**
 * Render a template string replacing `{{state}}` and `{{attr.<name>}}`.
 */
function renderTemplate(
  template: string,
  entityState: { state: string; attributes: Record<string, unknown> } | undefined,
): string {
  if (!entityState) return template.replace(/\{\{[^}]+\}\}/g, "—");

  return template
    .replace(/\{\{state\}\}/g, entityState.state)
    .replace(/\{\{attr\.([^}]+)\}\}/g, (_, key: string) => {
      const val = entityState.attributes[key];
      return val !== undefined && val !== null ? String(val) : "—";
    });
}
