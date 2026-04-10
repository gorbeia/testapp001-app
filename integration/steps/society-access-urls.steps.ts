import assert from "node:assert/strict";
import { After, Before, Then, When } from "@cucumber/cucumber";

import { setMailTransportForTests } from "../../server/lib/mail/transport";
import type { IntegrationWorld } from "./world";

let apexEnvBackup: string | undefined;
let mailPayload: { html?: string; text?: string } | null = null;

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

Before({ tags: "@society-access-urls-mail" }, function () {
  apexEnvBackup = process.env.TENANT_APEX_DOMAIN;
  process.env.TENANT_APEX_DOMAIN = "example.com";
  mailPayload = null;
  setMailTransportForTests({
    async send(payload) {
      mailPayload = { html: payload.html, text: payload.text };
    },
  });
});

After({ tags: "@society-access-urls-mail" }, function () {
  setMailTransportForTests(null);
  if (apexEnvBackup === undefined) {
    delete process.env.TENANT_APEX_DOMAIN;
  } else {
    process.env.TENANT_APEX_DOMAIN = apexEnvBackup;
  }
});

Before({ tags: "@society-access-no-apex" }, function () {
  apexEnvBackup = process.env.TENANT_APEX_DOMAIN;
  delete process.env.TENANT_APEX_DOMAIN;
});

After({ tags: "@society-access-no-apex" }, function () {
  if (apexEnvBackup === undefined || apexEnvBackup === "") {
    delete process.env.TENANT_APEX_DOMAIN;
  } else {
    process.env.TENANT_APEX_DOMAIN = apexEnvBackup;
  }
});

Before({ tags: "@society-login-apex-block" }, function () {
  apexEnvBackup = process.env.TENANT_APEX_DOMAIN;
  process.env.TENANT_APEX_DOMAIN = "example.com";
});

After({ tags: "@society-login-apex-block" }, function () {
  if (apexEnvBackup === undefined) {
    delete process.env.TENANT_APEX_DOMAIN;
  } else {
    process.env.TENANT_APEX_DOMAIN = apexEnvBackup;
  }
});

Then(
  "the last reminder mail should contain tenant link {string}",
  async function (this: IntegrationWorld, fragment: string) {
    assert.ok(mailPayload, "expected mail to be sent");
    const hay = [mailPayload.html, mailPayload.text].filter(Boolean).join("\n");
    assert.ok(
      hay.includes(fragment),
      `expected mail body to include ${fragment}, got length ${hay.length}`
    );
  }
);

When(
  "I POST to {string} from host {string} with body:",
  async function (this: IntegrationWorld, path: string, host: string, docString: string) {
    const trimmed = docString.trim();
    const body = trimmed ? JSON.parse(trimmed) : {};
    const res = await this.agent.post(path).set("Host", host).send(body);
    recordResponse(this, res.status, res.headers, res.body);
  }
);

Then(
  "the response body should contain code {string}",
  async function (this: IntegrationWorld, code: string) {
    const body = this.lastResponse?.body as { code?: string } | undefined;
    assert.equal(body?.code, code);
  }
);
