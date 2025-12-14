import { db } from '../server/db';
import { notifications, notificationMessages, users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

async function seedMultilingualNotifications() {
  console.log('Seeding multilingual notifications...');

  // Get all users
  const allUsers = await db.select().from(users);
  
  if (allUsers.length === 0) {
    console.log('No users found. Please seed users first.');
    return;
  }

  // Get society ID from first user
  const societyId = allUsers[0].societyId;

  // Clear existing notifications and messages
  await db.delete(notifications).where(eq(notifications.societyId, societyId));
  // Messages will be deleted automatically due to ON DELETE CASCADE
  console.log('Cleared existing notifications and messages');

  // Sample multilingual notifications for each user
  const sampleNotifications = [
    {
      defaultLanguage: 'eu' as const,
      messages: {
        eu: {
          title: 'Ongi etorri!',
          message: 'Ongi etorri Gure Txokoa aplikaziora. Hemen zure kontsumoak, erreserbak eta zorragaz arduratu ahal izango duzu.',
        },
        es: {
          title: '¡Bienvenido!',
          message: 'Bienvenido a la aplicación Gure Txokoa. Aquí podrás gestionar tus consumos, reservas y deudas.',
        },
        en: {
          title: 'Welcome!',
          message: 'Welcome to the Gure Txokoa application. Here you can manage your consumptions, reservations and debts.',
        },
      },
      type: 'info' as const,
    },
    {
      defaultLanguage: 'eu' as const,
      messages: {
        eu: {
          title: 'Erreserba berria',
          message: 'Zure erreserba ondo egin da. Eguberriko afaria 2024-12-24 datan konfirmatuta dago.',
        },
        es: {
          title: 'Nueva reserva',
          message: 'Tu reserva se ha realizado correctamente. La cena de Navidad del 2024-12-24 está confirmada.',
        },
        en: {
          title: 'New reservation',
          message: 'Your reservation has been successfully made. Christmas dinner on 2024-12-24 is confirmed.',
        },
      },
      type: 'success' as const,
    },
    {
      defaultLanguage: 'eu' as const,
      messages: {
        eu: {
          title: 'Kontuaren abisua',
          message: 'Zure kontuan 50€ko zorra duzu. Mesedez, eguneratu zure ordainketa ahal den laister.',
        },
        es: {
          title: 'Aviso de cuenta',
          message: 'Tienes una deuda de 50€ en tu cuenta. Por favor, actualiza tu pago lo antes posible.',
        },
        en: {
          title: 'Account warning',
          message: 'You have a debt of 50€ in your account. Please update your payment as soon as possible.',
        },
      },
      type: 'warning' as const,
    },
    {
      defaultLanguage: 'eu' as const,
      messages: {
        eu: {
          title: 'Produktu berria',
          message: 'Produktu berri gehitu dugu guregan: Gazta Berria. Ikusi produktuen atalean!',
        },
        es: {
          title: 'Nuevo producto',
          message: 'Hemos añadido un nuevo producto: Queso Nuevo. ¡Míralo en la sección de productos!',
        },
        en: {
          title: 'New product',
          message: 'We have added a new product: New Cheese. Check it out in the products section!',
        },
      },
      type: 'info' as const,
    },
    {
      defaultLanguage: 'eu' as const,
      messages: {
        eu: {
          title: 'Erreserba ezeztatua',
          message: 'Zure erreserba ezeztatu egin da. Jarri harremanetan administrarearekin informazio gehiagorako.',
        },
        es: {
          title: 'Reserva cancelada',
          message: 'Tu reserva ha sido cancelada. Ponte en contacto con el administrador para más información.',
        },
        en: {
          title: 'Reservation cancelled',
          message: 'Your reservation has been cancelled. Contact the administrator for more information.',
        },
      },
      type: 'error' as const,
    },
  ];

  // Create notifications for each user
  for (const user of allUsers) {
    for (let i = 0; i < sampleNotifications.length; i++) {
      const notificationTemplate = sampleNotifications[i];
      
      // Make some notifications read and some unread
      const isRead = Math.random() > 0.6; // 40% unread
      
      // Create the notification
      const newNotification = await db.insert(notifications).values({
        userId: user.id,
        societyId,
        title: notificationTemplate.messages[notificationTemplate.defaultLanguage].title,
        message: notificationTemplate.messages[notificationTemplate.defaultLanguage].message,
        type: notificationTemplate.type,
        isRead,
        readAt: isRead ? new Date() : null,
        defaultLanguage: notificationTemplate.defaultLanguage,
        createdAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)), // Each notification 1 day apart
        updatedAt: new Date(),
      }).returning();

      // Create multilingual messages
      const messageEntries = Object.entries(notificationTemplate.messages).map(([lang, msg]) => ({
        notificationId: newNotification[0].id,
        language: lang,
        title: msg.title,
        message: msg.message,
      }));

      await db.insert(notificationMessages).values(messageEntries);
    }
  }

  console.log('Multilingual notifications seeded successfully!');
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedMultilingualNotifications()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error seeding multilingual notifications:', error);
      process.exit(1);
    });
}

export default seedMultilingualNotifications;
