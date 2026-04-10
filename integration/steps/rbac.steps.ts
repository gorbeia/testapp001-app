import { When } from "@cucumber/cucumber";

import type { IntegrationWorld } from "./world";

When("I create a unique integration test user via API", async function (this: IntegrationWorld) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await this.agent.post("/api/users").send({
    username: `integ-${suffix}@test.eus`,
    password: "demo",
    name: "Integration RBAC User",
    phone: "+34 000 000 000",
  });
  this.lastResponse = {
    status: res.status,
    headers: res.headers as Record<string, string | string[] | undefined>,
    body: res.body,
  };
  if (
    res.status === 201 &&
    res.body &&
    typeof res.body === "object" &&
    res.body !== null &&
    "id" in res.body
  ) {
    this.createdIds.user = (res.body as { id: string }).id;
  }
});
