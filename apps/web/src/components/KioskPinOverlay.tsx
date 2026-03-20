import { useState } from "react";

interface KioskPinOverlayProps {
  /** The correct PIN string (e.g. "1234"). Empty/null means PIN is disabled. */
  correctPin: string | null;
  onUnlock: () => void;
  onDismiss: () => void;
}

/**
 * PIN entry overlay shown when the user attempts to access admin features
 * from the kiosk presentation screen.
 *
 * Tap anywhere outside the pad to dismiss without unlocking.
 */
export function KioskPinOverlay({ correctPin, onUnlock, onDismiss }: KioskPinOverlayProps) {
  const [entered, setEntered] = useState("");
  const [error, setError] = useState(false);

  const handleDigit = (d: string) => {
    setError(false);
    const next = (entered + d).slice(0, 8); // max 8 digits
    setEntered(next);

    if (correctPin && next === correctPin) {
      onUnlock();
    } else if (correctPin && next.length >= correctPin.length) {
      setError(true);
      setEntered("");
    }
  };

  const handleClear = () => {
    setEntered("");
    setError(false);
  };

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onDismiss}
    >
      {/* Stop propagation so clicks inside the pad don't dismiss */}
      <div
        className="flex flex-col items-center gap-5 rounded-2xl bg-surface p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-medium text-gray-300">Enter Admin PIN</p>

        {/* PIN dots */}
        <div className="flex gap-3">
          {Array.from({ length: Math.max(4, (correctPin ?? "1234").length) }).map((_, i) => (
            <span
              key={i}
              className={[
                "h-3 w-3 rounded-full border-2 transition-colors",
                i < entered.length ? "border-accent bg-accent" : "border-gray-600 bg-transparent",
                error ? "border-red-400 bg-red-400" : "",
              ].filter(Boolean).join(" ")}
            />
          ))}
        </div>

        {error && <p className="text-xs text-red-400">Incorrect PIN</p>}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3">
          {digits.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-white hover:bg-white/20 active:scale-95 transition-transform"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-xs text-gray-400 hover:bg-white/10"
          >
            Clear
          </button>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-gray-600 hover:text-gray-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
