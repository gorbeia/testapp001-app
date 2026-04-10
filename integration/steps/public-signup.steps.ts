import assert from "node:assert/strict";
import { When } from "@cucumber/cucumber";
import { eq } from "drizzle-orm";

import { users } from "@shared/schema";
import { db } from "../../server/db";
import type { IntegrationWorld } from "./world";

function recordResponse(
  world: IntegrationWorld,
  status: number,
  headers: unknown,
  body: unknown
): void {
  world.lastResponse = {
    status,
    headers: headers as Record<string, string | string[] | undefined>,
    body,
  };
}

When("I submit a valid public society signup", async function (this: IntegrationWorld) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const email = `signup-${suffix}@example.test`;
  const res = await this.agent.post("/api/public/society-signup").send({
    societyName: `Test Soc ${suffix}`,
    adminName: "Admin User",
    adminEmail: email,
    adminPassword: "password123",
    marketingOptIn: false,
    acceptTerms: true,
  });
  recordResponse(this, res.status, res.headers, res.body);
  this.createdIds.lastSignupEmail = email;
  this.createdIds.lastSignupPassword = "password123";
  const body = res.body as { alphabeticId?: string };
  if (body?.alphabeticId) {
    this.createdIds.signupAlphabeticId = body.alphabeticId;
  }
});

When("I attempt login with the last public signup user", async function (this: IntegrationWorld) {
  const email = this.createdIds.lastSignupEmail;
  const password = this.createdIds.lastSignupPassword;
  const societyId = this.createdIds.signupAlphabeticId;
  assert.ok(email, "expected lastSignupEmail");
  assert.ok(password, "expected lastSignupPassword");
  assert.ok(societyId, "expected signupAlphabeticId");
  const res = await this.agent.post("/api/login").send({ email, password, societyId });
  recordResponse(this, res.status, res.headers, res.body);
});

When(
  "I mark the last signup user as email verified in the database",
  async function (this: IntegrationWorld) {
    const email = this.createdIds.lastSignupEmail;
    assert.ok(email);
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.username, email));
  }
);
