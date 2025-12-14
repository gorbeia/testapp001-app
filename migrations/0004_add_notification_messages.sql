-- Create notification messages table for multilingual support
CREATE TABLE IF NOT EXISTS notification_messages (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id VARCHAR(255) NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL, -- 'eu', 'es', 'en', etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    UNIQUE(notification_id, language)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notification_messages_notification_id ON notification_messages(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_messages_language ON notification_messages(language);

-- Add default language to notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS default_language VARCHAR(10) NOT NULL DEFAULT 'eu';

-- Create function to get notification message in user's preferred language
CREATE OR REPLACE FUNCTION get_notification_message(notification_uuid VARCHAR, preferred_lang VARCHAR DEFAULT 'eu')
RETURNS TABLE(title VARCHAR, message TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT nm.title, nm.message
    FROM notification_messages nm
    WHERE nm.notification_id = notification_uuid
      AND nm.language = preferred_lang
    LIMIT 1;
    
    -- If no translation found for preferred language, try default language
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT nm.title, nm.message
        FROM notification_messages nm
        WHERE nm.notification_id = notification_uuid
          AND nm.language = (SELECT default_language FROM notifications WHERE id = notification_uuid)
        LIMIT 1;
    END IF;
    
    -- If still no translation found, try fallback to 'eu'
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT nm.title, nm.message
        FROM notification_messages nm
        WHERE nm.notification_id = notification_uuid
          AND nm.language = 'eu'
        LIMIT 1;
    END IF;
END;
$$ LANGUAGE plpgsql;
