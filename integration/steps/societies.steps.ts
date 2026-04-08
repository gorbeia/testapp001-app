import assert from "node:assert/strict";
import { Given, When } from "@cucumber/cucumber";

import type { IntegrationWorld } from "./world";

Given("I have loaded my society id from the user endpoint", async function (this: IntegrationWorld) {
  const res = await this.agent.get("/api/societies/user");
  assert.strictEqual(res.status, 200);
  const row = res.body as { id?: string };
  assert.ok(row?.id);
  this.createdIds.society = row.id;
});

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
