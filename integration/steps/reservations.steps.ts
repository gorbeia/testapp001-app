import assert from "node:assert/strict";
import { After, Before, Given, When, Then } from "@cucumber/cucumber";
import { execFileSync } from "node:child_process";
import { and, eq } from "drizzle-orm";

import { db } from "../../server/db";
import { societies, tables } from "@shared/schema";

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

/** Ensures Mahaia 5 allows partial bookings (idempotent; survives onConflictDoNothing table seed). */
Before({ tags: "@partial-mahaia5" }, async function () {
  const [soc] = await db
    .select({ id: societies.id })
    .from(societies)
    .where(eq(societies.alphabeticId, "GT001"))
    .limit(1);
  if (!soc) return;
  await db
    .update(tables)
    .set({
      allowsPartialReservation: true,
      minCapacity: 2,
      updatedAt: new Date(),
    })
    .where(and(eq(tables.societyId, soc.id), eq(tables.name, "Mahaia 5")));
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
      table: "Mahaia 2",
      selectedServiceIds: [] as string[],
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
    guests: 4,
    table: "Mahaia 3",
    selectedServiceIds: [] as string[],
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

When(
  "I POST two partial reservations on the same table and slot",
  async function (this: IntegrationWorld) {
    const startDate = buildUniqueStartDateIso();
    const base = {
      type: "bazkaria",
      startDate,
      table: "Mahaia 5",
      selectedServiceIds: [] as string[],
      notes: "",
    };
    const first = await this.agent.post("/api/reservations").send({ ...base, guests: 6 });
    assert.strictEqual(first.status, 201, JSON.stringify(first.body));
    const second = await this.agent.post("/api/reservations").send({ ...base, guests: 4 });
    this.lastResponse = {
      status: second.status,
      headers: second.headers as Record<string, string | string[] | undefined>,
      body: second.body,
    };
  }
);

When(
  "I POST partial reservations that exceed table capacity",
  async function (this: IntegrationWorld) {
    const startDate = buildUniqueStartDateIso();
    const base = {
      type: "bazkaria",
      startDate,
      table: "Mahaia 5",
      selectedServiceIds: [] as string[],
      notes: "",
    };
    const first = await this.agent.post("/api/reservations").send({ ...base, guests: 6 });
    assert.strictEqual(first.status, 201, JSON.stringify(first.body));
    const second = await this.agent.post("/api/reservations").send({ ...base, guests: 5 });
    this.lastResponse = {
      status: second.status,
      headers: second.headers as Record<string, string | string[] | undefined>,
      body: second.body,
    };
  }
);
