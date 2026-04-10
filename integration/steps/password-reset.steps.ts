import assert from "node:assert/strict";
import { After, Before, Then, When } from "@cucumber/cucumber";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

import { userPasswordResets, users } from "@shared/schema";
import { db } from "../../server/db";
import { setMailTransportForTests } from "../../server/lib/mail/transport";
import type { IntegrationWorld } from "./world";

let lastMailPayload: { html?: string; text?: string } | null = null;

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

function extractTokenFromMail(payload: { html?: string; text?: string }): string | null {
  const haystack = [payload.html, payload.text].filter(Boolean).join("\n");
  const m = haystack.match(/pasahitza-berrezarri\?token=([a-f0-9]+)/i);
  return m?.[1] ?? null;
}

Before({ tags: "@password-reset-mail" }, function () {
  lastMailPayload = null;
  setMailTransportForTests({
    async send(payload) {
      lastMailPayload = { html: payload.html, text: payload.text };
    },
  });
});

After({ tags: "@password-reset-mail" }, async function () {
  setMailTransportForTests(null);
  const hashed = await bcrypt.hash("demo", 10);
  await db
    .update(users)
    .set({ password: hashed, updatedAt: new Date() })
    .where(eq(users.username, "admin@txokoa.eus"));
  const admin = await db.query.users.findFirst({
    where: (u, { eq: e }) => e(u.username, "admin@txokoa.eus"),
  });
  if (admin) {
    await db.delete(userPasswordResets).where(eq(userPasswordResets.userId, admin.id));
  }
});

Then(
  "the last outbound mail should contain a password reset link",
  async function (this: IntegrationWorld) {
    assert.ok(lastMailPayload, "expected mail to be sent");
    const token = extractTokenFromMail(lastMailPayload);
    assert.ok(token && token.length >= 32, "expected token in mail body");
  }
);

When(
  "I POST to {string} with body from last mail token and new password {string}",
  async function (this: IntegrationWorld, path: string, newPassword: string) {
    assert.ok(lastMailPayload, "expected mail payload");
    const token = extractTokenFromMail(lastMailPayload);
    assert.ok(token, "could not parse token from mail");
    const res = await this.agent.post(path).send({ token, newPassword });
    recordResponse(this, res.status, res.headers, res.body);
  }
);
