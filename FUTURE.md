Water tank

AI?

Cameras?

Make UV legend larger

## Nice-to-Have (Low Priority / Backlog)

- [ ] Theming system (light/dark/custom)
- [ ] Presence-aware dashboard behavior (show/hide hotspots based on who is home)
- [ ] Animated device effects (e.g. fan spinning, TV glow)
- [ ] WebSocket broadcast optimization (only push changed entities to subscribers)
- [ ] Audit trail UI (view revision history in admin)
- [ ] Ambient/screensaver mode with clock or weather widget


The fix for future migrations is to run:
----------------------------------------
docker compose build migrate && docker compose run --rm migrate
or use --force-recreate when you know there are new migrations:

docker compose up --build --force-recreate -d
The windrose hotspot should now work end-to-end.

