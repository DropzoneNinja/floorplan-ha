/**
 * Full-screen dim overlay shown when the user has been inactive.
 * Tapping anywhere dismisses it.
 */
export function ScreensaverOverlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="screensaver-overlay pointer-events-auto absolute inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-black/85"
      onClick={onDismiss}
      onTouchStart={onDismiss}
      aria-label="Screen dimmed — tap to wake"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" || e.key === " " ? onDismiss() : undefined}
    >
      <p className="select-none text-sm text-white/30">Tap to wake</p>
    </div>
  );
}
