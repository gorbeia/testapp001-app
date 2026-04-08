import assert from "node:assert/strict";
import { Given, When, Then } from "@cucumber/cucumber";
import request from "supertest";

import type { IntegrationWorld } from "./world";
import { getTestApp } from "./shared-state";

function recordResponse(
  world: IntegrationWorld,
  status: number,
  headers: Record<string, string | string[] | undefined>,
  body: unknown
): void {
  world.lastResponse = { status, headers, body };
}

Given("the API is available", async function (this: IntegrationWorld) {
  assert.ok(this.agent, "Supertest agent should exist");
});

When("I GET {string}", async function (this: IntegrationWorld, path: string) {
  const res = await this.agent.get(path);
  recordResponse(this, res.status, res.headers, res.body);
});

When("I POST to {string}", async function (this: IntegrationWorld, path: string) {
  const res = await this.agent.post(path).send({});
  recordResponse(this, res.status, res.headers, res.body);
});

When(
  "I POST to {string} with body:",
  async function (this: IntegrationWorld, path: string, docString: string) {
    const trimmed = docString.trim();
    const body = trimmed ? JSON.parse(trimmed) : {};
    const res = await this.agent.post(path).send(body);
    recordResponse(this, res.status, res.headers, res.body);
  }
);

When(
  "I PUT to {string} with body:",
  async function (this: IntegrationWorld, path: string, docString: string) {
    const trimmed = docString.trim();
    const body = trimmed ? JSON.parse(trimmed) : {};
    const res = await this.agent.put(path).send(body);
    recordResponse(this, res.status, res.headers, res.body);
  }
);

When("I DELETE {string}", async function (this: IntegrationWorld, path: string) {
  const res = await this.agent.delete(path);
  recordResponse(this, res.status, res.headers, res.body);
});

When(
  "I {word} {string} without authentication",
  async function (this: IntegrationWorld, method: string, path: string) {
    const app = getTestApp();
    const bare = request(app);
    const m = method.toUpperCase();
    let res: { status: number; headers: Record<string, string | string[] | undefined>; body: unknown };
    if (m === "GET") res = await bare.get(path);
    else if (m === "POST") res = await bare.post(path).send({});
    else if (m === "PUT") res = await bare.put(path).send({});
    else if (m === "DELETE") res = await bare.delete(path);
    else if (m === "PATCH") res = await bare.patch(path).send({});
    else throw new Error(`Unsupported method: ${method}`);
    recordResponse(this, res.status, res.headers, res.body);
  }
);

When("I POST to {string} with stored cookies", async function (this: IntegrationWorld, path: string) {
  const res = await this.agent.post(path).send({});
  recordResponse(this, res.status, res.headers, res.body);
});

Then("the response status should be {int}", async function (this: IntegrationWorld, expected: number) {
  assert.ok(this.lastResponse, "No response captured");
  assert.strictEqual(
    this.lastResponse.status,
    expected,
    `Expected status ${expected}, got ${this.lastResponse.status}: ${JSON.stringify(this.lastResponse.body)}`
  );
});

Then(
  "the response body should include property {string}",
  async function (this: IntegrationWorld, key: string) {
    assert.ok(this.lastResponse, "No response captured");
    assert.ok(this.lastResponse.body && typeof this.lastResponse.body === "object");
    assert.ok(Object.prototype.hasOwnProperty.call(this.lastResponse.body, key));
  }
);

Then(
  "the response body should include {string} equal to {string}",
  async function (this: IntegrationWorld, key: string, expected: string) {
    assert.ok(this.lastResponse, "No response captured");
    const body = this.lastResponse.body as Record<string, unknown>;
    assert.ok(body && typeof body === "object");
    assert.strictEqual(String(body[key]), expected);
  }
);

Then(
  "the response body should include {string} equal to {int}",
  async function (this: IntegrationWorld, key: string, expected: number) {
    assert.ok(this.lastResponse, "No response captured");
    const body = this.lastResponse.body as Record<string, unknown>;
    assert.ok(body && typeof body === "object");
    assert.strictEqual(Number(body[key]), expected);
  }
);

Then(
  "the response body {string} should be {string}",
  async function (this: IntegrationWorld, key: string, expected: string) {
    assert.ok(this.lastResponse, "No response captured");
    const body = this.lastResponse.body as Record<string, unknown>;
    assert.ok(body && typeof body === "object");
    assert.strictEqual(String(body[key]), expected);
  }
);

Then("the response body should be a JSON array", async function (this: IntegrationWorld) {
  assert.ok(this.lastResponse, "No response captured");
  assert.ok(Array.isArray(this.lastResponse.body));
});

Then(
  "the response body array length should be at least {int}",
  async function (this: IntegrationWorld, min: number) {
    assert.ok(this.lastResponse, "No response captured");
    assert.ok(Array.isArray(this.lastResponse.body));
    assert.ok(this.lastResponse.body.length >= min);
  }
);

Then(
  "the response should set cookie {string}",
  async function (this: IntegrationWorld, cookieName: string) {
    assert.ok(this.lastResponse, "No response captured");
    const raw = this.lastResponse.headers["set-cookie"];
    const list = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
    const found = list.some(c => c.split(";")[0].startsWith(`${cookieName}=`));
    assert.ok(found, `Expected Set-Cookie for ${cookieName}, got: ${JSON.stringify(list)}`);
  }
);
