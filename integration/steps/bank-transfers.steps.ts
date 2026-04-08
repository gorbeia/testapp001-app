import assert from "node:assert/strict";
import { Given, When } from "@cucumber/cucumber";

import type { IntegrationWorld } from "./world";

const MIREN_USER_ID = "550e8400-e29b-41d4-a716-446655440004";

Given("there is a pending bank transfer for Miren", async function (this: IntegrationWorld) {
  const transferDate = new Date().toISOString().slice(0, 10);
  const res = await this.agent.post("/api/bank-transfers").send({
    userId: MIREN_USER_ID,
    amount: "25.00",
    transferDate,
    reference: "integration-pending",
    notes: "integration",
  });
  assert.strictEqual(res.status, 201, JSON.stringify(res.body));
  const row = res.body as { id: string };
  this.createdIds.bankTransfer = row.id;
  this.lastResponse = {
    status: res.status,
    headers: res.headers as Record<string, string | string[] | undefined>,
    body: res.body,
  };
});

When("I validate the pending bank transfer", async function (this: IntegrationWorld) {
  const id = this.createdIds.bankTransfer;
  assert.ok(id);
  const res = await this.agent.put(`/api/bank-transfers/${id}/validate`).send({});
  this.lastResponse = {
    status: res.status,
    headers: res.headers as Record<string, string | string[] | undefined>,
    body: res.body,
  };
});

When("I reject the pending bank transfer", async function (this: IntegrationWorld) {
  const id = this.createdIds.bankTransfer;
  assert.ok(id);
  const res = await this.agent.put(`/api/bank-transfers/${id}/reject`).send({
    rejectionReason: "integration reject",
  });
  this.lastResponse = {
    status: res.status,
    headers: res.headers as Record<string, string | string[] | undefined>,
    body: res.body,
  };
});
