-- Chat rooms/conversations (direct messages only)
CREATE TABLE "chat_rooms" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    "user1_id" varchar NOT NULL,
    "user2_id" varchar NOT NULL,
    "society_id" varchar NOT NULL,
    "is_active" boolean NOT NULL DEFAULT true,
    "last_message_at" timestamp,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "updated_at" timestamp NOT NULL DEFAULT now(),
    CONSTRAINT "chat_rooms_user1_id_fkey" FOREIGN KEY ("user1_id") REFERENCES "users" ("id") ON DELETE no action ON UPDATE no action,
    CONSTRAINT "chat_rooms_user2_id_fkey" FOREIGN KEY ("user2_id") REFERENCES "users" ("id") ON DELETE no action ON UPDATE no action,
    CONSTRAINT "chat_rooms_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies" ("id") ON DELETE no action ON UPDATE no action
);

-- Chat messages
CREATE TABLE "chat_messages" (
    "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    "room_id" varchar NOT NULL,
    "sender_id" varchar NOT NULL,
    "content" text NOT NULL,
    "message_type" text NOT NULL DEFAULT 'text',
    "is_read" boolean NOT NULL DEFAULT false,
    "read_at" timestamp,
    "created_at" timestamp NOT NULL DEFAULT now(),
    CONSTRAINT "chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms" ("id") ON DELETE no action ON UPDATE no action,
    CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users" ("id") ON DELETE no action ON UPDATE no action
);

-- Indexes for better performance
CREATE INDEX "idx_chat_rooms_user1_id" ON "chat_rooms"("user1_id");
CREATE INDEX "idx_chat_rooms_user2_id" ON "chat_rooms"("user2_id");
CREATE INDEX "idx_chat_rooms_society_id" ON "chat_rooms"("society_id");
CREATE INDEX "idx_chat_rooms_last_message_at" ON "chat_rooms"("last_message_at" DESC);
CREATE INDEX "idx_chat_messages_room_id" ON "chat_messages"("room_id");
CREATE INDEX "idx_chat_messages_created_at" ON "chat_messages"("created_at" DESC);

-- Unique constraint to prevent duplicate direct message rooms between same users
CREATE UNIQUE INDEX "idx_chat_rooms_unique_users" ON "chat_rooms"("user1_id", "user2_id") WHERE "is_active" = true;
