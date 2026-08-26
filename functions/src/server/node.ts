// Plain Node HTTP entry point.
//
// Runs the command service on anything that can run Node — a free container
// host, a VPS, or your laptop for local development. Host-specific entries
// (Netlify, Deno, Workers) are thin wrappers around the same
// handleCommandRequest; this one is the reference implementation and the one
// used by `npm run serve:http`.
//
//   PORT                      listen port (default 8787)
//   FIREBASE_SERVICE_ACCOUNT  service account JSON (required for real calls)
//   ALLOWED_ORIGINS           comma-separated CORS allowlist (optional)

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { handleCommandRequest } from "./handler";

const PORT = Number(process.env.PORT ?? 8787);

/** Buffers a Node request body; commands are small JSON payloads. */
function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function toWebRequest(req: IncomingMessage, body: Buffer): Request {
  const host = req.headers.host ?? `localhost:${PORT}`;
  const url = new URL(req.url ?? "/", `http://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  const method = req.method ?? "GET";
  const hasBody = method !== "GET" && method !== "HEAD" && body.length > 0;

  return new Request(url.toString(), {
    method,
    headers,
    ...(hasBody ? { body: new Uint8Array(body) } : {}),
  });
}

async function writeWebResponse(
  res: ServerResponse,
  webRes: Response,
): Promise<void> {
  const headers: Record<string, string> = {};
  webRes.headers.forEach((value, key) => {
    headers[key] = value;
  });
  res.writeHead(webRes.status, headers);
  const text = await webRes.text();
  res.end(text);
}

const server = createServer((req, res) => {
  void (async () => {
    try {
      const body = await readBody(req);
      const webRes = await handleCommandRequest(toWebRequest(req, body));
      await writeWebResponse(res, webRes);
    } catch (e) {
      console.error("Server error:", e);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
      }
      res.end(JSON.stringify({ error: { code: "internal", message: "Internal error." } }));
    }
  })();
});

server.listen(PORT, () => {
  console.log(`Command service listening on http://localhost:${PORT}`);
  console.log(`Health: curl http://localhost:${PORT}/health`);
});
