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
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

async function main(): Promise<void> {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url || "/", true);
    handle(req, res, parsedUrl);
  });

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 1e6,
  });

  registerSocketHandlers(io);

  httpServer.listen(port, hostname, () => {
    console.log(
      `\n  ▸ UNO Arena running at http://localhost:${port}  (${dev ? "dev" : "production"})\n`,
    );
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
