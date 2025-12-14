import { db } from '../server/db';
import { notifications, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function seedNotifications() {
  console.log('Seeding notifications...');

  // Get all users
  const allUsers = await db.select().from(users);
  
  if (allUsers.length === 0) {
    console.log('No users found. Please seed users first.');
    return;
  }

  // Get society ID from first user
  const societyId = allUsers[0].societyId;

  // Clear existing notifications
  await db.delete(notifications).where(eq(notifications.societyId, societyId));
  console.log('Cleared existing notifications');

  // Sample notifications for each user
  const sampleNotifications = [
    {
      title: 'Ongi etorri!',
      message: 'Ongi etorri Gure Txokoa aplikaziora. Hemen zure kontsumoak, erreserbak eta zorragaz arduratu ahal izango duzu.',
      type: 'info' as const,
    },
    {
      title: 'Erreserba berria',
      message: 'Zure erreserba ondo egin da. Eguberriko afaria 2024-12-24 datan konfirmatuta dago.',
      type: 'success' as const,
    },
    {
      title: 'Kontuaren abisua',
      message: 'Zure kontuan 50€ko zorra duzu. Mesedez, eguneratu zure ordainketa ahal den laister.',
      type: 'warning' as const,
    },
    {
      title: 'Produktu berria',
      message: 'Produktu berri gehitu dugu guregan: Gazta Berria. Ikusi produktuen atalean!',
      type: 'info' as const,
    },
    {
      title: 'Erreserba ezeztatua',
      message: 'Zure erreserba ezeztatu egin da. Jarri harremanetan administrarearekin informazio gehiagorako.',
      type: 'error' as const,
    },
  ];

  // Create notifications for each user
  for (const user of allUsers) {
    for (let i = 0; i < sampleNotifications.length; i++) {
      const notification = sampleNotifications[i];
      
      // Make some notifications read and some unread
      const isRead = Math.random() > 0.6; // 40% unread
      
      await db.insert(notifications).values({
        userId: user.id,
        societyId,
        title: notification.title,
        message: notification.message,
        isRead,
        readAt: isRead ? new Date() : null,
        createdAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)), // Each notification 1 day apart
        updatedAt: new Date(),
      });
    }
  }

  console.log('Notifications seeded successfully!');
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedNotifications()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error seeding notifications:', error);
      process.exit(1);
    });
}

export default seedNotifications;
