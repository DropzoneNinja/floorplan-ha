# Music Assistant Overview

A single speaker icon representing every Music Assistant player in the house. Tap to reveal each configured speaker location on the floorplan, showing live now-playing info, transport controls, and volume. Tap a speaker's card for a bigger control view.

## Entity

Not required on the hotspot itself. This hotspot manages its own list of speaker locations, each bound to one Music Assistant `media_player.*` entity.

## Settings

| Setting | Description |
|---------|-------------|
| Items | List of speaker locations to monitor and control (see below) |
| Background Color | Button background color (`transparent` to hide) |

### Adding a speaker

Each item in the list has:

| Field | Description |
|-------|-------------|
| Location name | Display name for the speaker (e.g. "Living Room") |
| Position (X, Y) | Where the speaker sits on the floorplan (0–1, as a fraction of width/height) |
| Media player entity | The Music Assistant-provided `media_player.*` entity for this speaker |

## Tips

- The aggregate icon shows a thumbnail of whatever's playing at the first active speaker it finds; otherwise it shows a plain speaker glyph.
- Each card on the overlay shows track/artist, play/pause, previous/next, and a volume slider — no need to open the dialog just to check what's playing or adjust volume.
- Tapping a card opens a bigger control view with the same controls at a larger touch target, plus Browse (library/playlists/search), Move/Group, and Queue.
- The Queue view shows a scrolling list of up to 50 upcoming tracks, fetched directly from the Music Assistant server (set `MA_BASE_URL`/`MA_TOKEN` — see the root `README.md`). Without those configured, it falls back to showing just the current and next track, since Home Assistant's own `music_assistant.get_queue` service doesn't expose the full queue.
- Browse also requires `MA_BASE_URL`/`MA_TOKEN` — it talks to the Music Assistant server directly, since Home Assistant's `media_player.browse_media` silently caps every folder around 500 items with no way to page further. Root categories, playlists, and album/artist drill-down all support "Load more" for large libraries.
- If two speakers sit close together on the floorplan, nudge their positions apart while placing them — cards don't auto-avoid each other.
