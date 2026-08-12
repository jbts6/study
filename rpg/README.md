# Python RPG

## Requirements

- Node.js 24.15.0
- CPython 3.12 or newer available as `python`, `python3`, or `py -3`

## Start

Terminal 1:

```bash
npm run runner
```

Terminal 2:

```bash
npm run dev
```

Open `http://127.0.0.1:5174`.

## Local Code Boundary

Python is edited in the local browser and sent only to `ws://127.0.0.1:5175`. The local Node Runner starts a local CPython process. Code is not sent to a remote service.

## Save and Reset

The single V1 save is stored in browser `localStorage` under `python-rpg.save`. Reset requires typing `重置存档` exactly before execution.
