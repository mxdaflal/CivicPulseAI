import test from "node:test";
import assert from "node:assert/strict";
import {
  reportSchema,
  trackingSchema,
  validImageHeader,
} from "../lib/report-schema";
import { safeRedirect, sameOrigin } from "../lib/security";
import {
  analyzeReport,
  calculateSimilarity,
  distanceKm,
  duplicateCandidates,
} from "../lib/ai-analysis";
const originCheck = (request: Request) => {
  const previous = process.env.CIVICPULSE_APP_ORIGIN;
  delete process.env.CIVICPULSE_APP_ORIGIN;
  try {
    return sameOrigin(request);
  } finally {
    if (previous === undefined) delete process.env.CIVICPULSE_APP_ORIGIN;
    else process.env.CIVICPULSE_APP_ORIGIN = previous;
  }
};
const valid = {
  category: "Drainage Problem",
  title: "Blocked drain outside library",
  description:
    "The drain outside the public library is blocked and overflowing.",
  locationText: "Public library, Main Street",
  latitude: 10.8,
  longitude: 78.7,
  requestKey: "20000000-0000-4000-8000-000000000001",
};
test("report validation accepts real input, trims text, rejects unknown or privileged fields", () => {
  assert.equal(reportSchema.parse(valid).photoPath, null);
  assert.equal(
    reportSchema.safeParse({ ...valid, title: " bad " }).success,
    false,
  );
  assert.equal(
    reportSchema.safeParse({ ...valid, user_id: "forged", status: "resolved" })
      .success,
    false,
  );
  assert.equal(
    reportSchema.safeParse({ ...valid, category: "Other" }).success,
    false,
  );
});
test("coordinates must be finite, paired and in range", () => {
  for (const change of [
    { latitude: 91 },
    { longitude: 181 },
    { latitude: NaN },
    { latitude: Infinity },
    { longitude: null },
  ])
    assert.equal(
      reportSchema.safeParse({ ...valid, ...change }).success,
      false,
    );
  assert.equal(
    reportSchema.safeParse({ ...valid, latitude: null, longitude: null })
      .success,
    true,
  );
});
test("text and evidence bounds fail closed", () => {
  for (const change of [
    { description: "short" },
    { title: "a".repeat(151) },
    { locationText: "" },
    { photoPath: "https://evil.invalid/file.svg" },
    { photoPath: "../../secret" },
    { description: "a".repeat(2001) },
  ])
    assert.equal(
      reportSchema.safeParse({ ...valid, ...change }).success,
      false,
    );
});
test("tracking never accepts arbitrary secrets or unbounded identifiers", () => {
  assert.equal(
    trackingSchema.safeParse({ reference: "CP-ABC123", secret: "x".repeat(64) })
      .success,
    false,
  );
  assert.equal(
    trackingSchema.safeParse({ reference: "CP-ABC123", secret: "a".repeat(64) })
      .success,
    true,
  );
});
test("redirects reject external, protocol-relative and backslash targets", () => {
  for (const value of [
    "https://evil.invalid",
    "//evil.invalid",
    "/\\evil.invalid",
    "/\n/evil.invalid",
    "javascript:alert(1)",
  ])
    assert.equal(safeRedirect(value), "/");
  assert.equal(
    safeRedirect("/citizen/dashboard?tab=reports"),
    "/citizen/dashboard?tab=reports",
  );
});
test("cookie writes require a same-origin request", () => {
  assert.equal(
    originCheck(
      new Request("https://civic.invalid/api/reports", {
        headers: { origin: "https://evil.invalid" },
      }),
    ),
    false,
  );
  assert.equal(
    originCheck(
      new Request("https://civic.invalid/api/reports", {
        headers: { origin: "https://civic.invalid" },
      }),
    ),
    true,
  );
});
test("upload signatures reject content-type spoofing and SVG", () => {
  assert.equal(
    validImageHeader(new TextEncoder().encode("<svg onload="), "image/png"),
    false,
  );
  assert.equal(
    validImageHeader(
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      "image/png",
    ),
    true,
  );
  assert.equal(
    validImageHeader(new Uint8Array([255, 216, 255]), "image/jpeg"),
    true,
  );
});
test("fallback prioritisation is bounded, explainable, labelled and has no fabricated recurrence", () => {
  for (const text of [
    "A broken drain",
    "urgent emergency danger immediate critical serious severe safety hazard risk many everyone whole entire all community street families children school hospital elderly disabled",
  ]) {
    const a = analyzeReport(text, text, "library", "Drainage Problem");
    assert.equal(a.ai_powered, false);
    assert.equal(a.model_version, "rule-based-v2");
    assert.equal(a.confidence, null);
    assert.equal(a.priority_factors.recurrence, 0);
    assert.ok(a.priority_score >= 0 && a.priority_score <= 100);
    assert.equal(
      a.priority_score,
      Math.round(
        0.4 * a.priority_factors.urgency +
          0.3 * a.priority_factors.impact +
          0.1 * a.priority_factors.vulnerability,
      ),
    );
    assert.match(a.explanation, /unknown/);
  }
});
test("similarity is category-aware and geographic distance is measured", () => {
  assert.equal(
    calculateSimilarity(
      "same street drain",
      "same street drain",
      "Drainage Problem",
      "Water Supply",
    ),
    0,
  );
  assert.equal(
    calculateSimilarity(
      "same street drain",
      "same street drain",
      "Drainage Problem",
      "Drainage Problem",
    ),
    1,
  );
  assert.equal(
    distanceKm(
      { latitude: 10, longitude: 20 },
      { latitude: 10, longitude: 20 },
    ),
    0,
  );
  assert.ok(
    distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }) >
      111,
  );
});
test("duplicates require category, proximity, time window, textual evidence and open status", () => {
  const report = {
    ...valid,
    category_name: valid.category,
    created_at: "2026-10-21T10:00:00Z",
  };
  const candidate = {
    id: "1",
    title: valid.title,
    category_name: valid.category,
    status: "verified",
    latitude: 10.8001,
    longitude: 78.7001,
    created_at: "2026-10-20T10:00:00Z",
  };
  assert.equal(duplicateCandidates(report, [candidate]).length, 1);
  for (const delta of [
    { status: "resolved" },
    { latitude: 12 },
    { created_at: "2025-10-20T00:00:00Z" },
    { category_name: "Water Supply" },
    { latitude: null },
    { title: "Streetlight electricity issue" },
  ])
    assert.equal(
      duplicateCandidates(report, [{ ...candidate, ...delta }]).length,
      0,
    );
});

test("public Host survives Next.js internal URL normalization without accepting cross-site origins", () => {
  const request = (origin: string) =>
    new Request("http://localhost:3100/api/track", {
      headers: { host: "127.0.0.1:3100", origin },
    });
  assert.equal(originCheck(request("http://127.0.0.1:3100")), true);
  assert.equal(originCheck(request("http://evil.invalid")), false);
  assert.equal(originCheck(request("http://127.0.0.1:3101")), false);
  assert.equal(originCheck(request("https://127.0.0.1:3100")), false);
});
