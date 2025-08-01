# React Native Expo Authentication Guide

This guide explains how to properly implement Google OAuth authentication in your React Native Expo app with the Girls Got Game backend.

## The Problem

Your React Native app is failing to authenticate because:
1. The authentication request hangs for 5 seconds (Better Auth timeout)
2. The fallback mechanism tries to open a browser with localhost/192.168.1.8 URLs that the mobile device can't reach
3. The OAuth flow is designed for web browsers, not mobile apps

## The Solution

The backend already has the `@better-auth/expo` plugin configured, which handles mobile OAuth flows properly. You need to:

### 1. Install Required Dependencies in Your Expo App

```bash
npx expo install expo-auth-session expo-web-browser expo-crypto
```

### 2. Configure Your Expo App

In your `app.json` or `app.config.js`:

```json
{
  "expo": {
    "scheme": "girlsgotgameios",
    "ios": {
      "bundleIdentifier": "com.girlsgotgame.app"
    },
    "android": {
      "package": "com.girlsgotgame.app"
    }
  }
}
```

### 3. Implement Authentication in Your React Native App

Create an authentication service:

```typescript
// auth.service.ts
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

const API_URL = Platform.select({
  ios: 'http://192.168.1.8:3001', // Use your actual server IP
  android: 'http://192.168.1.8:3001', // Use your actual server IP
  default: 'http://localhost:3001'
});

export async function signInWithGoogle() {
  try {
    // Create the auth request
    const redirectUri = AuthSession.makeRedirectUri({
      scheme: 'girlsgotgameios',
      preferLocalhost: false,
      isTripleSlashed: true,
    });

    console.log('Redirect URI:', redirectUri);

    // Call your backend's social sign-in endpoint
    const response = await fetch(`${API_URL}/api/auth/sign-in/social`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'girlsgotgame-expo/1.0', // Important: Help server identify mobile requests
      },
      body: JSON.stringify({
        provider: 'google',
        callbackURL: redirectUri, // This will be handled by expo plugin
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Auth request failed: ${error}`);
    }

    const data = await response.json();
    
    if (data.url) {
      // Open the OAuth URL in the system browser
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUri
      );

      if (result.type === 'success' && result.url) {
        // Extract the session token from the callback URL
        const url = new URL(result.url);
        const sessionToken = url.searchParams.get('session_token');
        
        if (sessionToken) {
          // Store the session token
          await storeSessionToken(sessionToken);
          
          // Get user session
          const sessionResponse = await fetch(`${API_URL}/api/auth/session`, {
            headers: {
              'Authorization': `Bearer ${sessionToken}`,
            },
          });
          
          const session = await sessionResponse.json();
          return { success: true, session };
        }
      }
    }
    
    throw new Error('No auth URL received from server');
  } catch (error) {
    console.error('Google sign-in error:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to store session token
async function storeSessionToken(token: string) {
  // Use expo-secure-store or AsyncStorage
  // Example with AsyncStorage:
  // await AsyncStorage.setItem('session_token', token);
}
```

### 4. Update Your React Native Component

```typescript
// LoginScreen.tsx
import React, { useState } from 'react';
import { View, Button, Text, ActivityIndicator } from 'react-native';
import { signInWithGoogle } from './auth.service';

export function LoginScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    
    const result = await signInWithGoogle();
    
    if (result.success) {
      // Navigate to authenticated screens
      navigation.navigate('Home');
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <Button
        title="Sign in with Google"
        onPress={handleGoogleSignIn}
        disabled={loading}
      />
      
      {loading && <ActivityIndicator />}
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
    </View>
  );
}
```

### 5. Server-Side Adjustments Needed

The server needs to properly handle Expo auth requests. The key issues are:

1. **User Agent Detection**: The server should detect Expo requests by user agent
2. **Redirect URI Handling**: The expo plugin should handle the custom scheme redirects
3. **Session Token Return**: The callback should include the session token in the redirect URL

### 6. Debugging Tips

1. **Check Network Connectivity**: Ensure your mobile device can reach the server IP
   ```bash
   # On your mobile device's browser, try:
   http://192.168.1.8:3001/health
   ```

2. **Monitor Server Logs**: Watch for the auth request hitting the server
   ```bash
   # You should see:
   # 🔍 [REQUEST] POST /api/auth/sign-in/social - BEFORE Better Auth
   ```

3. **Check Redirect URI**: Make sure the redirect URI matches your app scheme
   ```
   girlsgotgameios://expo-auth-session
   ```

4. **Test OAuth URL**: If you get an OAuth URL, try opening it in a browser to see if it works

### 7. Alternative: Direct ID Token Approach

If the OAuth flow continues to fail, you can use Expo's Google authentication to get an ID token directly:

```typescript
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

// In your component
const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
  clientId: 'YOUR_GOOGLE_CLIENT_ID',
  iosClientId: '314217271573-g2do63ffpq29c0n9l6a8fcpmeb6g68l0.apps.googleusercontent.com',
  androidClientId: 'YOUR_ANDROID_CLIENT_ID',
});

React.useEffect(() => {
  if (response?.type === 'success') {
    const { id_token } = response.params;
    // Send this token to your custom endpoint
    sendIdTokenToBackend(id_token);
  }
}, [response]);
```

Then create a custom endpoint on your server to handle ID tokens from React Native apps.

## Next Steps

1. First, try the expo-auth-session approach with the existing Better Auth setup
2. Monitor server logs to see where the request fails
3. If needed, we can create a custom React Native authentication endpoint similar to the Swift `/mobile` endpoint