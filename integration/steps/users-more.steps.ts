import assert from "node:assert/strict";
import { When, Then } from "@cucumber/cucumber";

import type { IntegrationWorld } from "./world";

When("I fetch the users count", async function (this: IntegrationWorld) {
  const res = await this.agent.get("/api/users/count");
  this.lastResponse = {
    status: res.status,
    headers: res.headers as Record<string, string | string[] | undefined>,
    body: res.body,
  };
});

Then("the response body should include count at least {int}", async function (this: IntegrationWorld, min: number) {
  assert.ok(this.lastResponse?.body && typeof this.lastResponse.body === "object");
  const c = (this.lastResponse.body as { count?: number }).count;
  assert.ok(typeof c === "number" && c >= min);
});
