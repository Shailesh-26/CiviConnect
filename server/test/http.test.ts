import "./setup";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// Requests that must be refused before the database is ever touched.
let server: Server;
let base = "";

before(async () => {
  const { app } = await import("../src/app");
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

after(() => server.close());

for (const [method, path] of [
  ["GET", "/auth/me"],
  ["GET", "/issues/mine"],
  ["POST", "/issues"],
  ["GET", "/vision/status"],
  ["POST", "/vision/classify"],
  ["GET", "/vision/stats"],
  ["GET", "/admin/overview"],
  ["GET", "/notifications"],
] as const) {
  test(`http: ${method} ${path} needs a login`, async () => {
    const res = await fetch(base + path, { method });
    assert.equal(res.status, 401);
  });
}

test("http: a forged session cookie is rejected", async () => {
  const res = await fetch(`${base}/issues/mine`, { headers: { cookie: "civiconnect_token=not-a-real-token" } });
  assert.equal(res.status, 401);
});

test("http: unknown routes return 404 JSON", async () => {
  const res = await fetch(`${base}/nope`);
  assert.equal(res.status, 404);
  assert.equal(((await res.json()) as { message: string }).message, "Route not found");
});
