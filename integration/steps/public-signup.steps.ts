import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";
import { and, eq } from "drizzle-orm";

import { categoryMessages, productCategories, tables, users } from "@shared/schema";
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
    const alphabeticId = this.createdIds.signupAlphabeticId;
    assert.ok(email);
    assert.ok(alphabeticId);
    const society = await db.query.societies.findFirst({
      where: (s, { eq: e }) => e(s.alphabeticId, alphabeticId),
    });
    assert.ok(society);
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(users.username, email), eq(users.societyId, society.id)));
  }
);

Then(
  "the last signup society should have default provision data",
  async function (this: IntegrationWorld) {
    const alphabeticId = this.createdIds.signupAlphabeticId;
    assert.ok(alphabeticId, "expected signupAlphabeticId");
    const society = await db.query.societies.findFirst({
      where: (s, { eq: e }) => e(s.alphabeticId, alphabeticId),
    });
    assert.ok(society, "society row");
    assert.equal(society.sepaMode, "disabled");
    assert.equal(society.isActive, true);

    const cats = await db
      .select()
      .from(productCategories)
      .where(eq(productCategories.societyId, society.id));
    assert.equal(cats.length, 1, "one bootstrap category");
    assert.equal(cats[0]?.icon, "Package");

    const msgs = await db
      .select()
      .from(categoryMessages)
      .where(eq(categoryMessages.categoryId, cats[0]!.id));
    assert.equal(msgs.length, 2, "eu + es category messages");
    const langs = new Set(msgs.map(m => m.language));
    assert.ok(langs.has("eu") && langs.has("es"));

    const tbls = await db.select().from(tables).where(eq(tables.societyId, society.id));
    assert.equal(tbls.length, 1, "one bootstrap table");
    assert.equal(tbls[0]?.name, "Mahaia 1");
    assert.equal(tbls[0]?.minCapacity, 1);
    assert.equal(tbls[0]?.maxCapacity, 50);
  }
);
