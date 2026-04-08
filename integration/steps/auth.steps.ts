import assert from "node:assert/strict";
import { Given } from "@cucumber/cucumber";

import type { IntegrationWorld } from "./world";

const DEMO_SOCIETY_ID = "GT001";

const EMAIL_BY_ROLE: Record<string, string> = {
  admin: "admin@txokoa.eus",
  bazkide: "bazkidea@txokoa.eus",
  diruzaina: "diruzaina@txokoa.eus",
  sotolaria: "sotolaria@txokoa.eus",
  laguna: "laguna@txokoa.eus",
};

function recordLoginResponse(world: IntegrationWorld, status: number, headers: unknown, body: unknown): void {
  world.lastResponse = {
    status,
    headers: headers as Record<string, string | string[] | undefined>,
    body,
  };
}

Given(
  "I am authenticated as a {string} user",
  async function (this: IntegrationWorld, role: string) {
    const email = EMAIL_BY_ROLE[role];
    assert.ok(email, `Unknown demo role: ${role}. Use: ${Object.keys(EMAIL_BY_ROLE).join(", ")}`);

    const res = await this.agent.post("/api/login").send({
      email,
      password: "demo",
      societyId: DEMO_SOCIETY_ID,
    });

    recordLoginResponse(this, res.status, res.headers, res.body);

    assert.strictEqual(res.status, 200, `Login failed: ${JSON.stringify(res.body)}`);

    const parsed = res.body as { token?: string };
    if (parsed?.token) {
      this.authToken = parsed.token;
    }
  }
);
