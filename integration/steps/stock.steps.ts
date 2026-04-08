import assert from "node:assert/strict";
import { Given, When } from "@cucumber/cucumber";

import type { IntegrationWorld } from "./world";

Given("I have a manual stock product id from the catalog", async function (this: IntegrationWorld) {
  const res = await this.agent.get("/api/products");
  assert.strictEqual(res.status, 200);
  const list = res.body as Array<{ id: string; stockMode?: string }>;
  const manual = list.find(p => p.stockMode === "manual");
  assert.ok(manual, "need a manual stock product in seed");
  this.createdIds.product = manual.id;
});

When("I post a stock adjustment of {int} for the catalog product", async function (this: IntegrationWorld, qty: number) {
  const id = this.createdIds.product;
  assert.ok(id);
  const res = await this.agent.post(`/api/products/${id}/adjust`).send({
    type: "adjustment",
    quantity: qty,
    reason: "integration test adjustment",
  });
  this.lastResponse = {
    status: res.status,
    headers: res.headers as Record<string, string | string[] | undefined>,
    body: res.body,
  };
});
