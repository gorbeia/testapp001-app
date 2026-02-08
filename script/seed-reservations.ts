import { db } from "../server/db";
import { reservations, societies, users, tables, type Reservation } from "../shared/schema";
import { eq } from "drizzle-orm";

export async function seedReservations() {
  try {
    console.log("Seeding reservations...");

    // Get the active society or the first one
    let societyId = "";
    const activeSociety = await db
      .select()
      .from(societies)
      .where(eq(societies.isActive, true))
      .limit(1);
    if (activeSociety.length === 0) {
      const firstSociety = await db.select().from(societies).limit(1);
      if (firstSociety.length === 0) {
        throw new Error("No societies found in database");
      }
      societyId = firstSociety[0].id;
    } else {
      societyId = activeSociety[0].id;
    }

    console.log("Using society ID for reservations:", societyId);

    // Get the first user (admin) for reservations
    const [firstUser] = await db.select().from(users).limit(1);
    if (!firstUser) {
      throw new Error("No users found in database");
    }

    console.log("Using user ID for reservations:", firstUser.id);

    // Get all active tables
    const activeTables = await db.select().from(tables).where(eq(tables.isActive, true));
    if (activeTables.length === 0) {
      console.log("No active tables found, skipping reservation seeding");
      return;
    }

    console.log(
      "Found active tables:",
      activeTables.map(t => t.name)
    );

    // Get the active society to use correct pricing
    const [society] = await db
      .select()
      .from(societies)
      .where(eq(societies.isActive, true))
      .limit(1);
    if (!society) {
      throw new Error("No active society found for pricing");
    }

    const reservationPrice = parseFloat(society.reservationPricePerMember || "2");
    const kitchenPrice = parseFloat(society.kitchenPricePerMember || "3");

    console.log(
      `Using society pricing: ${reservationPrice}€/person reservation, ${kitchenPrice}€/person kitchen`
    );

    const dummyReservations: Omit<
      Reservation,
      | "createdAt"
      | "updatedAt"
      | "totalAmount"
      | "cancellationReason"
      | "cancelledBy"
      | "cancelledAt"
    >[] = [
      {
        id: "550e8400-e29b-4d69-a516-31095a414aa6",
        userId: firstUser.id,
        name: "Urte Berria",
        type: "bazkaria",
        status: "confirmed",
        startDate: new Date("2025-12-25T18:00:00Z"),
        guests: 15, // Adjusted for Gela Pribatua capacity
        useKitchen: true,
        table: "Gela Pribatua", // Using actual table name
        notes: "Janariak 25eko urte berria",
        societyId,
      },
      {
        id: "660f9b20-1a3c-4e7b-9f8d-2d3e8c9f5a1b",
        userId: firstUser.id,
        name: "Bilera Familiarra",
        type: "afaria",
        status: "confirmed",
        startDate: new Date("2025-12-31T20:00:00Z"),
        guests: 8, // Adjusted for Mahaia 5 capacity
        useKitchen: false,
        table: "Mahaia 5", // Using actual table name
        notes: "Ezkontzeko familia biltzarra",
        societyId,
      },
      {
        id: "770b8c30-2d4d-4f8e-9c9e-3e4f9d0a6b2c",
        userId: firstUser.id,
        name: "Bilera Enpresa",
        type: "bazkaria",
        status: "confirmed",
        startDate: new Date("2026-01-15T19:00:00Z"),
        guests: 6, // Adjusted for Mahaia 4 capacity
        useKitchen: true,
        table: "Mahaia 4", // Using actual table name
        notes: "Enpresako bilera ofiziala",
        societyId,
      },
      {
        id: "880c9d40-3e5e-4f9f-9d0f-4f5a0b7c8d3d",
        userId: firstUser.id,
        name: "Batzarra",
        type: "hamaiketakoa",
        status: "confirmed",
        startDate: new Date("2025-12-20T12:00:00Z"),
        guests: 4, // Adjusted for Mahaia 3 capacity
        useKitchen: false,
        table: "Mahaia 3", // Using actual table name
        notes: "Batzar gaueko batzarra",
        societyId,
      },
      {
        id: "990d0e50-4f6f-5g0g-0e1g-5g6b1c8d9e4e",
        userId: firstUser.id,
        name: "Ondo Pasatzeko",
        type: "bazkaria",
        status: "confirmed",
        startDate: new Date("2025-12-15T19:00:00Z"),
        guests: 3, // Adjusted for Mahaia 1 capacity
        useKitchen: false,
        table: "Mahaia 1", // Using actual table name
        notes: "Lagun arteko bazkaria",
        societyId,
      },
      {
        id: "110e1f60-5g7g-6h1h-1f2h-6h7c2d9e0f5f",
        userId: firstUser.id,
        name: "Eguberriko Afaria",
        type: "afaria",
        status: "pending",
        startDate: new Date("2025-12-24T21:00:00Z"),
        guests: 2, // Adjusted for Mahaia 2 capacity
        useKitchen: false,
        table: "Mahaia 2", // Using actual table name
        notes: "Eguberriko afaria familiarra",
        societyId,
      },
    ];

    // November reservations for Mikel Etxeberria
    const mikelNovemberReservations: Omit<
      Reservation,
      | "createdAt"
      | "updatedAt"
      | "totalAmount"
      | "cancellationReason"
      | "cancelledBy"
      | "cancelledAt"
    >[] = [
      {
        id: "mikel-nov-001",
        userId: firstUser.id,
        name: "Urriaren 30ko Bazkaria",
        type: "bazkaria",
        status: "completed",
        startDate: new Date("2025-11-30T19:00:00Z"),
        guests: 4,
        useKitchen: true,
        table: "Mahaia 2",
        notes: "Azkeneko urteko azken bazkaria",
        societyId,
      },
      {
        id: "mikel-nov-002",
        userId: firstUser.id,
        name: "Azaroaren 15ko Bilera",
        type: "askaria",
        status: "completed",
        startDate: new Date("2025-11-15T20:00:00Z"),
        guests: 6,
        useKitchen: false,
        table: "Mahaia 4",
        notes: "Neguko planifikazio bilera",
        societyId,
      },
      {
        id: "mikel-nov-003",
        userId: firstUser.id,
        name: "San Martin Eguna",
        type: "afaria",
        status: "completed",
        startDate: new Date("2025-11-11T21:00:00Z"),
        guests: 8,
        useKitchen: true,
        table: "Gela Pribatua",
        notes: "San Martin eguneko afaria",
        societyId,
      },
      {
        id: "mikel-nov-004",
        userId: firstUser.id,
        name: "Neguko Afaria",
        type: "afaria",
        status: "completed",
        startDate: new Date("2025-11-25T20:30:00Z"),
        guests: 5,
        useKitchen: true,
        table: "Mahaia 3",
        notes: "Neguko sasoia hasteko afaria",
        societyId,
      },
    ];

    // Additional reservations for 2024 and earlier 2025 months for pagination testing
    const historicalReservations: Omit<
      Reservation,
      | "createdAt"
      | "updatedAt"
      | "totalAmount"
      | "cancellationReason"
      | "cancelledBy"
      | "cancelledAt"
    >[] = [];

    // Generate reservations for each month from January 2024 to November 2025
    const eventTypes = ["bazkaria", "afaria", "askaria", "hamaiketakoa"];
    const statuses = ["completed", "cancelled", "confirmed"];
    const eventNames = [
      "Bilera Familiarra",
      "Eguberriko Afaria",
      "Urte Berri",
      "Batzarra",
      "Enpresa Bilera",
      "Ondo Pasatzeko",
      "Lagun Bilkura",
      "Familia Biltzarra",
      "Neguko Bazkaria",
      "Udako Afaria",
      "Asteburuko Bilkura",
      "Madrugaldeko Hamaiketakoa",
      "Otsaileko Bazkaria",
      "Martxoko Askaria",
      "Apirileko Afaria",
      "Maiatzko Bazkaria",
      "Ekaineko Hamaiketakoa",
      "Uztaileko Afaria",
      "Abuztuko Bazkaria",
      "Irailileko Askaria",
      "Urriko Hamaiketakoa",
      "Azaroko Bazkaria",
      "Abenduko Afaria",
    ];

    // Generate 3-5 reservations per month for each month from Jan 2024 to Nov 2025
    for (let year = 2024; year <= 2025; year++) {
      for (let month = 1; month <= 12; month++) {
        // Skip December 2025 since we already have some reservations for it
        if (year === 2025 && month === 12) continue;

        // Skip future months in 2025 (only include past months)
        if (year === 2025 && month > new Date().getMonth() + 1) continue;

        const numReservations = Math.floor(Math.random() * 3) + 3; // 3-5 reservations per month

        for (let i = 0; i < numReservations; i++) {
          const day = Math.floor(Math.random() * 28) + 1; // Random day 1-28
          const hour = Math.floor(Math.random() * 14) + 11; // Random hour 11-24
          const minute = Math.random() < 0.5 ? 0 : 30; // Either :00 or :30

          const startDate = new Date(year, month - 1, day, hour, minute);

          // Skip if this is a future date
          if (startDate > new Date()) continue;

          historicalReservations.push({
            id: `hist-${year}-${month}-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId: firstUser.id,
            name: eventNames[Math.floor(Math.random() * eventNames.length)],
            type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
            status: statuses[Math.floor(Math.random() * statuses.length)],
            startDate: startDate,
            guests: Math.floor(Math.random() * 8) + 2, // 2-10 guests
            useKitchen: Math.random() < 0.3, // 30% chance of using kitchen
            table: activeTables[Math.floor(Math.random() * activeTables.length)].name,
            notes: `Historical reservation from ${year}-${month.toString().padStart(2, "0")}`,
            societyId,
          });
        }
      }
    }

    // Smart table assignment function
    const findBestTable = (guestCount: number, excludeTables: string[] = []): string | null => {
      const suitableTables = activeTables.filter(
        table =>
          !excludeTables.includes(table.name) &&
          guestCount >= (table.minCapacity ?? 1) &&
          guestCount <= table.maxCapacity
      );

      if (suitableTables.length === 0) return null;

      // Prefer tables with capacity closest to guest count
      return suitableTables.reduce((best, current) => {
        const bestDiff = best.maxCapacity - guestCount;
        const currentDiff = current.maxCapacity - guestCount;
        return currentDiff < bestDiff ? current : best;
      }).name;
    };

    // Track statistics
    let skippedCount = 0;
    let addedCount = 0;
    let reassignedCount = 0;

    console.log(
      `Generated ${historicalReservations.length} historical reservations for pagination testing`
    );

    // Combine all reservations
    const allReservations = [
      ...dummyReservations,
      ...mikelNovemberReservations,
      ...historicalReservations,
    ];

    // Calculate totalAmount for each reservation using society pricing
    const reservationsWithAmounts = allReservations.map(reservation => {
      const reservationCost = (reservation.guests ?? 0) * reservationPrice;
      const kitchenCost = reservation.useKitchen ? (reservation.guests ?? 0) * kitchenPrice : 0;
      const totalAmount = reservationCost + kitchenCost;

      return {
        ...reservation,
        totalAmount: totalAmount.toString(),
      };
    });

    for (const reservation of reservationsWithAmounts) {
      // Check if reservation already exists (idempotent)
      const existing = await db
        .select()
        .from(reservations)
        .where(eq(reservations.id, reservation.id))
        .limit(1);

      if (existing.length > 0) {
        console.log(`Reservation already exists: ${reservation.name} (skipping)`);
        continue;
      }

      // Verify that the table exists and is active
      const tableExists = activeTables.some(table => table.name === reservation.table);
      if (!tableExists) {
        console.log(
          `Table '${reservation.table}' not found or inactive for reservation '${reservation.name}' (skipping)`
        );
        continue;
      }

      // Smart table assignment with fallback
      let assignedTable = reservation.table;
      let wasReassigned = false;

      // First try the assigned table
      const table = activeTables.find(t => t.name === reservation.table);
      if (
        !table ||
        reservation.guests === null ||
        reservation.guests < (table.minCapacity ?? 1) ||
        reservation.guests > table.maxCapacity
      ) {
        // Try to find a better table
        const betterTable = findBestTable(reservation.guests ?? 1);
        if (betterTable) {
          assignedTable = betterTable;
          wasReassigned = true;
          reassignedCount++;
        } else {
          skippedCount++;
          continue;
        }
      }

      // Insert new reservation
      const newReservation = {
        ...reservation,
        table: assignedTable,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(reservations).values(newReservation);
      addedCount++;

      if (wasReassigned) {
        console.log(
          `Added reservation: ${reservation.name} -> reassigned to ${assignedTable} for ${reservation.guests} guests`
        );
      } else {
        console.log(
          `Added reservation: ${reservation.name} at ${assignedTable} for ${reservation.guests} guests`
        );
      }
    }

    console.log(`\n=== Reservation Seeding Summary ===`);
    console.log(`Total processed: ${reservationsWithAmounts.length}`);
    console.log(`Successfully added: ${addedCount}`);
    console.log(`Skipped (no suitable table): ${skippedCount}`);
    console.log(`Reassigned to better tables: ${reassignedCount}`);
    console.log("Reservations seeded successfully!");
  } catch (error) {
    console.error("Error seeding reservations:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedReservations()
    .then(() => {
      console.log("Seed completed successfully");
      process.exit(0);
    })
    .catch(error => {
      console.error("Seed failed:", error);
      process.exit(1);
    });
}
