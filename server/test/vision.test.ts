import "./setup";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";

// A stand-in for the Python service, so these tests run without Python.
let server: http.Server;
let received = "";

before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true, loadSeconds: 1, model: { name: "fake", mode: "zero-shot", classes: ["pothole"], metrics: null } }));
      return;
    }
    if (req.url === "/classify" && req.method === "POST") {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        received = Buffer.concat(chunks).toString("latin1");
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ verdict: "confident", category: "pothole", confidence: 0.9, civic: 0.97, top: [], quality: {}, model: { name: "fake", mode: "zero-shot" }, ms: 5 }));
      });
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { env } = await import("../src/config/env");
  env.VISION_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => server.close());

test("vision: health and classify go through to the service", async () => {
  const { classifyPhoto, visionHealth } = await import("../src/services/vision");
  const health = await visionHealth(true);
  assert.equal(health?.model.mode, "zero-shot");
  const result = await classifyPhoto({ buffer: Buffer.from("fake-jpeg-bytes"), mimetype: "image/jpeg", originalname: "road.jpg" });
  assert.equal(result?.category, "pothole");
  assert.match(received, /name="image"; filename="road.jpg"/);
  assert.match(received, /fake-jpeg-bytes/);
});

test("vision: returns null instead of failing when the service is down", async () => {
  const { env } = await import("../src/config/env");
  const { classifyPhoto, visionHealth } = await import("../src/services/vision");
  const saved = env.VISION_URL;
  env.VISION_URL = "http://127.0.0.1:1";
  assert.equal(await visionHealth(true), null);
  assert.equal(await classifyPhoto({ buffer: Buffer.from("x"), mimetype: "image/jpeg", originalname: "a.jpg" }), null);
  env.VISION_URL = saved;
});
