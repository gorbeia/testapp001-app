import { After, Before } from "@cucumber/cucumber";
import { eq } from "drizzle-orm";

import { db } from "../../server/db";
import { DEMO_SOCIETY_ID } from "../../script/seed-demo-society";
import { DEFAULT_RESERVATION_MEAL_TYPES, societies } from "@shared/schema";

const restrictedMealTypes = [
  { id: "lunch", labelEu: "Bazkaria (test)", labelEs: "Comida (test)" },
] as const;

Before({ tags: "@reservation-meal-types-restricted" }, async function () {
  await db
    .update(societies)
    .set({
      reservationMealTypes: [...restrictedMealTypes],
      updatedAt: new Date(),
    })
    .where(eq(societies.id, DEMO_SOCIETY_ID));
});

After({ tags: "@reservation-meal-types-restricted" }, async function () {
  await db
    .update(societies)
    .set({
      reservationMealTypes: DEFAULT_RESERVATION_MEAL_TYPES,
      updatedAt: new Date(),
    })
    .where(eq(societies.id, DEMO_SOCIETY_ID));
});
