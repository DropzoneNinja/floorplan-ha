import { useToastStore } from "../store/toast.ts";

const TYPE_STYLES = {
  error: "bg-red-900/90 text-red-100 border-red-700",
  success: "bg-green-900/90 text-green-100 border-green-700",
  info: "bg-surface-overlay/90 text-gray-200 border-gray-600",
} as const;

/**
 * Global toast notification container.
 * Mount once at the app root — toasts are triggered via useToastStore.
 */
export function Toaster() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      className="fixed bottom-6 left-1/2 z-[200] flex -translate-x-1/2 flex-col items-center gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm shadow-xl backdrop-blur-sm transition-all ${TYPE_STYLES[toast.type]}`}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss"
            className="ml-1 opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
