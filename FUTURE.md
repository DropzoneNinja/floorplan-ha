Battery display.

Water tank

AI?

Cameras?




The fix for future migrations is to run:
----------------------------------------
docker compose build migrate && docker compose run --rm migrate
or use --force-recreate when you know there are new migrations:

docker compose up --build --force-recreate -d
The windrose hotspot should now work end-to-end.

