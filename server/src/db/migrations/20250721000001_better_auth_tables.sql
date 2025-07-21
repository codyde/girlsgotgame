-- Better Auth required tables
CREATE TABLE IF NOT EXISTS "user" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" varchar(255),
    "email" varchar(255) NOT NULL,
    "emailVerified" boolean DEFAULT false NOT NULL,
    "image" varchar(500),
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "user_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "session" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "expiresAt" timestamp NOT NULL,
    "token" varchar(255) NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL,
    "ipAddress" varchar(255),
    "userAgent" text,
    "userId" uuid NOT NULL,
    CONSTRAINT "session_token_unique" UNIQUE("token"),
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "accountId" varchar(255) NOT NULL,
    "providerId" varchar(255) NOT NULL,
    "userId" uuid NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamp,
    "refreshTokenExpiresAt" timestamp,
    "scope" varchar(255),
    "password" varchar(255),
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "verification" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "identifier" varchar(255) NOT NULL,
    "value" varchar(255) NOT NULL,
    "expiresAt" timestamp NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL
);