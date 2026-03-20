import { create } from "zustand";
import type { HotspotRaw, StateRuleRaw } from "../hotspots/types.ts";

/**
 * Mutable fields that can be changed in the editor and saved back to the server.
 * Omits immutable identity fields and server-managed timestamps.
 *
 * `_pendingRules` is a special field that holds state rules to be saved via
 * PUT /api/hotspots/:id/rules on the next save. It is stripped before the
 * PATCH call.
 */
export type HotspotDraft = Partial<
  Pick<HotspotRaw, "name" | "entityId" | "x" | "y" | "width" | "height" | "rotation" | "zIndex" | "configJson">
> & {
  _pendingRules?: StateRuleRaw[];
};

/** A single undoable editor action — stores the full drafts snapshot before the change. */
interface HistoryEntry {
  drafts: Record<string, HotspotDraft>;
}

const HISTORY_MAX_DEPTH = 50;

interface EditorStore {
  /** Currently selected hotspot id, or null if nothing is selected */
  selectedId: string | null;

  /** Pending unsaved changes per hotspot id */
  drafts: Record<string, HotspotDraft>;

  /**
   * Preview mode: hide edit handles but keep live HA state active.
   * Lets the editor preview what presentation mode will look like.
   */
  isPreviewMode: boolean;

  /** Undo history stack (past states, oldest first) */
  undoStack: HistoryEntry[];

  /** Redo history stack (future states, most-recent first) */
  redoStack: HistoryEntry[];

  selectHotspot: (id: string | null) => void;
  updateDraft: (id: string, changes: HotspotDraft) => void;
  /** Update draft without recording an undo entry — use during continuous drag/resize moves */
  updateDraftSilent: (id: string, changes: HotspotDraft) => void;
  /** Snapshot the current drafts onto the undo stack — call once at drag/resize start */
  pushUndo: () => void;
  discardDraft: (id: string) => void;
  discardAllDrafts: () => void;
  hasDirtyChanges: () => boolean;
  getDraft: (id: string) => HotspotDraft;
  setPreviewMode: (v: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  selectedId: null,
  drafts: {},
  isPreviewMode: false,
  undoStack: [],
  redoStack: [],

  selectHotspot: (id) => set({ selectedId: id }),

  updateDraft: (id, changes) =>
    set((prev) => {
      const newUndoStack = [
        ...prev.undoStack.slice(-(HISTORY_MAX_DEPTH - 1)),
        { drafts: prev.drafts },
      ];
      return {
        drafts: { ...prev.drafts, [id]: { ...prev.drafts[id], ...changes } },
        undoStack: newUndoStack,
        redoStack: [],
      };
    }),

  updateDraftSilent: (id, changes) =>
    set((prev) => ({
      drafts: { ...prev.drafts, [id]: { ...prev.drafts[id], ...changes } },
    })),

  pushUndo: () =>
    set((prev) => ({
      undoStack: [...prev.undoStack.slice(-(HISTORY_MAX_DEPTH - 1)), { drafts: prev.drafts }],
      redoStack: [],
    })),

  discardDraft: (id) =>
    set((prev) => {
      const next = { ...prev.drafts };
      delete next[id];
      return { drafts: next };
    }),

  discardAllDrafts: () => set({ drafts: {}, undoStack: [], redoStack: [] }),

  hasDirtyChanges: () => Object.keys(get().drafts).length > 0,

  getDraft: (id) => get().drafts[id] ?? {},

  setPreviewMode: (v) => set({ isPreviewMode: v }),

  undo: () =>
    set((prev) => {
      if (prev.undoStack.length === 0) return prev;
      const entry = prev.undoStack[prev.undoStack.length - 1];
      if (!entry) return prev;
      const newUndoStack = prev.undoStack.slice(0, -1);
      const newRedoStack = [{ drafts: prev.drafts }, ...prev.redoStack];
      return {
        drafts: entry.drafts,
        undoStack: newUndoStack,
        redoStack: newRedoStack.slice(0, HISTORY_MAX_DEPTH),
      };
    }),

  redo: () =>
    set((prev) => {
      if (prev.redoStack.length === 0) return prev;
      const entry = prev.redoStack[0];
      if (!entry) return prev;
      const newRedoStack = prev.redoStack.slice(1);
      const newUndoStack = [...prev.undoStack, { drafts: prev.drafts }];
      return {
        drafts: entry.drafts,
        undoStack: newUndoStack.slice(-HISTORY_MAX_DEPTH),
        redoStack: newRedoStack,
      };
    }),

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,
}));

/**
 * Merge a hotspot's server state with any pending draft changes.
 * The result reflects what the hotspot currently looks like in the editor.
 * Internal draft-only fields (prefixed with `_`) are stripped.
 */
export function applyDraft(hotspot: HotspotRaw, draft: HotspotDraft): HotspotRaw {
  const { _pendingRules, ...renderableDraft } = draft;
  return { ...hotspot, ...renderableDraft };
}
