import crypto from 'node:crypto';
import axios from 'axios';

type UploadOptions = {
  folder: string;
  publicId?: string;
  transformation?: string;
  format?: 'webp' | 'png' | 'jpg';
};

function signParams(params: Record<string, string>, apiSecret: string) {
  const signaturePayload = Object.entries(params)
    .filter(([, value]) => value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  return crypto.createHash('sha1').update(`${signaturePayload}${apiSecret}`).digest('hex');
}

export async function uploadImageBuffer(
  buffer: Buffer,
  options: UploadOptions
): Promise<{ secure_url: string; public_id: string }> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    // Fallback URL if Cloudinary environment variables are missing
    const simulatedId = `kudi_${Date.now()}`;
    return {
      secure_url: `https://res.cloudinary.com/demo/image/upload/sample.jpg`,
      public_id: simulatedId,
    };
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const format = options.format ?? 'webp';
  const transformation = options.transformation ?? 'c_limit,q_auto,w_1600';
  const publicId = options.publicId ?? `img_${Date.now()}`;

  const signatureParams: Record<string, string> = {
    folder: options.folder,
    format,
    public_id: publicId,
    timestamp,
    transformation,
  };

  const signature = signParams(signatureParams, apiSecret);

  const formData = new FormData();
  formData.append('file', new Blob([new Uint8Array(buffer)]), 'image.webp');
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);
  formData.append('folder', options.folder);
  formData.append('public_id', publicId);
  formData.append('format', format);
  formData.append('transformation', transformation);

  const res = await axios.post(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, formData);
  return {
    secure_url: res.data.secure_url,
    public_id: res.data.public_id,
  };
}
