# Scent Scribe — Curtain Hero Preview

This is an isolated experiment on branch `curtain-hero-preview`. The existing `main` branch has not been changed.

## Preview path

After deploying this branch through the existing **Deploy to GitHub Pages** workflow, open:

`https://flowrian2026-max.github.io/scent-smoke-carousel/curtain-hero/`

## Manual deploy

1. Open **Actions** in this repository.
2. Choose **Deploy to GitHub Pages**.
3. Press **Run workflow**.
4. Select branch **curtain-hero-preview** and run it.
5. Wait for the workflow to complete, then open the preview path above.

The existing workflow builds the Vite project into `dist`; Vite copies `public/curtain-hero/` into `dist/curtain-hero/`.

## Current prototype scope

- Two separate velvet curtain panels open from the center.
- Three selectable fragrance bottles are shown on dark metallic plinths with silver detailing.
- Selecting a bottle opens a compact glass-style fragrance details panel.
- Replay and skip controls are included.
- Environment-video and smoke-video elements are separate and ready for media paths.

## Not connected / not verified yet

The two video elements intentionally have empty `data-video-src` values. No real environment footage or smoke footage has been connected yet; the atmospheric light is only a visual placeholder. This page has not been build-tested or deployed from GitHub Actions yet.

The existing ocean bottle-breaking intro and the read-only `Midnight-file-test` media archive remain separate and untouched.
