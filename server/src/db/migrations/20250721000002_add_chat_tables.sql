-- Migration: Add chat tables for TeamChat feature
-- Created: 2025-07-21

-- Teams table for group chat channels
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by VARCHAR(255) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Team membership table
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' NOT NULL CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMP DEFAULT NOW() NOT NULL,
    UNIQUE(team_id, user_id)
);

-- Chat messages table (supports both team and DM)
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id VARCHAR(255) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    recipient_id VARCHAR(255) REFERENCES "user"(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' NOT NULL CHECK (message_type IN ('text', 'image', 'system')),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    CONSTRAINT check_message_target CHECK (
        (team_id IS NOT NULL AND recipient_id IS NULL) OR
        (team_id IS NULL AND recipient_id IS NOT NULL)
    )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_team_id ON chat_messages(team_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_recipient_id ON chat_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Create a default "YBA Girls" team and add all existing users to it
INSERT INTO teams (name, description, created_by) 
SELECT 'YBA Girls', 'Main group chat for all YBA Girls players', id 
FROM "user" 
ORDER BY created_at ASC 
LIMIT 1
ON CONFLICT DO NOTHING;

-- Add all existing users to the default team
INSERT INTO team_members (team_id, user_id, role)
SELECT 
    (SELECT id FROM teams WHERE name = 'YBA Girls' LIMIT 1),
    id,
    CASE WHEN email = 'codydearkland@gmail.com' THEN 'admin' ELSE 'member' END
FROM "user"
ON CONFLICT (team_id, user_id) DO NOTHING;