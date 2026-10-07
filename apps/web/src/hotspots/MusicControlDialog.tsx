import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import type { MusicSpeaker } from "@floorplan-ha/shared";
import type { MusicLibraryMediaType } from "../api/client.ts";
import { api } from "../api/client.ts";
import { useToastStore } from "../store/toast.ts";
import { ICON_PATHS } from "./icons.ts";
import { MusicBrowseView } from "./MusicBrowseView.tsx";
import { MusicMoveView } from "./MusicMoveView.tsx";
import { MusicNowPlaying } from "./MusicNowPlaying.tsx";
import { MusicQueueView } from "./MusicQueueView.tsx";

type PanelTab = "queue" | "browse" | "speakers";

const PANEL_TABS: Array<{ id: PanelTab; label: string }> = [
  { id: "queue", label: "Queue" },
  { id: "browse", label: "Browse" },
  { id: "speakers", label: "Speakers" },
];

interface MusicControlDialogProps {
  item: MusicSpeaker;
  /** Every speaker configured on this hotspot, including `item` itself — used by the speaker switcher and move/group panel. */
  allSpeakers: MusicSpeaker[];
  /** Switch straight to a different speaker's dialog (e.g. after transferring playback to it). */
  onSwitchSpeaker: (speakerId: string) => void;
  onClose: () => void;
}

/**
 * Large player dialog opened by tapping a speaker card on the floorplan. Takes
 * up to 80% of the viewport: the left column shows the now-playing card with
 * transport, progress, and volume; the right column holds the play queue, the
 * Music Assistant library browser, and move/group controls.
 */
export function MusicControlDialog({
  item,
  allSpeakers,
  onSwitchSpeaker,
  onClose,
}: MusicControlDialogProps) {
  const [panel, setPanel] = useState<PanelTab>("queue");
  // Each browse request bumps `id` so MusicBrowseView remounts and opens at the requested category.
  const [browseRequest, setBrowseRequest] = useState<{
    id: number;
    category: MusicLibraryMediaType | undefined;
  }>({
    id: 0,
    category: undefined,
  });
  const [speakerMenuOpen, setSpeakerMenuOpen] = useState(false);
  // Clearing the queue is a two-step action: the first Clear click asks for confirmation.
  const [confirmingClear, setConfirmingClear] = useState(false);
  const addToast = useToastStore((s) => s.addToast);
  const entityId = item.entityId ?? "";
  const hasEntity = !!item.entityId;

  // Detect whether this entity is actually a Music Assistant player (vs. e.g. the
  // native Sonos/Cast entity for the same physical speaker). Music Assistant's own
  // browse root always reports media_content_type "music_assistant"; anything else
  // means Browse/Search/Queue/Move will misbehave or fail outright against it, so
  // this is surfaced as a persistent banner rather than left for the user to
  // discover as a string of silent-looking failures.
  const rootCheck = useQuery({
    queryKey: ["music-root-check", entityId],
    queryFn: () => api.ha.browseMedia(entityId),
    enabled: entityId !== "",
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const maCheckDone = rootCheck.isSuccess || rootCheck.isError;
  const isMusicAssistantPlayer = rootCheck.data?.media_content_type === "music_assistant";

  const otherSpeakers = allSpeakers.filter((s) => s.id !== item.id);

  const openBrowse = (category?: MusicLibraryMediaType) => {
    setBrowseRequest((r) => ({ id: r.id + 1, category }));
    setPanel("browse");
  };

  const clearQueue = async () => {
    try {
      await api.ha.callService("media_player", "clear_playlist", { target: { entityId } });
    } catch (err) {
      addToast(
        `Couldn't clear queue: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error",
      );
    }
  };

  const modal = (
    <div
      className="fixed inset-0 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      // MusicOverlayLayer's backdrop (the speaker cards behind this dialog) sits at
      // triggeredByZIndex + 1000 so it can beat other in-canvas hotspots — this modal
      // must always beat *that*, so it needs more headroom than the codebase's usual
      // z-50 modal convention (fine for other dialogs, since none of them compete with
      // an elevated in-canvas overlay like this one does).
      style={{ zIndex: 5000 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* 80% of the viewport on desktop; on phones it's a full-width bottom sheet at the same height. */}
      <div
        className="flex h-[80vh] w-full flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-surface-raised shadow-2xl sm:w-[80vw] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0 text-accent" aria-hidden="true">
              <path d={ICON_PATHS["mdi:music-note"]} fill="currentColor" />
            </svg>
            <h2 className="hidden truncate text-xl font-semibold text-white sm:block">Music Assistant</h2>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="relative">
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={speakerMenuOpen}
                disabled={allSpeakers.length < 2}
                onClick={() => setSpeakerMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-base text-white hover:bg-white/10 disabled:opacity-60"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
                  <path d={ICON_PATHS["mdi:speaker"]} fill="currentColor" />
                </svg>
                <span className="max-w-[12rem] truncate">{item.name}</span>
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
                  <path d={ICON_PATHS["mdi:chevron-down"]} fill="currentColor" />
                </svg>
              </button>
              {speakerMenuOpen && (
                <ul
                  role="listbox"
                  className="absolute right-0 top-full z-10 mt-2 min-w-[12rem] overflow-hidden rounded-lg border border-white/10 bg-surface-raised py-1 shadow-xl"
                >
                  {allSpeakers.map((speaker) => {
                    const isCurrent = speaker.id === item.id;
                    return (
                      <li key={speaker.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={isCurrent}
                          onClick={() => {
                            setSpeakerMenuOpen(false);
                            if (!isCurrent) onSwitchSpeaker(speaker.id);
                          }}
                          className={[
                            "block w-full px-4 py-2 text-left text-base hover:bg-white/10",
                            isCurrent ? "text-accent" : "text-white",
                          ].join(" ")}
                        >
                          {speaker.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                <path d={ICON_PATHS["mdi:close"]} fill="currentColor" />
              </svg>
            </button>
          </div>
        </header>

        {maCheckDone && !isMusicAssistantPlayer && (
          <div className="mx-6 mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] leading-snug text-amber-300">
            <strong className="font-semibold">Not linked to Music Assistant.</strong> {entityId} is
            browsing its own native menu instead of your Music Assistant library — Browse, Queue,
            and Speakers won't work here. Rebind this speaker to its Music-Assistant-provided entity
            in the hotspot's Actions tab (it's usually a differently-numbered entity with the same
            room name).
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          <section className="p-6 lg:min-h-0 lg:w-[58%] lg:overflow-y-auto">
            <MusicNowPlaying
              item={item}
              onBrowse={openBrowse}
              onSpeakers={() => setPanel("speakers")}
            />
          </section>

          <aside className="flex min-h-[420px] flex-col border-t border-white/10 bg-black/20 p-6 lg:min-h-0 lg:flex-1 lg:border-l lg:border-t-0">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div
                role="tablist"
                aria-label="Music panels"
                className="flex gap-1 rounded-xl bg-white/5 p-1"
              >
                {PANEL_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={panel === tab.id}
                    disabled={!hasEntity && tab.id !== "speakers"}
                    onClick={() => {
                      setPanel(tab.id);
                      setConfirmingClear(false);
                    }}
                    className={[
                      "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-40",
                      panel === tab.id
                        ? "bg-white/15 text-white"
                        : "text-gray-400 hover:text-white",
                    ].join(" ")}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {panel === "queue" && hasEntity && confirmingClear && (
                <div className="flex items-center gap-1 text-sm">
                  <span className="px-2 text-gray-300">Clear queue?</span>
                  <button
                    type="button"
                    onClick={() => setConfirmingClear(false)}
                    className="rounded-lg px-2 py-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingClear(false);
                      void clearQueue();
                    }}
                    className="rounded-lg bg-red-500/80 px-3 py-1.5 font-medium text-white hover:bg-red-500"
                  >
                    Clear
                  </button>
                </div>
              )}
              {panel === "queue" && hasEntity && !confirmingClear && (
                <button
                  type="button"
                  onClick={() => setConfirmingClear(true)}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-gray-400 hover:bg-white/10 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path d={ICON_PATHS["mdi:trash-can-outline"]} fill="currentColor" />
                  </svg>
                  Clear
                </button>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col" role="tabpanel">
              {panel === "queue" && hasEntity && <MusicQueueView entityId={entityId} />}
              {panel === "browse" && hasEntity && (
                <MusicBrowseView
                  key={browseRequest.id}
                  entityId={entityId}
                  initialCategory={browseRequest.category}
                  onPlayed={() => setPanel("queue")}
                />
              )}
              {panel === "speakers" && (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <MusicMoveView
                    current={item}
                    otherSpeakers={otherSpeakers}
                    onTransferred={onSwitchSpeaker}
                    onDone={() => setPanel("queue")}
                  />
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
