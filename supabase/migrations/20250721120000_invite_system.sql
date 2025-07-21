/*
  # Invite-Only System Implementation
  
  This migration adds the complete invite system infrastructure:
  1. Invite codes for parent-generated invites
  2. Invite registrations tracking
  3. Access requests for organic signups
  4. Email whitelist for pre-approved emails
  5. Banned emails for security
  6. RLS policies for security
  7. Indexes for performance
*/

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create invite_codes table
CREATE TABLE IF NOT EXISTS invite_codes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  code text UNIQUE NOT NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone,
  max_uses integer DEFAULT 1 NOT NULL,
  used_count integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  CONSTRAINT max_uses_positive CHECK (max_uses > 0),
  CONSTRAINT used_count_non_negative CHECK (used_count >= 0),
  CONSTRAINT used_count_within_max CHECK (used_count <= max_uses)
);

-- Create invite_registrations table
CREATE TABLE IF NOT EXISTS invite_registrations (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  invite_code_id uuid REFERENCES invite_codes(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  registered_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(invite_code_id, user_id)
);

-- Create access_requests table  
CREATE TABLE IF NOT EXISTS access_requests (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  email text NOT NULL,
  name text,
  message text,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  reviewed_at timestamp with time zone,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE(email, status) DEFERRABLE INITIALLY DEFERRED
);

-- Create email_whitelist table
CREATE TABLE IF NOT EXISTS email_whitelist (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  added_by uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  added_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create banned_emails table
CREATE TABLE IF NOT EXISTS banned_emails (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  banned_by uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  banned_at timestamp with time zone DEFAULT now() NOT NULL,
  reason text
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS invite_codes_created_by_idx ON invite_codes(created_by);
CREATE INDEX IF NOT EXISTS invite_codes_code_idx ON invite_codes(code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS invite_codes_expires_idx ON invite_codes(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS invite_registrations_invite_code_idx ON invite_registrations(invite_code_id);
CREATE INDEX IF NOT EXISTS invite_registrations_user_idx ON invite_registrations(user_id);

CREATE INDEX IF NOT EXISTS access_requests_status_idx ON access_requests(status);
CREATE INDEX IF NOT EXISTS access_requests_email_idx ON access_requests(email);
CREATE INDEX IF NOT EXISTS access_requests_created_idx ON access_requests(created_at);

CREATE INDEX IF NOT EXISTS email_whitelist_email_idx ON email_whitelist(email);
CREATE INDEX IF NOT EXISTS banned_emails_email_idx ON banned_emails(email);

-- Enable Row Level Security
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invite_codes
CREATE POLICY "Parents can create invite codes"
  ON invite_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'parent'
    )
  );

CREATE POLICY "Users can view invite codes they created"
  ON invite_codes
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Anyone can read active invite codes for validation"
  ON invite_codes
  FOR SELECT
  TO authenticated
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY "Parents can update their own invite codes"
  ON invite_codes
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- RLS Policies for invite_registrations
CREATE POLICY "Users can view invite registrations"
  ON invite_registrations
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM invite_codes 
      WHERE id = invite_code_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "System can create invite registrations"
  ON invite_registrations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for access_requests
CREATE POLICY "Anyone can submit access requests"
  ON access_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view their own access requests"
  ON access_requests
  FOR SELECT
  TO authenticated
  USING (
    email IN (
      SELECT email FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all access requests"
  ON access_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND email = 'codydearkland@gmail.com'
    )
  );

CREATE POLICY "Admins can update access requests"
  ON access_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND email = 'codydearkland@gmail.com'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND email = 'codydearkland@gmail.com'
    )
  );

-- RLS Policies for email_whitelist
CREATE POLICY "Anyone can read email whitelist for validation"
  ON email_whitelist
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can manage email whitelist"
  ON email_whitelist
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND email = 'codydearkland@gmail.com'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND email = 'codydearkland@gmail.com'
    )
  );

-- RLS Policies for banned_emails
CREATE POLICY "Anyone can read banned emails for validation"
  ON banned_emails
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can manage banned emails"
  ON banned_emails
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND email = 'codydearkland@gmail.com'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND email = 'codydearkland@gmail.com'
    )
  );

-- Function to generate secure invite codes
CREATE OR REPLACE FUNCTION generate_invite_code() RETURNS text AS $$
DECLARE
  characters text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i integer := 0;
BEGIN
  -- Generate 8-character code
  FOR i IN 1..8 LOOP
    result := result || substr(characters, floor(random() * length(characters) + 1)::integer, 1);
  END LOOP;
  
  -- Ensure uniqueness by checking if code exists
  WHILE EXISTS(SELECT 1 FROM invite_codes WHERE code = result) LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(characters, floor(random() * length(characters) + 1)::integer, 1);
    END LOOP;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to validate invite code and register usage
CREATE OR REPLACE FUNCTION use_invite_code(invite_code text, user_id uuid) 
RETURNS json AS $$
DECLARE
  code_record invite_codes%ROWTYPE;
  result json;
BEGIN
  -- Get the invite code record
  SELECT * INTO code_record
  FROM invite_codes
  WHERE code = invite_code 
    AND is_active = true 
    AND (expires_at IS NULL OR expires_at > now())
    AND used_count < max_uses;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid or expired invite code'
    );
  END IF;
  
  -- Check if user already used this code
  IF EXISTS(
    SELECT 1 FROM invite_registrations 
    WHERE invite_code_id = code_record.id AND user_id = use_invite_code.user_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invite code already used by this user'
    );
  END IF;
  
  -- Record the usage
  INSERT INTO invite_registrations (invite_code_id, user_id)
  VALUES (code_record.id, use_invite_code.user_id);
  
  -- Update usage count
  UPDATE invite_codes
  SET used_count = used_count + 1
  WHERE id = code_record.id;
  
  -- Return success with invite creator info
  SELECT json_build_object(
    'success', true,
    'invite_creator', p.name,
    'invite_creator_id', p.id
  ) INTO result
  FROM profiles p
  WHERE p.id = code_record.created_by;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if email is eligible for registration
CREATE OR REPLACE FUNCTION check_email_eligibility(check_email text)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  -- Check if email is banned
  IF EXISTS(SELECT 1 FROM banned_emails WHERE email = check_email) THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', 'banned',
      'message', 'This email address has been banned from registration'
    );
  END IF;
  
  -- Check if email is whitelisted
  IF EXISTS(SELECT 1 FROM email_whitelist WHERE email = check_email) THEN
    RETURN json_build_object(
      'eligible', true,
      'reason', 'whitelisted',
      'message', 'Email is pre-approved for registration'
    );
  END IF;
  
  -- Check if user already exists
  IF EXISTS(SELECT 1 FROM profiles WHERE email = check_email) THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', 'exists',
      'message', 'Account already exists for this email'
    );
  END IF;
  
  -- Check if there's a pending access request
  IF EXISTS(SELECT 1 FROM access_requests WHERE email = check_email AND status = 'pending') THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', 'pending_request',
      'message', 'Access request already submitted and pending review'
    );
  END IF;
  
  -- Check if there's an approved access request
  IF EXISTS(SELECT 1 FROM access_requests WHERE email = check_email AND status = 'approved') THEN
    RETURN json_build_object(
      'eligible', true,
      'reason', 'approved_request',
      'message', 'Access request has been approved'
    );
  END IF;
  
  -- Email needs to request access or use invite code
  RETURN json_build_object(
    'eligible', false,
    'reason', 'needs_invite_or_request',
    'message', 'Registration requires an invite code or access request approval'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to prevent duplicate pending requests
CREATE OR REPLACE FUNCTION prevent_duplicate_pending_requests()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow one pending request per email
  IF NEW.status = 'pending' AND EXISTS(
    SELECT 1 FROM access_requests 
    WHERE email = NEW.email AND status = 'pending' AND id != NEW.id
  ) THEN
    RAISE EXCEPTION 'A pending access request already exists for this email';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_duplicate_requests
  BEFORE INSERT OR UPDATE ON access_requests
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_pending_requests();