import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { BeforeAll, Before } from "@cucumber/cucumber";
import request from "supertest";

import { createApp } from "../../server/app";
import { getTestApp, setTestApp } from "./shared-state";
import { IntegrationWorld } from "./world";

const integrationDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(integrationDir, "../..");
config({ path: path.join(repoRoot, ".env"), quiet: true });
config({ path: path.join(repoRoot, ".env.local"), quiet: true, override: true });

BeforeAll(async function () {
  const { app } = await createApp();
  setTestApp(app);
});

Before(function (this: IntegrationWorld) {
  const app = getTestApp();
  this.agent = request.agent(app);
  this.lastResponse = null;
  this.authToken = undefined;
  this.createdIds = {};
});
