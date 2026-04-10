import assert from "node:assert/strict";
import { Given, When } from "@cucumber/cucumber";

import type { IntegrationWorld } from "./world";

Given("I store the first category id from the catalog", async function (this: IntegrationWorld) {
  const res = await this.agent.get("/api/categories");
  assert.strictEqual(res.status, 200);
  const list = res.body as Array<{ id: string }>;
  assert.ok(list?.length);
  this.createdIds.category = list[0].id;
});

When("I create a unique integration test product via API", async function (this: IntegrationWorld) {
  const cat = this.createdIds.category;
  assert.ok(cat);
  const suffix = `${Date.now()}`;
  const res = await this.agent.post("/api/products").send({
    name: `Integration Product ${suffix}`,
    description: "integration",
    categoryId: cat,
    price: "9.99",
    stock: "100",
    unit: "unit",
    minStock: "0",
    supplier: null,
    isActive: true,
    stockMode: "manual",
  });
  this.lastResponse = {
    status: res.status,
    headers: res.headers as Record<string, string | string[] | undefined>,
    body: res.body,
  };
  const row = res.body as { id?: string };
  if (row?.id) this.createdIds.product = row.id;
});

When("I delete the last created product via API", async function (this: IntegrationWorld) {
  const id = this.createdIds.product;
  assert.ok(id);
  const res = await this.agent.delete(`/api/products/${id}`);
  this.lastResponse = {
    status: res.status,
    headers: res.headers as Record<string, string | string[] | undefined>,
    body: res.body,
  };
});

When(
  "I create a unique integration test product with catalog image via API",
  async function (this: IntegrationWorld) {
    const cat = this.createdIds.category;
    assert.ok(cat);
    const suffix = `${Date.now()}`;
    const res = await this.agent.post("/api/products").send({
      name: `Integration Product Catalog ${suffix}`,
      description: "integration",
      categoryId: cat,
      price: "9.99",
      stock: "100",
      unit: "unit",
      minStock: "0",
      supplier: null,
      isActive: true,
      stockMode: "manual",
      imageUrl: "/catalog/products/cocacola.png",
    });
    this.lastResponse = {
      status: res.status,
      headers: res.headers as Record<string, string | string[] | undefined>,
      body: res.body,
    };
    const row = res.body as { id?: string };
    if (row?.id) this.createdIds.product = row.id;
  }
);

When(
  "I create an integration test product with invalid catalog imageUrl via API",
  async function (this: IntegrationWorld) {
    const cat = this.createdIds.category;
    assert.ok(cat);
    const suffix = `${Date.now()}`;
    const res = await this.agent.post("/api/products").send({
      name: `Integration Product BadImg ${suffix}`,
      description: "integration",
      categoryId: cat,
      price: "9.99",
      stock: "100",
      unit: "unit",
      minStock: "0",
      supplier: null,
      isActive: true,
      stockMode: "manual",
      imageUrl: "/catalog/products/not-in-catalog.png",
    });
    this.lastResponse = {
      status: res.status,
      headers: res.headers as Record<string, string | string[] | undefined>,
      body: res.body,
    };
  }
);

When(
  "I PUT the catalog tortilla image on the last created product via API",
  async function (this: IntegrationWorld) {
    const id = this.createdIds.product;
    assert.ok(id);
    const res = await this.agent.put(`/api/products/${id}`).send({
      imageUrl: "/catalog/products/tortilla.png",
    });
    this.lastResponse = {
      status: res.status,
      headers: res.headers as Record<string, string | string[] | undefined>,
      body: res.body,
    };
  }
);
