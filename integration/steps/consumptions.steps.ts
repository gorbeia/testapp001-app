import assert from "node:assert/strict";
import { Given, When, Then } from "@cucumber/cucumber";

import type { IntegrationWorld } from "./world";

Given("I have loaded the first catalog product id", async function (this: IntegrationWorld) {
  const res = await this.agent.get("/api/products");
  assert.strictEqual(res.status, 200);
  const list = res.body as Array<{ id: string; stockMode?: string }>;
  assert.ok(Array.isArray(list) && list.length > 0);
  const auto = list.find(p => p.stockMode === "auto") ?? list[0];
  this.createdIds.product = auto.id;
});

Given("I have an open consumption session", async function (this: IntegrationWorld) {
  const res = await this.agent.post("/api/consumptions").send({ notes: "integration consumption" });
  assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  const row = res.body as { id: string };
  assert.ok(row.id);
  this.createdIds.consumption = row.id;
  this.lastResponse = {
    status: res.status,
    headers: res.headers as Record<string, string | string[] | undefined>,
    body: res.body,
  };
});

When("I add one unit of the catalog product to the open consumption", async function (this: IntegrationWorld) {
  const cid = this.createdIds.consumption;
  const pid = this.createdIds.product;
  assert.ok(cid && pid);
  const res = await this.agent.post(`/api/consumptions/${cid}/items`).send({
    items: [{ productId: pid, quantity: 1 }],
  });
  this.lastResponse = {
    status: res.status,
    headers: res.headers as Record<string, string | string[] | undefined>,
    body: res.body,
  };
});

When("I close the open consumption", async function (this: IntegrationWorld) {
  const cid = this.createdIds.consumption;
  assert.ok(cid);
  const res = await this.agent.post(`/api/consumptions/${cid}/close`).send({});
  this.lastResponse = {
    status: res.status,
    headers: res.headers as Record<string, string | string[] | undefined>,
    body: res.body,
  };
});

Then("the closed consumption appears in my history", async function (this: IntegrationWorld) {
  const cid = this.createdIds.consumption;
  assert.ok(cid);
  const res = await this.agent.get("/api/consumptions/user");
  assert.strictEqual(res.status, 200);
  const body = res.body as { data?: Array<{ id: string; closedAt?: string | null }> };
  const row = body.data?.find(c => c.id === cid);
  assert.ok(row, "consumption not in user list");
  assert.ok(row.closedAt, "expected closedAt set");
});
