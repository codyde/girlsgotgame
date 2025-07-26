import * as Sentry from "@sentry/react";

// Get the Sentry logger instance
const { logger } = Sentry;

// Create a structured logger with context for our app
export const appLogger = {
  // Authentication related logs
  auth: {
    sessionStart: (userId: string) => 
      logger.info("Authentication session started", { userId, component: "auth" }),
    
    sessionEnd: (userId: string) => 
      logger.info("Authentication session ended", { userId, component: "auth" }),
    
    googleSignInAttempt: () => 
      logger.info("Google sign-in attempt initiated", { provider: "google", component: "auth" }),
    
    googleSignInSuccess: (userId: string, email: string) => 
      logger.info("Google sign-in successful", { userId, email, provider: "google", component: "auth" }),
    
    googleSignInError: (error: string) => 
      logger.error("Google sign-in failed", { error, provider: "google", component: "auth" }),
    
    appleSignInAttempt: () => 
      logger.info("Apple sign-in attempt initiated", { provider: "apple", component: "auth" }),
    
    appleSignInSuccess: (userId: string, email: string) => 
      logger.info("Apple sign-in successful", { userId, email, provider: "apple", component: "auth" }),
    
    appleSignInError: (error: string) => 
      logger.error("Apple sign-in failed", { error, provider: "apple", component: "auth" }),
    
    profileFetchStart: (userId: string) => 
      logger.debug(logger.fmt`Starting profile fetch for user: ${userId}`, { userId, component: "auth" }),
    
    profileFetchSuccess: (userId: string, profileId: string) => 
      logger.info("Profile fetch successful", { userId, profileId, component: "auth" }),
    
    profileFetchError: (userId: string, error: string) => 
      logger.error("Profile fetch failed", { userId, error, component: "auth" }),
    
    profileCreateStart: (userId: string, email: string) => 
      logger.info("Creating new user profile", { userId, email, component: "auth" }),
    
    profileCreateSuccess: (userId: string, profileId: string) => 
      logger.info("Profile created successfully", { userId, profileId, component: "auth" }),
    
    profileCreateError: (userId: string, error: string) => 
      logger.error("Profile creation failed", { userId, error, component: "auth" }),
    
    authStateChange: (event: string, hasUser: boolean) => 
      logger.debug(logger.fmt`Auth state changed: ${event}`, { event, hasUser, component: "auth" }),
    
    timeout: (operation: string, timeoutMs: number) => 
      logger.warn("Authentication operation timed out", { operation, timeoutMs, component: "auth" }),
    
    flowStart: (flow: string) => 
      logger.debug(`Starting auth flow: ${flow}`, { flow, component: "auth", timestamp: Date.now() }),
    
    flowStep: (flow: string, step: string, duration?: number) => 
      logger.debug(`Auth flow step: ${flow} -> ${step}`, { flow, step, duration, component: "auth" }),
    
    flowComplete: (flow: string, totalDuration: number) => 
      logger.info(`Auth flow completed: ${flow}`, { flow, totalDuration, component: "auth" })
  },

  // Application flow logs
  app: {
    start: () => 
      logger.info("Application started", { component: "app" }),
    
    screenChange: (from: string, to: string) => 
      logger.debug(logger.fmt`Screen navigation: ${from} -> ${to}`, { from, to, component: "navigation" }),
    
    loadingStateChange: (isLoading: boolean, context: string) => 
      logger.debug(logger.fmt`Loading state changed: ${isLoading}`, { isLoading, context, component: "app" })
  },

  // Workout and training logs
  training: {
    workoutStart: (exerciseType: string, userId: string) => 
      logger.info("Workout session started", { exerciseType, userId, component: "training" }),
    
    workoutComplete: (exerciseType: string, userId: string, points: number, duration: number) => 
      logger.info("Workout session completed", { exerciseType, userId, points, duration, component: "training" }),
    
    workoutError: (error: string, exerciseType: string, userId: string) => 
      logger.error("Workout session error", { error, exerciseType, userId, component: "training" })
  },

  // Social features logs
  social: {
    postCreate: (userId: string, contentLength: number, hasWorkout: boolean) => 
      logger.info("Social post created", { userId, contentLength, hasWorkout, component: "social" }),
    
    postError: (userId: string, error: string) => 
      logger.error("Failed to create social post", { userId, error, component: "social" }),
    
    feedLoad: (postCount: number) => 
      logger.debug(logger.fmt`Feed loaded with ${postCount} posts`, { postCount, component: "social" })
  },

  // Database operations
  database: {
    queryStart: (table: string, operation: string) => 
      logger.debug(logger.fmt`Database query started: ${operation} on ${table}`, { table, operation, component: "database" }),
    
    querySuccess: (table: string, operation: string, recordCount?: number) => 
      logger.debug(logger.fmt`Database query successful: ${operation} on ${table}`, { table, operation, recordCount, component: "database" }),
    
    queryError: (table: string, operation: string, error: string) => 
      logger.error("Database query failed", { table, operation, error, component: "database" }),
    
    connectionIssue: (error: string) => 
      logger.warn("Database connection issue", { error, component: "database" })
  },

  // Invite system logs
  invite: {
    linkClicked: (inviteCode: string) => 
      logger.info("Invite link clicked", { inviteCode, component: "invite" }),
    
    validationStart: (inviteCode: string) => 
      logger.debug("Starting invite code validation", { inviteCode, component: "invite" }),
    
    validationSuccess: (inviteCode: string, inviteCodeId: string) => 
      logger.info("Invite code validation successful", { inviteCode, inviteCodeId, component: "invite" }),
    
    validationError: (inviteCode: string, error: string) => 
      logger.error("Invite code validation failed", { inviteCode, error, component: "invite" }),
    
    oauthStart: (inviteCodeId: string) => 
      logger.info("Starting OAuth flow with invite", { inviteCodeId, component: "invite" }),
    
    oauthRedirect: (inviteCodeId: string, oauthUrl: string) => 
      logger.debug("Redirecting to OAuth provider", { inviteCodeId, oauthUrl, component: "invite" }),
    
    oauthError: (inviteCodeId: string, error: string) => 
      logger.error("OAuth flow failed for invite", { inviteCodeId, error, component: "invite" }),
    
    callbackReceived: (inviteCodeId: string, userId?: string) => 
      logger.info("OAuth callback received", { inviteCodeId, userId, component: "invite" }),
    
    usageStart: (inviteCodeId: string, userId: string) => 
      logger.debug("Starting invite code usage", { inviteCodeId, userId, component: "invite" }),
    
    usageSuccess: (inviteCodeId: string, userId: string) => 
      logger.info("Invite code used successfully", { inviteCodeId, userId, component: "invite" }),
    
    usageError: (inviteCodeId: string, userId: string, error: string) => 
      logger.error("Failed to use invite code", { inviteCodeId, userId, error, component: "invite" }),
    
    signupComplete: (inviteCodeId: string, userId: string, email: string) => 
      logger.info("Invite signup flow completed", { inviteCodeId, userId, email, component: "invite" }),
    
    linkGenerated: (inviteCode: string, createdBy: string) => 
      logger.info("Invite link generated", { inviteCode, createdBy, component: "invite" })
  },

  // General error logging
  error: {
    unexpected: (error: string, context: string) => 
      logger.error("Unexpected error occurred", { error, context, component: "error" }),
    
    apiError: (endpoint: string, status: number, error: string) => 
      logger.error("API request failed", { endpoint, status, error, component: "api" }),
    
    validationError: (field: string, value: any, rule: string) => 
      logger.warn("Validation error", { field, value, rule, component: "validation" })
  }
};

// Export individual logger for direct use if needed
export { logger };

// Export a function to log custom events with consistent structure
export const logEvent = (level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal', message: string, data?: Record<string, any>) => {
  logger[level](message, { ...data, timestamp: new Date().toISOString() });
};