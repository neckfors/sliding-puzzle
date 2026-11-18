# Sliding Puzzle

A polished, installable sliding-number puzzle PWA. The classic 4×4 15-puzzle is the default, with 3×3, 5×5 and 6×6 options.

## Features

- Satisfying tile-placement, completed-row and full-puzzle celebrations.
- Move counter, timer, personal bests per board size, undo, reset and shuffle.
- Keyboard arrow controls and touch-friendly tiles.
- Optional synthesized sound, light/dark themes and reduced-motion support.
- Offline play through a service worker; installable as a PWA.
- No build step, framework, backend or external runtime dependency.

## GitHub Pages

Publish the repository from **Settings → Pages → Build and deployment → Deploy from a branch**, selecting `main` and `/(root)`. The app is served at:

https://neckfors.github.io/sliding-puzzle/

The service worker and manifest use relative paths so they work from the project-site subdirectory.

## Add to the games hub

The [neckfors.github.io](https://neckfors.github.io) hub automatically lists public repositories that have GitHub Pages enabled. It places a repository under **Games** when its repository topic includes exactly:

`game`

Add the `game` topic under the repository's **About → Topics** section. The hub also shows its Phone label when it finds `manifest.webmanifest` (included here).

## License

MIT
