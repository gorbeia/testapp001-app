import { db } from '../server/db';
import { chatRooms, chatMessages, users } from '@shared/schema';
import { eq, and, or } from 'drizzle-orm';

async function seedChatData() {
  try {
    console.log('Starting chat data seeding...');

    // Get all users from the database
    const allUsers = await db.select().from(users);
    if (allUsers.length === 0) {
      console.log('No users found. Please seed users first.');
      return;
    }

    console.log(`Found ${allUsers.length} users`);

    // Create direct message rooms between users
    // Based on the frontend prototype, we'll create rooms for specific pairs
    const userPairs = [
      { user1: 'Mikel Etxeberria', user2: 'Ane Zelaia' },
      { user1: 'Mikel Etxeberria', user2: 'Miren Urrutia' },
      { user1: 'Mikel Etxeberria', user2: 'Jon Agirre' },
      { user1: 'Ane Zelaia', user2: 'Jon Agirre' },
    ];

    const createdRooms = [];

    for (const pair of userPairs) {
      const user1 = allUsers.find(u => u.name === pair.user1);
      const user2 = allUsers.find(u => u.name === pair.user2);

      if (!user1 || !user2) {
        console.log(`Skipping pair ${pair.user1} - ${pair.user2}: users not found`);
        continue;
      }

      // Check if room already exists (in either order)
      const existingRoom = await db.select().from(chatRooms).where(
        and(
          eq(chatRooms.societyId, user1.societyId),
          or(
            and(eq(chatRooms.user1Id, user1.id), eq(chatRooms.user2Id, user2.id)),
            and(eq(chatRooms.user1Id, user2.id), eq(chatRooms.user2Id, user1.id))
          )
        )
      ).limit(1);

      if (existingRoom.length > 0) {
        console.log(`Room already exists for ${pair.user1} - ${pair.user2}`);
        createdRooms.push(existingRoom[0]);
        continue;
      }

      // Create chat room
      const [newRoom] = await db.insert(chatRooms).values({
        user1Id: user1.id,
        user2Id: user2.id,
        societyId: user1.societyId,
        isActive: true,
      }).returning();

      createdRooms.push(newRoom);
      console.log(`Created chat room between ${pair.user1} and ${pair.user2}`);
    }

    // Sample messages based on the frontend prototype
    const sampleMessages = [
      {
        roomIndex: 0, // Mikel - Current User
        senderIndex: 0, // Mikel
        content: 'Kaixo! Bihar erreserbatzen?',
        timeOffset: -4 * 60 * 60 * 1000, // 4 hours ago
      },
      {
        roomIndex: 0, // Mikel - Current User  
        senderIndex: 1, // Current User
        content: 'Bai, afaria egiteko pentsatzen genuen',
        timeOffset: -3 * 60 * 60 * 1000, // 3 hours ago
      },
      {
        roomIndex: 0, // Mikel - Current User
        senderIndex: 0, // Mikel
        content: 'Bikaina! Zenbat izango zarete?',
        timeOffset: -2.8 * 60 * 60 * 1000, // 2.8 hours ago
      },
      {
        roomIndex: 0, // Mikel - Current User
        senderIndex: 1, // Current User
        content: '8 lagun gutxi gorabehera',
        timeOffset: -2.5 * 60 * 60 * 1000, // 2.5 hours ago
      },
      {
        roomIndex: 2, // Jon - Current User
        senderIndex: 0, // Jon
        content: 'Txakoli berria probatu duzu?',
        timeOffset: -5 * 60 * 60 * 1000, // 5 hours ago
      },
    ];

    // Insert sample messages
    for (const messageData of sampleMessages) {
      if (messageData.roomIndex >= createdRooms.length) continue;

      const room = createdRooms[messageData.roomIndex];
      const sender = messageData.senderIndex === 0 ? 
        allUsers.find(u => u.id === room.user1Id) :
        allUsers.find(u => u.id === room.user2Id);

      if (!sender) continue;

      const messageTime = new Date(Date.now() + messageData.timeOffset);

      const [newMessage] = await db.insert(chatMessages).values({
        roomId: room.id,
        senderId: sender.id,
        content: messageData.content,
        messageType: 'text',
        isRead: messageData.senderIndex === 1, // Messages from "Current User" are read
        readAt: messageData.senderIndex === 1 ? messageTime : null,
        createdAt: messageTime,
      }).returning();

      // Update room's last message time
      await db.update(chatRooms)
        .set({ 
          lastMessageAt: messageTime,
          updatedAt: new Date()
        })
        .where(eq(chatRooms.id, room.id));

      console.log(`Created message: "${messageData.content}"`);
    }

    console.log('Chat data seeding completed successfully!');
    
    // Summary
    console.log('\n=== Summary ===');
    console.log(`Created ${createdRooms.length} chat rooms`);
    console.log(`Created ${sampleMessages.length} sample messages`);
    console.log('\nSample data includes:');
    console.log('- Direct message rooms between society members');
    console.log('- Sample conversations in Basque');
    console.log('- Realistic timestamps and read status');

  } catch (error) {
    console.error('Error seeding chat data:', error);
    process.exit(1);
  }
}

// Run the seed function
seedChatData().then(() => {
  console.log('Seed script completed');
  process.exit(0);
}).catch((error) => {
  console.error('Seed script failed:', error);
  process.exit(1);
});
