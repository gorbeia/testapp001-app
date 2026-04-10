import assert from "node:assert/strict";
import { After, Before, Given, When, Then } from "@cucumber/cucumber";
import { execFileSync } from "node:child_process";

import type { IntegrationWorld } from "./world";

function buildUniqueStartDateIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 10 + Math.floor(Math.random() * 200));
  // Sub-day jitter: duplicate check is exact on startDate + table + type; a fixed 18:30Z
  // collides across runs on a persistent DB or when two scenarios pick the same day.
  d.setUTCHours(
    18,
    Math.floor(Math.random() * 60),
    Math.floor(Math.random() * 60),
    Math.floor(Math.random() * 1000)
  );
  return d.toISOString();
}

Before({ tags: "@prepayment-ledger-floor" }, function () {
  execFileSync("pnpm", ["exec", "tsx", "script/seed-prepayment-floor-e2e.ts"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });
});

After({ tags: "@prepayment-ledger-floor" }, function () {
  try {
    execFileSync("pnpm", ["exec", "tsx", "script/seed-prepayment-floor-e2e.ts", "--undo"], {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    });
  } catch {
    console.error("prepayment-ledger-floor teardown failed");
  }
});

When(
  "I POST to {string} with a valid reservation body",
  async function (this: IntegrationWorld, path: string) {
    assert.strictEqual(path, "/api/reservations");
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const body = {
      name: `Integration reservation ${tag}`,
      type: "bazkaria",
      startDate: buildUniqueStartDateIso(),
      guests: 4,
      useKitchen: false,
      table: "Mahaia 2",
      totalAmount: "25.00",
      notes: "",
    };
    const res = await this.agent.post(path).send(body);
    this.lastResponse = {
      status: res.status,
      headers: res.headers as Record<string, string | string[] | undefined>,
      body: res.body,
    };
    const b = res.body as { reservation?: { id?: string } };
    if (res.status === 201 && b?.reservation?.id) {
      this.createdIds.reservation = b.reservation.id;
    }
  }
);

Given("I have created a reservation", async function (this: IntegrationWorld) {
  const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const body = {
    name: `Integration reservation setup ${tag}`,
    type: "afaria",
    startDate: buildUniqueStartDateIso(),
    guests: 2,
    useKitchen: false,
    table: "Mahaia 3",
    totalAmount: "15.00",
    notes: "",
  };
  const res = await this.agent.post("/api/reservations").send(body);
  assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  const b = res.body as { reservation?: { id?: string } };
  assert.ok(b.reservation?.id);
  this.createdIds.reservation = b.reservation.id;
  this.lastResponse = {
    status: res.status,
    headers: res.headers as Record<string, string | string[] | undefined>,
    body: res.body,
  };
});

When("I DELETE the last created reservation", async function (this: IntegrationWorld) {
  const id = this.createdIds.reservation;
  assert.ok(id, "No reservation id — create one first");
  const res = await this.agent.delete(`/api/reservations/${id}`);
  this.lastResponse = {
    status: res.status,
    headers: res.headers as Record<string, string | string[] | undefined>,
    body: res.body,
  };
});

Then(
  "the last created reservation should appear in my reservations list",
  async function (this: IntegrationWorld) {
    const id = this.createdIds.reservation;
    assert.ok(id);
    // List is ordered by startDate desc with default limit 25; many future-dated rows
    // (seed + other integration scenarios) can push a new booking off page 1.
    let page = 1;
    let found = false;
    const limit = 50;
    while (!found && page <= 20) {
      const res = await this.agent.get(`/api/reservations/user?page=${page}&limit=${limit}`);
      assert.strictEqual(res.status, 200);
      const body = res.body as {
        data?: Array<{ id: string }>;
        pagination?: { hasNext?: boolean };
      };
      assert.ok(Array.isArray(body.data));
      if (body.data.some(r => r.id === id)) {
        found = true;
        break;
      }
      if (!body.pagination?.hasNext) break;
      page += 1;
    }
    assert.ok(found, "Reservation not found in /api/reservations/user data (paged)");
  }
);

Then(
  "the created reservation type should be {string}",
  async function (this: IntegrationWorld, t: string) {
    assert.ok(this.lastResponse?.body && typeof this.lastResponse.body === "object");
    const b = this.lastResponse.body as { reservation?: { type?: string } };
    assert.strictEqual(b.reservation?.type, t);
  }
);

Given("the member balance is below the society floor", async function (this: IntegrationWorld) {
  // DB state from @prepayment-ledger-floor Before hook; bazkide login must match seed fixture user.
});
