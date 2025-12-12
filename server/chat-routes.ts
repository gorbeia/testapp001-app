import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { users, chatRooms, chatMessages } from "@shared/schema";
import { eq, and, ne, sql, desc, count, or } from "drizzle-orm";
import { getUserSocietyId } from "./routes";
import { emitToRoomExcludingUser, emitToUser, emitToRoom } from "./socket";
import { randomUUID } from "crypto";

// Helper function to get last message for a room
async function getRoomLastMessage(roomId: string) {
  const [lastMessage] = await db
    .select({
      content: chatMessages.content,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.roomId, roomId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(1);

  return lastMessage || null;
}

// GET /api/chat/rooms - Get all chat rooms for the authenticated user
export const getChatRooms = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const societyId = getUserSocietyId(user);
    
    // Get all chat rooms where the user is either user1 or user2
    const userRooms = await db
      .select({
        id: chatRooms.id,
        user1Id: chatRooms.user1Id,
        user2Id: chatRooms.user2Id,
        lastMessageAt: chatRooms.lastMessageAt,
        createdAt: chatRooms.createdAt,
        updatedAt: chatRooms.updatedAt,
      })
      .from(chatRooms)
      .where(and(
        eq(chatRooms.societyId, societyId),
        or(eq(chatRooms.user1Id, user.id), eq(chatRooms.user2Id, user.id))
      ))
      .orderBy(desc(chatRooms.lastMessageAt), desc(chatRooms.createdAt));

    // Get unread message counts for each room and enrich with user info
    const roomsWithUnread = await Promise.all(
      userRooms.map(async (room: any) => {
        const unreadCount = await db
          .select({ count: count() })
          .from(chatMessages)
          .where(and(
            eq(chatMessages.roomId, room.id),
            ne(chatMessages.senderId, user.id),
            eq(chatMessages.isRead, false)
          ));

        // Get other user's info
        const otherUserId = room.user1Id === user.id ? room.user2Id : room.user1Id;
        const [otherUser] = await db
          .select({
            name: users.name,
            role: users.role,
          })
          .from(users)
          .where(eq(users.id, otherUserId))
          .limit(1);

        return {
          ...room,
          otherUserId,
          otherUserName: otherUser?.name || 'Unknown User',
          otherUserRole: otherUser?.role || 'member',
          unread: unreadCount[0]?.count || 0,
          lastMessage: room.lastMessageAt ? await getRoomLastMessage(room.id) : null,
        };
      })
    );

    // Remove duplicates based on room ID
    const uniqueRooms = roomsWithUnread.filter((room, index, self) =>
      index === self.findIndex((r) => r.id === room.id)
    );

    res.json(uniqueRooms);
  } catch (error) {
    next(error);
  }
};

// GET /api/chat/rooms/:roomId/messages - Get messages for a specific room
export const getChatRoomMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const user = req.user!;
    const societyId = getUserSocietyId(user);
    
    // Verify user has access to this room
    const room = await db
      .select()
      .from(chatRooms)
      .where(and(
        eq(chatRooms.id, roomId),
        eq(chatRooms.societyId, societyId),
        or(eq(chatRooms.user1Id, user.id), eq(chatRooms.user2Id, user.id))
      ))
      .limit(1);

    if (!room.length) {
      return res.status(404).json({ message: "Chat room not found" });
    }

    // Get messages for this room
    const messages = await db
      .select({
        id: chatMessages.id,
        senderId: chatMessages.senderId,
        content: chatMessages.content,
        messageType: chatMessages.messageType,
        isRead: chatMessages.isRead,
        readAt: chatMessages.readAt,
        createdAt: chatMessages.createdAt,
        senderName: users.name,
        senderRole: users.role,
      })
      .from(chatMessages)
      .leftJoin(users, eq(users.id, chatMessages.senderId))
      .where(eq(chatMessages.roomId, roomId))
      .orderBy(chatMessages.createdAt);

    // Mark messages as read for this user
    await db
      .update(chatMessages)
      .set({ 
        isRead: true, 
        readAt: new Date() 
      })
      .where(and(
        eq(chatMessages.roomId, roomId),
        ne(chatMessages.senderId, user.id),
        eq(chatMessages.isRead, false)
      ));

    res.json(messages);
  } catch (error) {
    next(error);
  }
};

// POST /api/chat/rooms - Create a new chat room
export const createChatRoom = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { otherUserId } = req.body;
    const user = req.user!;
    const societyId = getUserSocietyId(user);

    if (!otherUserId || otherUserId === user.id) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Check if room already exists between these users
    const existingRoom = await db
      .select()
      .from(chatRooms)
      .where(and(
        eq(chatRooms.societyId, societyId),
        or(
          and(eq(chatRooms.user1Id, user.id), eq(chatRooms.user2Id, otherUserId)),
          and(eq(chatRooms.user1Id, otherUserId), eq(chatRooms.user2Id, user.id))
        )
      ))
      .limit(1);

    if (existingRoom.length > 0) {
      return res.json(existingRoom[0]);
    }

    // Create new chat room
    const [newRoom] = await db
      .insert(chatRooms)
      .values({
        user1Id: user.id,
        user2Id: otherUserId,
        societyId,
        isActive: true,
      })
      .returning();

    res.status(201).json(newRoom);
  } catch (error) {
    next(error);
  }
};

// POST /api/chat/rooms/:roomId/messages - Send a new message
export const createChatMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const { id: messageId, content, messageType = 'text' } = req.body;
    const user = req.user!;
    const societyId = getUserSocietyId(user);

    if (!content?.trim()) {
      return res.status(400).json({ message: "Message content is required" });
    }

    // Verify user has access to this room
    const room = await db
      .select()
      .from(chatRooms)
      .where(and(
        eq(chatRooms.id, roomId),
        eq(chatRooms.societyId, societyId),
        or(eq(chatRooms.user1Id, user.id), eq(chatRooms.user2Id, user.id))
      ))
      .limit(1);

    if (!room.length) {
      return res.status(404).json({ message: "Chat room not found" });
    }

    // Create message with frontend-provided UUID or generate new one
    const [newMessage] = await db
      .insert(chatMessages)
      .values({
        id: messageId || randomUUID(),
        roomId,
        senderId: user.id,
        content: content.trim(),
        messageType,
        isRead: false,
      })
      .returning();

    // Update room's last message time
    await db
      .update(chatRooms)
      .set({ 
        lastMessageAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(chatRooms.id, roomId));

    // Get sender info for response
    const messageWithSender = await db
      .select({
        id: chatMessages.id,
        roomId: chatMessages.roomId,
        senderId: chatMessages.senderId,
        content: chatMessages.content,
        messageType: chatMessages.messageType,
        isRead: chatMessages.isRead,
        readAt: chatMessages.readAt,
        createdAt: chatMessages.createdAt,
        senderName: users.name,
        senderRole: users.role,
      })
      .from(chatMessages)
      .leftJoin(users, eq(users.id, chatMessages.senderId))
      .where(eq(chatMessages.id, newMessage.id))
      .limit(1);

    res.status(201).json(messageWithSender[0]);
    
    // Emit real-time message to chat room (including sender)
    // Let the client handle duplicate prevention
    emitToRoom(roomId, 'new-message', messageWithSender[0]);
    
    // Emit notification to other user if they're not in the room
    const otherUserId = room[0].user1Id === user.id ? room[0].user2Id : room[0].user1Id;
    emitToUser(otherUserId, 'new-message-notification', {
      roomId,
      message: messageWithSender[0],
      senderName: user.name || 'Unknown User',
    });
  } catch (error) {
    next(error);
  }
};
