import { v2 as cloudinary } from 'cloudinary';

import { env } from '../config/env.js';

cloudinary.config({
  cloud_name: env.CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export interface UploadedFile {
  url: string;
  publicId: string;
}

/** Uploads a buffer to Cloudinary under a fixed folder. `resource_type: 'auto'`
 * so images, PDFs and office docs all land correctly without per-type branching. */
export const uploadBuffer = (buffer: Buffer, folder: string): Promise<UploadedFile> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto' },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary upload returned no result'));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
};

export const deleteFile = async (publicId: string): Promise<void> => {
  await cloudinary.uploader.destroy(publicId, { resource_type: 'auto' });
};

/** Re-downloads a previously uploaded file's bytes (e.g. for AI text
 * extraction at grading time, when only the Cloudinary URL was persisted). */
export const downloadBuffer = async (url: string): Promise<Buffer> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file from Cloudinary: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
};
