import assert from "node:assert/strict";
import { Then } from "@cucumber/cucumber";

import type { IntegrationWorld } from "./world";

Then(
  "the setup checklist items should include the core ids",
  async function (this: IntegrationWorld) {
    assert.ok(this.lastResponse, "No response captured");
    const body = this.lastResponse.body as { items?: Array<{ id: string }> };
    assert.ok(body && typeof body === "object");
    assert.ok(Array.isArray(body.items));
    const ids = new Set(body.items.map(i => i.id));
    for (const id of ["contact", "sepa", "category", "product", "table", "members", "subdomain"]) {
      assert.ok(ids.has(id), `expected checklist item id ${id}`);
    }
  }
);
