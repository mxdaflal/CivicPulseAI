import { test, expect } from "@playwright/test";
test("mobile page renders truthfully without horizontal overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    await expect(
      page.getByRole("heading", { name: "Connect your development database" }),
    ).toBeVisible();
  else
    await expect(
      page.getByRole("link", { name: /Report an Issue/i }).first(),
    ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("forged session cookie never grants staff dashboard access", async ({
  page,
  context,
}) => {
  const token = [
    "eyJhbGciOiJub25lIn0",
    Buffer.from(
      JSON.stringify({
        sub: "10000000-0000-4000-8000-000000000001",
        role: "authenticated",
        user_metadata: { role: "admin" },
      }),
    ).toString("base64url"),
    "forged",
  ].join(".");
  await context.addCookies([
    {
      name: "sb-fake-auth-token",
      value: token,
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.goto("/staff/dashboard");
  await expect(page).toHaveURL(/\/(staff\/login|login\?|citizen\/dashboard)/);
  await expect(
    page.getByText("Staff Operations Dashboard", { exact: true }),
  ).toHaveCount(0);
});
test("write APIs reject cross-origin requests before accessing a database", async ({
  request,
}) => {
  for (const endpoint of ["reports", "track", "evidence"]) {
    const response = await request.post(`/api/${endpoint}`, {
      headers: { Origin: "https://untrusted.example" },
      data: {},
    });
    expect(response.status()).toBe(403);
  }
});
test("tracking validates malformed access keys", async ({ request }) => {
  const response = await request.post("/api/track", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: { reference: "CP-ABC123", secret: "bad" },
  });
  expect(response.status()).toBe(400);
});
test("mobile report wizard validates required details", async ({ page }) => {
  test.skip(
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "Requires configured development Supabase; no fake credentials are supplied",
  );
  await page.goto("/report");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Choose a category");
  await page
    .getByRole("button", { name: "Drainage Problem", exact: true })
    .click();
  await page.getByLabel("Short title").fill("Blocked drain near the library");
  await page
    .getByLabel("What is happening?")
    .fill("The drain is overflowing onto the public footpath after rain.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByLabel("Street / locality / public landmark"),
  ).toBeVisible();
});
