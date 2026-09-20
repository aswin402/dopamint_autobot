import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { pinoLogger } from './pino-logger';

const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_BUCKET = process.env.S3_BUCKET || 'my-app-bucket';
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || '';
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || '';
const S3_ENDPOINT = process.env.S3_ENDPOINT; // Supports custom endpoints like MinIO / Cloudflare R2

const s3Client = new S3Client({
  region: S3_REGION,
  credentials: S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY ? {
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  } : undefined,
  endpoint: S3_ENDPOINT,
});

export { s3Client };

interface UploadParams {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}

export async function uploadToS3({ key, body, contentType }: UploadParams) {
  try {
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    });
    
    await s3Client.send(command);
    pinoLogger.info(`Successfully uploaded object to S3: ${key}`);
    return { key, bucket: S3_BUCKET };
  } catch (error) {
    pinoLogger.error(error, `S3 upload error for key "${key}"`);
    throw error;
  }
}

export async function getPresignedDownloadUrl(key: string, expiresInSeconds = 3600) {
  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });
    
    const url = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
    return url;
  } catch (error) {
    pinoLogger.error(error, `S3 presigned download URL error for key "${key}"`);
    throw error;
  }
}

export async function getPresignedUploadUrl(key: string, contentType: string, expiresInSeconds = 3600) {
  try {
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
    });
    
    const url = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
    return url;
  } catch (error) {
    pinoLogger.error(error, `S3 presigned upload URL error for key "${key}"`);
    throw error;
  }
}
