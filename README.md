# DJ Media Console

Keyboard-triggered VJ app. Assign video clips to keys in the mapping window;
pressing a key crossfades an A/B deck pair from the current clip to the new
one, output fullscreen on a second display (projector).

## Status

This is **Phase 1 of the planned build**, plus the key-assignment portal
pulled forward from Phase 2 because that's the immediately useful part:

- ✅ Load/assign clips to keys via a UI (no manual JSON editing needed)
- ✅ A/B deck crossfade, configurable 0–2000ms
- ✅ Preload/validate all clips at startup with a progress screen; missing or
      corrupt clips are skipped and logged, never crash the app
- ✅ Fullscreen output on a chosen display, with hotplug recovery if the
      projector disconnects/reconnects mid-set
- ✅ Spacebar blackout toggle (same crossfade)
- ✅ Escape exits fullscreen without quitting the app

**Not built yet** (planned next, per the original spec):
- Modifier layers (shift/ctrl banks), per-clip loop/speed/in-out points
- Operator display (thumbnail grid, FPS/dropped-frame counter, next-up preview)
- MIDI input + learn mode
- Windows packaging (electron-builder portable build, release script, the
  all-intra H.264 ffmpeg conversion script)

Right now clips can be **any** video format Chromium can play (mp4/mov/mkv/
webm with H.264/H.265/VP9). For actual live use later, converting to
all-intra H.264 (short GOPs) is what makes seeking/triggering instant — that
conversion script is part of the Phase 5 packaging work, not needed yet for
testing on your laptop.

## Running it

```
npm install
npm start
```

A "DJ Media Console" window opens. This is the mapping window — it stays on
your laptop screen, never goes on the projector.

## Using it

1. **Assign clips**: click any key tile, pick a video file. It's saved
   immediately to `config/config.json` (gitignored, per-machine).
2. **Set crossfade duration**: slider at the top, 0–2000ms, default 400ms.
3. **Pick the output display**: dropdown at the top. "Auto" picks the first
   non-primary display it finds (i.e. your projector) — leave it on Auto
   unless you have more than two displays.
4. **Launch Output**: opens a second, borderless window and makes it
   fullscreen on the chosen display. It shows a brief "validating clips"
   screen, then black (or your first triggered clip).
5. **Play**: with the mapping window focused, press any mapped key. It
   crossfades on the output display. Press the same key again to restart
   that clip from the top (no crossfade — it's already live).
6. **Blackout**: press Space (or the Blackout button) to fade to black;
   press again to fade back to whatever's live.
7. **Escape** (while the output window is focused) drops it out of
   fullscreen without closing the app or losing your mappings — useful if
   the projector needs troubleshooting mid-set. Click Launch Output again to
   restore fullscreen.

## Notes

- `config/config.json` is per-machine and gitignored on purpose — see the
  original spec's reasoning: machines shouldn't overwrite each other's key
  mappings if you ever run this on more than one laptop.
- The `media/` folder is provided as a convenient place to keep your test
  clips, but the file picker lets you assign a clip from anywhere on disk —
  paths are stored absolute for now. Phase 5 packaging will switch this to
  paths relative to the app so a USB stick works across drive letters.
- If a display disconnects while live, the output window is parked
  (windowed) on your primary screen instead of vanishing off-canvas; when it
  reconnects it automatically goes back to fullscreen — no restart needed.
