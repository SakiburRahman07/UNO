# UNO Arena — Play UNO Online With Friends

Fast, fun and competitive **real-time multiplayer UNO** built with Next.js 16 and Socket.IO. Create a room, share the code, and play together live — with optional AI bots to fill any empty seat.

> Premium, esports-inspired UI · full UNO rules · server-validated gameplay · in-memory rooms (no database).

---

## Features

- **Real-time multiplayer** over Socket.IO — create a room, get a unique code, invite friends, play live.
- **Full UNO rules** (server-validated): Skip, Reverse, Draw Two, Wild, Wild Draw Four, draw stacking, direction, and the **UNO call + penalty** (forgot-UNO catch).
- **AI bots** that fill seats so a single player can start a full game instantly. Bots take auto-turns, pick wild colors, and auto-call UNO.
- **Stunning landing page** — animated gradient backdrop, floating UNO cards, particle field, glassmorphism, neon accents, Framer Motion transitions.
- **Premium game table** — opponent seats with turn glow, animated discard pile, active-color ring, direction indicator, a fanned hand with hover-lift + glow, and a pulsing **UNO!** button.
- **Animations** — card fly-in/place, turn highlight pulse, winner confetti, room-join entrance, smooth page transitions.
- **Sound effects** — synthesized via the Web Audio API (click, play, draw, turn, win, UNO) with a mute toggle. No audio assets required.
- **Responsive** — full board on desktop, adaptive on tablet, swipeable horizontal hand + touch-friendly cards on mobile.
- **Dark / light gaming theme** toggle, copy-room-code, player rankings, winner screen, restart, and leave room.
- **Reconnect-friendly** — refresh mid-game and you rejoin your seat (disconnected players are auto-played until they return).

---

## Tech stack

| Layer | Tech |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 (CSS-first `@theme`), shadcn-style components on Radix primitives |
| Animation | Framer Motion |
| Icons | Lucide React |
| Real-time | Socket.IO (server + client) |
| Confetti | canvas-confetti |
| Runtime | Custom Next.js server (single process, in-memory state) |

No database. All rooms and games live **in server memory** and reset when the server restarts.

---

## Getting started

**Prerequisites:** Node.js 20.9+ (tested on Node 22) and npm.

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server (Next.js + Socket.IO on the same port :3000)
npm run dev
```

Open <http://localhost:3000>.

```bash
# Production build & run
npm run build
npm start          # serves the built app + Socket.IO on :3000
```

### Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Custom server (`tsx watch server/index.ts`) — Next dev + Socket.IO on :3000 |
| `npm run build` | Production build (`next build`) |
| `npm start` | Run the production custom server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

---

## How to play

1. **Create a room** (enter your name) or **Join a room** (enter the code + your name).
2. In the **lobby**, the host can **add bots** and everyone readies up. The host clicks **Start Game** (needs ≥ 2 players, all ready).
3. On the **game table**:
   - Click a glowing card in your hand to play it (only legal cards glow on your turn).
   - Click the **draw pile** to draw a card. If the drawn card is playable you may play it, otherwise your turn passes. Use **Pass** after drawing.
   - When a **Wild / Wild Draw Four** is played, pick the next color.
   - When you reach **one card**, press the pulsing **UNO!** button to declare. If you forget, you draw a 2-card penalty — and opponents can catch you!
   - Draw stacks: when a Draw Two / Wild Draw Four is played, stack a matching draw card to pass it on, or draw the accumulated total.
4. First player to empty their hand **wins**. The host can **Play again** from the winner screen.

---

## Architecture

A single Node process hosts **both** Next.js and Socket.IO on port `:3000` (`server/index.ts`). The server is the single source of truth: every action is validated server-side, and clients receive authoritative `game:state` snapshots.

```
Browser ──socket.io──► server/socket.ts ──► roomManager.ts / gameEngine.ts
        (HTTP) Next.js app router pages (landing / lobby / game)
```

- `server/unoRules.ts` — pure rules: 108-card deck, `canPlay`, card effects, draw/reshuffle, bot heuristics.
- `server/roomManager.ts` — rooms, players, host transfer, ready state, reconnect, graceful disconnect.
- `server/gameEngine.ts` — the game state machine: start/play/draw/pass/uno/win/restart, bot turns, win detection, public-state projection.
- `server/socket.ts` — event wiring + bot/auto-play scheduling.
- `server/index.ts` — boots `http` + Socket.IO + Next.js request handler.

### Socket.IO events

**Client → Server**
`room:create`, `room:join`, `room:leave`, `room:toggle-ready`, `room:add-bot`, `room:kick`, `game:start`, `card:play`, `card:draw`, `turn:pass`, `color:choose`, `uno:call`, `game:restart`

**Server → Client**
`room:created`, `room:joined`, `room:update`, `game:state`, `game:started`, `game:end`, `uno:called`, `player:joined`, `error`

Request/response actions use Socket.IO **acknowledgements**; state updates are broadcast as snapshots tailored to each viewer (other players' hands are hidden).

---

## Project structure

```
UNO/
├─ app/
│  ├─ layout.tsx               # root layout, fonts, theme + toaster
│  ├─ page.tsx                 # landing page (hero, create/join)
│  ├─ globals.css              # Tailwind v4 theme tokens + utilities
│  ├─ lobby/[code]/page.tsx    # room lobby
│  └─ game/[code]/page.tsx     # game board
├─ components/
│  ├─ ui/                      # button, input, card, badge, dialog, tooltip, avatar, label, toaster
│  ├─ cards/                   # UnoCard, CardBack
│  ├─ game/                    # FloatingCards, ParticleField, PlayerSeat, ColorPicker, UnoButton, WinnerModal
│  └─ theme-provider.tsx
├─ server/
│  ├─ index.ts                 # custom server bootstrap
│  ├─ socket.ts                # socket event handlers + bot scheduling
│  ├─ roomManager.ts           # rooms & players (in-memory)
│  ├─ gameEngine.ts            # game state machine
│  └─ unoRules.ts              # deck + rules (pure)
├─ hooks/                      # useSocket, useRoom, useGameState, useSound
├─ lib/                        # socket client, utils, constants
├─ types/uno.ts                # shared domain types + socket event maps
├─ scripts/                    # dev test harnesses (engine + socket e2e)
├─ Dockerfile  .dockerignore
└─ README.md
```

---

## Constraints & deployment

- **In-memory only** — no database. Rooms and games exist only in the server process and **reset on restart** (by design).
- **Single instance** — because state lives in memory, deploy as a **single process**. Do **not** deploy to serverless (e.g. Vercel functions) or scale horizontally; state would not be shared. Use a VPS / Render / Railway / Fly / Docker container.

### Docker

```bash
docker build -t uno-arena .
docker run -p 3000:3000 uno-arena
# → http://localhost:3000
```

---

## Testing

Two dev harnesses validate the gameplay without a browser:

```bash
npx tsx scripts/test-engine.ts   # 40+ full games (1–5 bots) via the pure engine
npx tsx scripts/test-socket.ts    # full Socket.IO round-trip with a live server on :3000
```

To run the socket test, start the server first (`npm run dev` in another terminal), then run the script. It creates a room, adds bots, starts, plays a complete game through the network, and asserts a winner is produced.

---

## Notes

- Type-checked with `tsc --noEmit` and production-built with `next build` (both clean).
- Card visuals use CSS container queries so they scale crisply at any size.
- Sounds are synthesized at runtime (Web Audio API) — no copyrighted audio assets are bundled.
