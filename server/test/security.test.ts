import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

// Rehearsal Round 7: the hostile-reviewer findings, kept as tests so they never come back.

test("security: names in emails are plain text, never markup", async () => {
  const { emailLayout } = await import("../src/services/mailer");
  const html = emailLayout("Reset your password", ['Hi <a href="https://evil.example">click</a>,'], { text: "Go", url: "https://civi.example/reset?token=abc&x=1" });
  assert.ok(!html.includes('<a href="https://evil.example">'));
  assert.ok(html.includes("&lt;a href=&quot;https://evil.example&quot;&gt;"));
  assert.ok(html.includes("token=abc&amp;x=1"));
});

test("security: only real JPEG, PNG and WebP bytes count as photos", async () => {
  const { looksLikeImage } = await import("../src/middleware/upload");
  const pad = Buffer.alloc(16);
  assert.equal(looksLikeImage(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), pad])), true);
  assert.equal(looksLikeImage(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pad])), true);
  assert.equal(looksLikeImage(Buffer.concat([Buffer.from("RIFF\0\0\0\0WEBP"), pad])), true);
  assert.equal(looksLikeImage(Buffer.from("%PDF-1.4 renamed to photo.jpg")), false);
  assert.equal(looksLikeImage(Buffer.from("<svg onload=alert(1)></svg>")), false);
  assert.equal(looksLikeImage(Buffer.from("GIF89a......")), false);
});

test("security: unsigned and wrongly signed sessions are refused", async () => {
  const { signToken, verifyToken } = await import("../src/utils/token");
  const good = verifyToken(signToken("0123456789abcdef01234567"));
  assert.equal(good.userId, "0123456789abcdef01234567");
  assert.ok(Math.abs(good.issuedAt - Date.now()) < 5000, "issue time is in milliseconds");
  const none = jwt.sign({ sub: "0123456789abcdef01234567" }, "", { algorithm: "none" });
  assert.throws(() => verifyToken(none));
  const other = jwt.sign({ sub: "0123456789abcdef01234567" }, "some-other-secret-some-other-secret-1234");
  assert.throws(() => verifyToken(other));
});

function fakeRes() {
  const r = { code: 0, body: undefined as unknown, status(c: number) { r.code = c; return r; }, json(b: unknown) { r.body = b; return r; } };
  return r;
}

test("security: odd failures get clear answers instead of a crash", async () => {
  const { errorHandler } = await import("../src/middleware/errorHandler");
  const run = (err: unknown) => {
    const res = fakeRes();
    errorHandler(err, {} as never, res as never, () => undefined);
    return res.code;
  };
  assert.equal(run({ type: "entity.too.large" }), 413);
  assert.equal(run({ name: "CastError" }), 400);
  assert.equal(run({ name: "DocumentNotFoundError" }), 409);
  assert.equal(run({ name: "VersionError" }), 409);
});
