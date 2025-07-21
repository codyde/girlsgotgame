// Cloudflare Images API helper
export const uploadToCloudflareImages = async (file: Buffer, fileName: string) => {
  const formData = new FormData();
  const blob = new Blob([file]);
  formData.append('file', blob, fileName);

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/images/v1`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CLOUDFLARE_IMAGES_API_TOKEN}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Cloudflare Images upload failed: ${response.statusText}`);
  }

  return response.json();
};

export const deleteFromCloudflareImages = async (imageId: string) => {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/images/v1/${imageId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${process.env.CLOUDFLARE_IMAGES_API_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Cloudflare Images delete failed: ${response.statusText}`);
  }

  return response.json();
};