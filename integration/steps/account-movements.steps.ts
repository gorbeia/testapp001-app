import assert from "node:assert/strict";
import { Given, Then, When } from "@cucumber/cucumber";

import type { IntegrationWorld } from "./world";
import { db } from "../../server/db";
import { accountMovements, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const MIREN_USER_ID = "550e8400-e29b-41d4-a716-446655440004";
const DEMO_SOCIETY_ID = "550e8400-e29b-41d4-a716-446655440000";

// Helper to get user ID by username (email)
async function getUserIdByEmail(email: string): Promise<string> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, email), eq(users.societyId, DEMO_SOCIETY_ID)));
  if (!user) {
    throw new Error(`User with username ${email} not found`);
  }
  return user.id;
}

// Helper to create a movement for testing
async function createTestMovement(
  userId: string,
  type: string = "consumption",
  amount: string = "-50.00"
): Promise<string> {
  const [movement] = await db
    .insert(accountMovements)
    .values({
      societyId: DEMO_SOCIETY_ID,
      userId,
      type,
      amount: parseFloat(amount),
      description: "Test movement for correction",
      referenceId: null,
      referenceType: null,
      createdBy: "test",
      correctedById: null,
      isCorrection: false,
      correctionReason: null,
    })
    .returning({ id: accountMovements.id });
  return movement.id;
}

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

// Store movement IDs for later use
Given(
  "a consumption movement exists for {string}",
  async function (this: IntegrationWorld, userLabel: string) {
    const email = userLabel === "Miren" ? "bazkidea@txokoa.eus" : "admin@txokoa.eus";
    const userId = await getUserIdByEmail(email);
    const movementId = await createTestMovement(userId, "consumption", "-50.00");
    this.createdIds[`movement_${userLabel}`] = movementId;
  }
);

Given(
  "a correction movement exists for {string}",
  async function (this: IntegrationWorld, userLabel: string) {
    const email = userLabel === "Miren" ? "bazkidea@txokoa.eus" : "admin@txokoa.eus";
    const userId = await getUserIdByEmail(email);
    const movementId = await createTestMovement(userId, "correction", "25.00");
    this.createdIds[`correction_${userLabel}`] = movementId;
  }
);

Given("that movement has been corrected", async function (this: IntegrationWorld) {
  // Get the movement ID from the last created movement
  const movementId = Object.values(this.createdIds).find(id => id.startsWith("mov"));
  assert.ok(movementId, "No movement found to mark as corrected");

  // Mark it as corrected by creating a dummy correction
  await db
    .update(accountMovements)
    .set({ correctedById: "dummy-correction-id", correctionReason: "Already corrected" })
    .where(eq(accountMovements.id, movementId));
});

When(
  "I create a correction for that movement with amount {string} and reason {string}",
  async function (this: IntegrationWorld, amount: string, reason: string) {
    // Find the movement ID
    const movementId = Object.values(this.createdIds).find(id => id.startsWith("mov"));
    assert.ok(movementId, "No movement found to correct");

    const res = await this.agent.post("/api/account-movements/correction").send({
      originalMovementId: movementId,
      amount,
      reason,
    });
    this.lastResponse = {
      status: res.status,
      headers: res.headers as Record<string, string | string[] | undefined>,
      body: res.body,
    };
  }
);

When(
  "I create a correction for movement {string} with amount {string} and reason {string}",
  async function (this: IntegrationWorld, movementId: string, amount: string, reason: string) {
    const res = await this.agent.post("/api/account-movements/correction").send({
      originalMovementId: movementId,
      amount,
      reason,
    });
    this.lastResponse = {
      status: res.status,
      headers: res.headers as Record<string, string | string[] | undefined>,
      body: res.body,
    };
  }
);

When(
  "I create a correction for that correction movement with amount {string} and reason {string}",
  async function (this: IntegrationWorld, amount: string, reason: string) {
    // Find the correction ID
    const correctionId = Object.values(this.createdIds).find(id => id.startsWith("correction"));
    assert.ok(correctionId, "No correction found to correct");

    const res = await this.agent.post("/api/account-movements/correction").send({
      originalMovementId: correctionId,
      amount,
      reason,
    });
    this.lastResponse = {
      status: res.status,
      headers: res.headers as Record<string, string | string[] | undefined>,
      body: res.body,
    };
  }
);

// Step definitions for checking response body properties
Then(
  "the response body should include property {string} with value true",
  function (this: IntegrationWorld, property: string) {
    assert.ok(this.lastResponse, "No last response recorded");
    assert.ok(this.lastResponse.body, "Response body is empty");
    assert.strictEqual(
      this.lastResponse.body[property],
      true,
      `Expected ${property} to be true, got ${this.lastResponse.body[property]}`
    );
  }
);

Then(
  "the response body should include property {string} with value {string}",
  function (this: IntegrationWorld, property: string, expectedValue: string) {
    assert.ok(this.lastResponse, "No last response recorded");
    assert.ok(this.lastResponse.body, "Response body is empty");
    assert.strictEqual(
      this.lastResponse.body[property],
      expectedValue,
      `Expected ${property} to be ${expectedValue}, got ${this.lastResponse.body[property]}`
    );
  }
);
