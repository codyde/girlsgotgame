// Using eval to avoid TypeScript/bundler detection of dynamic imports
const dynamicImport = new Function('specifier', 'return import(specifier)');

let uploadthingModule: any = null;

async function getUploadThing() {
  if (!uploadthingModule) {
    uploadthingModule = await dynamicImport("uploadthing/express");
  }
  return uploadthingModule;
}

// Note: Authentication removed for UploadThing - files are uploaded and URLs returned
// Authentication is handled at the application level when updating user profiles

export async function initializeUploadThing() {
  const { createUploadthing } = await getUploadThing();
  const f = createUploadthing();

  return {
    // Avatar uploads - returns URL only, auth handled at app level
    avatarUploader: f({
      image: {
        maxFileSize: "16MB",
        maxFileCount: 1,
      },
    })
      .onUploadComplete(async ({ file }: { file: any }) => {
        console.log("🖼️ Avatar upload complete");
        console.log("📁 File URL:", file.ufsUrl);
        
        return { url: file.ufsUrl };
      }),

    // Feed media uploads - returns URL only, auth handled at app level  
    feedMediaUploader: f({
      image: {
        maxFileSize: "32MB",
        maxFileCount: 1,
      },
      video: {
        maxFileSize: "128MB", // Large limit for training videos
        maxFileCount: 1,
      },
    })
      .onUploadComplete(async ({ file }: { file: any }) => {
        console.log("📸 Feed media upload complete");
        console.log("📁 File URL:", file.ufsUrl);
        console.log("📁 File type:", file.type);
        console.log("📁 File size:", file.size);
        
        return { 
          url: file.ufsUrl,
          type: file.type,
          size: file.size 
        };
      }),

    // General file uploader - returns URL only, auth handled at app level
    fileUploader: f({
      image: {
        maxFileSize: "32MB",
        maxFileCount: 1,
      },
      video: {
        maxFileSize: "128MB",
        maxFileCount: 1,
      },
    })
      .onUploadComplete(async ({ file }: { file: any }) => {
        console.log("📄 File upload complete");
        console.log("📁 File URL:", file.ufsUrl);
        
        return { 
          url: file.ufsUrl,
          name: file.name,
          type: file.type,
          size: file.size 
        };
      }),
  };
}

export async function createUploadThingRouteHandler(uploadRouter: any) {
  const { createRouteHandler } = await getUploadThing();
  
  // Debug token configuration
  const token = process.env.UPLOADTHING_TOKEN;
  console.log('🔑 UploadThing token configured:', !!token);
  console.log('🔑 Token length:', token?.length || 0);
  console.log('🔑 Token starts with:', token?.substring(0, 10) || 'undefined');
  
  // Decode and verify token structure
  if (token) {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      console.log('🔑 Decoded token appId:', decoded.appId);
      console.log('🔑 Decoded token regions:', decoded.regions);
      console.log('🔑 API key starts with:', decoded.apiKey?.substring(0, 10));
    } catch (e) {
      console.error('🔑 Failed to decode token:', e);
    }
  }
  
  // Debug environment thoroughly
  console.log('🌍 NODE_ENV:', process.env.NODE_ENV);
  console.log('🌍 PORT:', process.env.PORT);
  console.log('🌍 All UPLOADTHING env vars:', Object.keys(process.env).filter(k => k.includes('UPLOADTHING')));
  console.log('🌍 UPLOADTHING_CALLBACK_URL env var:', process.env.UPLOADTHING_CALLBACK_URL || 'not set');
  
  // FORCE callback URL for production since auto-detection is failing
  let config: any = { token: token };
  
  // Always set explicit callback URL based on environment
  if (process.env.NODE_ENV === 'production') {
    // Use environment variable if set, otherwise use hardcoded production URL
    config.callbackUrl = process.env.UPLOADTHING_CALLBACK_URL || 'https://api.girlsgotgame.app/api/uploadthing';
    console.log('🔗 Production: Using callback URL:', config.callbackUrl);
  } else {
    config.callbackUrl = 'http://localhost:3001/api/uploadthing';
    console.log('🔗 Local: Using callback URL:', config.callbackUrl);
  }
  
  console.log('🔗 UploadThing config:', JSON.stringify(config, null, 2));
  console.log('🔗 Server running on port:', process.env.PORT || 'undefined');
  
  const handler = createRouteHandler({
    router: uploadRouter,
    config: config,
  });
  
  // Wrap handler to catch and log errors with ULTRA debugging
  return async (req: any, res: any) => {
    const startTime = Date.now();
    console.log('\n🚀 ===== UPLOADTHING REQUEST START =====');
    console.log('📤 Method:', req.method);
    console.log('📤 URL:', req.url);
    console.log('📤 Query:', JSON.stringify(req.query));
    
    // Log critical headers
    console.log('📤 Critical headers:');
    console.log('   Host:', req.headers.host);
    console.log('   X-Forwarded-Host:', req.headers['x-forwarded-host']);
    console.log('   X-Forwarded-Proto:', req.headers['x-forwarded-proto']);
    console.log('   Origin:', req.headers.origin);
    console.log('   X-UploadThing-Version:', req.headers['x-uploadthing-version']);
    
    // Intercept response to capture error details
    const originalJson = res.json;
    const originalEnd = res.end;
    const originalSend = res.send;
    
    res.json = function(body: any) {
      console.log('📤 Response JSON:', JSON.stringify(body));
      return originalJson.call(this, body);
    };
    
    res.send = function(body: any) {
      console.log('📤 Response Send:', body);
      return originalSend.call(this, body);
    };
    
    res.end = function(chunk: any, encoding?: any) {
      const duration = Date.now() - startTime;
      console.log('📤 Response Status:', res.statusCode);
      console.log('📤 Response Duration:', duration + 'ms');
      if (chunk) {
        const body = chunk.toString();
        console.log('📤 Response Body:', body);
        if (res.statusCode === 400 && body.includes('Invalid signing secret')) {
          console.log('🔴 INVALID SIGNING SECRET DETECTED!');
          console.log('🔴 This means UploadThing cannot validate the request signature');
          console.log('🔴 Possible causes:');
          console.log('   1. Wrong token in environment');
          console.log('   2. Callback URL mismatch');
          console.log('   3. Request tampering/proxy issues');
        }
      }
      console.log('🏁 ===== UPLOADTHING REQUEST END =====\n');
      return originalEnd.call(this, chunk, encoding);
    };
    
    try {
      return await handler(req, res);
    } catch (error) {
      console.error('❌ UploadThing handler crashed:', error);
      throw error;
    }
  };
}