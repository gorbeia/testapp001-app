import { When } from "@cucumber/cucumber";

import type { IntegrationWorld } from "./world";

const MIREN_USER_ID = "550e8400-e29b-41d4-a716-446655440004";

When("I record a refund for Miren via API", async function (this: IntegrationWorld) {
  const res = await this.agent.post("/api/account-movements/refund").send({
    userId: MIREN_USER_ID,
    amount: "1.00",
    description: "integration refund",
  });
  this.lastResponse = {
    status: res.status,
    headers: res.headers as Record<string, string | string[] | undefined>,
    body: res.body,
  };
});

When("I POST SEPA bounce with a non-existent credit id", async function (this: IntegrationWorld) {
  const res = await this.agent.post("/api/account-movements/sepa-bounce").send({
    creditId: "00000000-0000-4000-8000-000000000001",
  });
  this.lastResponse = {
    status: res.status,
    headers: res.headers as Record<string, string | string[] | undefined>,
    body: res.body,
  };
});
