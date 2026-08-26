import next from "next";
import { createServer } from "node:http";
import { parse } from "node:url";
import { Server } from "socket.io";
import { registerSocketHandlers } from "@/server/socket";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/types/uno";

const dev = process.env.NODE_ENV !== "production";
// Always bind to 0.0.0.0 on cloud platforms — never read HOSTNAME from env,
// some platforms set it to the container hostname which is unreachable externally.
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

// Surface crashes clearly in the Render/fly logs.
process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  process.exit(1);
});

async function main(): Promise<void> {
  console.log(`[unokuet] booting — dev=${dev} port=${port} host=${hostname}`);
  console.log(`[unokuet] NODE_ENV=${process.env.NODE_ENV ?? "(unset)"}`);

  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  let nextReady = false;

  // Create the HTTP server immediately so it can answer health checks
  // before Next.js finishes preparing.
  const httpServer = createServer((req, res) => {
    const url = req.url || "/";

    // Fast health-check response — doesn't wait for Next.js.
    if (url === "/health" || url === "/healthz") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, ready: nextReady }));
      return;
    }

    // Never intercept Socket.IO requests — let Socket.IO's own listener
    // handle them (it's attached below via new Server(httpServer, ...)).
    // Returning early here without sending a response lets the next
    // `request` listener (Socket.IO) process the request.
    if (url.startsWith("/socket.io/")) {
      return;
    }

    // If Next.js isn't ready yet, return 503 so the health check
    // (configured on /health) still passes while / waits.
    if (!nextReady) {
      res.writeHead(503, { "Content-Type": "text/plain" });
      res.end("Server is starting…");
      return;
    }

    const parsedUrl = parse(url, true);
    handle(req, res, parsedUrl);
  });

  // Attach Socket.IO right away so websocket connections work as
  // soon as the HTTP server is listening.
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 1e6,
  });
  registerSocketHandlers(io);

  // Start listening FIRST — this is what Render's proxy needs.
  await new Promise<void>((resolve) => {
    httpServer.listen(port, hostname, () => {
      console.log(`[unokuet] HTTP server listening on ${hostname}:${port}`);
      resolve();
    });
  });

  // Now prepare Next.js (this loads the build output).
  console.log("[unokuet] preparing Next.js…");
  await app.prepare();
  nextReady = true;
  console.log("[unokuet] Next.js ready — serving all routes");
  console.log(`[unokuet] ▸ Live at http://localhost:${port}  (${dev ? "dev" : "production"})`);
}

main().catch((err) => {
  console.error("[unokuet] FATAL: Failed to start server:", err);
  process.exit(1);
});
