import assert from "node:assert/strict";
import { After, Given, Then, When } from "@cucumber/cucumber";
import { eq } from "drizzle-orm";

import { db } from "../../server/db";
import { DEMO_SOCIETY_ID } from "../../script/seed-demo-society";
import { DEFAULT_RESERVATION_MEAL_TYPES, societies } from "@shared/schema";

import type { IntegrationWorld } from "./world";

After({ tags: "@society-reservation-meal-types-put" }, async function () {
  await db
    .update(societies)
    .set({
      reservationMealTypes: DEFAULT_RESERVATION_MEAL_TYPES,
      updatedAt: new Date(),
    })
    .where(eq(societies.id, DEMO_SOCIETY_ID));
});

Given(
  "I have loaded my society id from the user endpoint",
  async function (this: IntegrationWorld) {
    const res = await this.agent.get("/api/societies/user");
    assert.strictEqual(res.status, 200);
    const row = res.body as { id?: string };
    assert.ok(row?.id);
    this.createdIds.society = row.id;
  }
);

When("I update my society phone via API", async function (this: IntegrationWorld) {
  const id = this.createdIds.society;
  assert.ok(id);
  const res = await this.agent.put(`/api/societies/${id}`).send({
    phone: "+34 943 000 000",
  });
  this.lastResponse = {
    status: res.status,
    headers: res.headers as Record<string, string | string[] | undefined>,
    body: res.body,
  };
});

When(
  "I update my society reservation meal types to the integration test list via API",
  async function (this: IntegrationWorld) {
    const id = this.createdIds.society;
    assert.ok(id);
    const mealTypes = [
      { id: "bazkaria", labelEu: "Bazkaria", labelEs: "Comida" },
      { id: "brunch", labelEu: "Brunch", labelEs: "Brunch" },
    ];
    const res = await this.agent
      .put(`/api/societies/${id}`)
      .send({ reservationMealTypes: mealTypes });
    this.lastResponse = {
      status: res.status,
      headers: res.headers as Record<string, string | string[] | undefined>,
      body: res.body,
    };
    this.integrationTestMealTypes = mealTypes;
  }
);

Then(
  "my society from the user endpoint should include the integration test meal type ids",
  async function (this: IntegrationWorld) {
    const res = await this.agent.get("/api/societies/user");
    assert.strictEqual(res.status, 200);
    const body = res.body as {
      reservationMealTypes?: Array<{ id: string }>;
    };
    const expected = this.integrationTestMealTypes as Array<{ id: string }> | undefined;
    assert.ok(expected?.length);
    const ids = new Set((body.reservationMealTypes ?? []).map(m => m.id));
    for (const m of expected) {
      assert.ok(ids.has(m.id), `missing meal type id ${m.id}`);
    }
  }
);
