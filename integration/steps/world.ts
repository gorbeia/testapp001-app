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
  /** IDs and scratch strings captured during scenario (e.g. last reservation, calendar test ISO dates). */
  createdIds: Record<string, string> = {};
  /** Set by society steps when updating `reservationMealTypes` for assertions. */
  integrationTestMealTypes?: Array<{ id: string; labelEu: string; labelEs: string }>;

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(IntegrationWorld);
