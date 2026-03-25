# State Image

Shows a different image depending on whether an entity is on or off (e.g. a lit-up room vs a dark room).

## Entity

Required. Any binary entity (on/off, open/closed, etc.).

## Settings

| Setting | Description |
|---------|-------------|
| On Image | Image shown when the entity is "on" / "open" |
| Off Image | Image shown when the entity is "off" / "closed" |
| Animation | Transition style when switching: `none`, `fade`, or `crossfade` |
| Stretch to Fit | Stretch the image to fill the hotspot area (default: preserve aspect ratio) |

## Tips

- Use **crossfade** for a smooth transition between states.
- Images are selected from your uploaded assets.
- Use **State Rules** for more than two states (e.g. multiple images for different values).
