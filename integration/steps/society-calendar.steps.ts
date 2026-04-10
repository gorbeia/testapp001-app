import assert from "node:assert/strict";
import { When } from "@cucumber/cucumber";

import type { IntegrationWorld } from "./world";
import { getDemoSocietyKitchenServiceId } from "./reservation-services.helpers";

/**
 * Shifts all calendar scenarios by the same random number of days per process so
 * `startDate` values are not identical across repeated integration runs on a
 * persistent DB (otherwise Mahaia 2 + bazkaria hits "already reserved").
 * Relative gaps between feature offsets are unchanged; block-all uses a low offset
 * and per-table tests a high one so (high − low) > max salt span across runs.
 */
let calendarTestDaySalt: number | undefined;
function getCalendarTestDaySalt(): number {
  if (calendarTestDaySalt === undefined) {
    calendarTestDaySalt = Math.floor(Math.random() * 400);
  }
  return calendarTestDaySalt;
}

/** UTC day at offset + midday ISO for reservation instant (stable across TZ for CI). */
function integrationTestCalendarDay(dayOffset: number): {
  startIso: string;
  endIso: string;
  middayIso: string;
} {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + dayOffset + getCalendarTestDaySalt());
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCHours(23, 59, 59, 999);
  const midday = new Date(start);
  midday.setUTCHours(18, 30, 0, 0);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    middayIso: midday.toISOString(),
  };
}

When(
  "I create a full-day society event blocking all reservations for integration test day {int}",
  async function (this: IntegrationWorld, dayOffset: number) {
    const { startIso, endIso, middayIso } = integrationTestCalendarDay(dayOffset);
    this.createdIds.calendarMiddayIso = middayIso;
    const res = await this.agent.post("/api/society-events").send({
      title: `Integration block-all ${Date.now()}`,
      type: "closure",
      isFullDay: true,
      startDate: startIso,
      endDate: endIso,
      blocksAllReservations: true,
      blocksKitchen: false,
      blockedTableIds: [],
      notes: "",
    });
    this.lastResponse = {
      status: res.status,
      headers: res.headers as Record<string, string | string[] | undefined>,
      body: res.body,
    };
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  }
);

When(
  "I create a full-day society assembly event without blocking for integration test day {int}",
  async function (this: IntegrationWorld, dayOffset: number) {
    const { startIso, endIso, middayIso } = integrationTestCalendarDay(dayOffset);
    this.createdIds.calendarMiddayIso = middayIso;
    const res = await this.agent.post("/api/society-events").send({
      title: `Integration assembly ${Date.now()}`,
      type: "assembly",
      isFullDay: true,
      startDate: startIso,
      endDate: endIso,
      blocksAllReservations: false,
      blocksKitchen: false,
      blockedTableIds: [],
      notes: "",
    });
    this.lastResponse = {
      status: res.status,
      headers: res.headers as Record<string, string | string[] | undefined>,
      body: res.body,
    };
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  }
);

When(
  "I create a full-day society event blocking kitchen only for integration test day {int}",
  async function (this: IntegrationWorld, dayOffset: number) {
    const { startIso, endIso, middayIso } = integrationTestCalendarDay(dayOffset);
    this.createdIds.calendarMiddayIso = middayIso;
    const res = await this.agent.post("/api/society-events").send({
      title: `Integration kitchen-block ${Date.now()}`,
      type: "maintenance",
      isFullDay: true,
      startDate: startIso,
      endDate: endIso,
      blocksAllReservations: false,
      blocksKitchen: true,
      blockedTableIds: [],
      notes: "",
    });
    this.lastResponse = {
      status: res.status,
      headers: res.headers as Record<string, string | string[] | undefined>,
      body: res.body,
    };
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  }
);

When(
  "I note table {string} id for calendar block tests",
  async function (this: IntegrationWorld, tableName: string) {
    const res = await this.agent.get("/api/tables/available");
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    const list = res.body as Array<{ id: string; name: string }>;
    assert.ok(
      Array.isArray(list) && list.length >= 2,
      "Need at least two tables for calendar tests"
    );
    const row = list.find(t => t.name === tableName);
    assert.ok(row, `Table ${tableName} not found in /api/tables/available`);
    this.createdIds.calendarBlockedTableId = row.id;
    this.createdIds.calendarBlockedTableName = row.name;
  }
);

When(
  "I create a society event blocking only the noted table for integration test day {int}",
  async function (this: IntegrationWorld, dayOffset: number) {
    const tableId = this.createdIds.calendarBlockedTableId;
    assert.ok(tableId, "Run note table step first");
    const { startIso, endIso, middayIso } = integrationTestCalendarDay(dayOffset);
    this.createdIds.calendarMiddayIso = middayIso;
    const res = await this.agent.post("/api/society-events").send({
      title: `Integration table-block ${Date.now()}`,
      type: "maintenance",
      isFullDay: true,
      startDate: startIso,
      endDate: endIso,
      blocksAllReservations: false,
      blocksKitchen: false,
      blockedTableIds: [tableId],
      notes: "",
    });
    this.lastResponse = {
      status: res.status,
      headers: res.headers as Record<string, string | string[] | undefined>,
      body: res.body,
    };
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  }
);

When(
  "I POST to {string} with calendar test reservation body",
  async function (this: IntegrationWorld, path: string) {
    assert.strictEqual(path, "/api/reservations");
    const startDate = this.createdIds.calendarMiddayIso;
    assert.ok(startDate, "Calendar test day not set — create society event step first");
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const body = {
      name: `Calendar test reservation ${tag}`,
      type: "bazkaria",
      startDate,
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
  }
);

When(
  "I POST to {string} with calendar test reservation body and kitchen true",
  async function (this: IntegrationWorld, path: string) {
    assert.strictEqual(path, "/api/reservations");
    const startDate = this.createdIds.calendarMiddayIso;
    assert.ok(startDate);
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const kitchenId = await getDemoSocietyKitchenServiceId();
    const body = {
      name: `Calendar test kitchen ${tag}`,
      type: "bazkaria",
      startDate,
      guests: 4,
      table: "Mahaia 2",
      selectedServiceIds: [kitchenId],
      notes: "",
    };
    const res = await this.agent.post(path).send(body);
    this.lastResponse = {
      status: res.status,
      headers: res.headers as Record<string, string | string[] | undefined>,
      body: res.body,
    };
  }
);

When(
  "I POST to {string} with calendar test reservation body and kitchen false",
  async function (this: IntegrationWorld, path: string) {
    assert.strictEqual(path, "/api/reservations");
    const startDate = this.createdIds.calendarMiddayIso;
    assert.ok(startDate);
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const body = {
      name: `Calendar test no-kitchen ${tag}`,
      type: "bazkaria",
      startDate,
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
  }
);

When(
  "I POST to {string} with calendar test reservation body for noted table {string}",
  async function (this: IntegrationWorld, path: string, tableName: string) {
    assert.strictEqual(path, "/api/reservations");
    const startDate = this.createdIds.calendarMiddayIso;
    assert.ok(startDate);
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const body = {
      name: `Calendar table test ${tag}`,
      type: "bazkaria",
      startDate,
      guests: 2,
      table: tableName,
      selectedServiceIds: [] as string[],
      notes: "",
    };
    const res = await this.agent.post(path).send(body);
    this.lastResponse = {
      status: res.status,
      headers: res.headers as Record<string, string | string[] | undefined>,
      body: res.body,
    };
  }
);
