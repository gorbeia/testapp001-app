import { World, IWorldOptions, setWorldConstructor } from "@cucumber/cucumber";
import type { SuperTest, Test } from "supertest";

export interface LastResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

export class IntegrationWorld extends World {
  agent!: SuperTest<Test>;
  lastResponse: LastResponse | null = null;
  authToken?: string;
  /** IDs captured during scenario (e.g. last created reservation). */
  createdIds: Record<string, string> = {};

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(IntegrationWorld);
