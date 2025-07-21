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
  
  // Try THREE different approaches to fix the callback URL issue
  let config: any = { token: token };
  
  if (process.env.NODE_ENV === 'production') {
    // Approach 1: Let UploadThing auto-detect (remove manual callbackUrl)
    console.log('🔗 Attempt 1: Using auto-detection');
  } else {
    // Local development - set explicit URL
    config.callbackUrl = 'http://localhost:3001/api/uploadthing';
    console.log('🔗 Local: Using explicit callback URL');
  }
  
  console.log('🔗 UploadThing config:', JSON.stringify(config, null, 2));
  console.log('🔗 Server running on port:', process.env.PORT || 'undefined');
  
  const handler = createRouteHandler({
    router: uploadRouter,
    config: config,
  });
  
  // Wrap handler to catch and log errors with ULTRA debugging
  return async (req: any, res: any) => {
    try {
      console.log('📤 UploadThing request START:', req.method, req.url);
      console.log('📤 Full URL:', req.protocol + '://' + req.get('host') + req.originalUrl);
      console.log('📤 Request headers:');
      Object.entries(req.headers).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
      console.log('📤 Query params:', req.query);
      console.log('📤 Body type:', typeof req.body);
      
      // Try to intercept UploadThing's internal validation
      const originalEnd = res.end;
      res.end = function(chunk: any, encoding?: any) {
        console.log('📤 Response status:', res.statusCode);
        console.log('📤 Response headers:', res.getHeaders());
        if (chunk && res.statusCode !== 200) {
          console.log('📤 Error response body:', chunk.toString());
        }
        return originalEnd.call(this, chunk, encoding);
      };
      
      const result = await handler(req, res);
      console.log('✅ UploadThing request completed successfully');
      return result;
    } catch (error) {
      console.error('❌ UploadThing handler error:', error);
      console.error('❌ Error type:', error?.constructor?.name);
      console.error('❌ Error message:', (error as Error).message);
      console.error('❌ Error stack:', (error as Error).stack?.split('\n').slice(0, 10));
      
      // Log the full error object
      if (error && typeof error === 'object') {
        console.error('❌ Full error object keys:', Object.keys(error));
        console.error('❌ Error stringified:', JSON.stringify(error, null, 2));
      }
      
      throw error;
    }
  };
}