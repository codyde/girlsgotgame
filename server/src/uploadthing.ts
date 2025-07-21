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
  
  return createRouteHandler({
    router: uploadRouter,
    config: {
      token: process.env.UPLOADTHING_TOKEN,
    },
  });
}