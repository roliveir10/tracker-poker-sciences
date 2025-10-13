import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { readFile } from 'node:fs/promises';

const REGION = process.env.S3_REGION as string;
const BUCKET = process.env.S3_BUCKET as string;

export const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
  },
});

export async function createPresignedUploadUrl(params: {
  key: string;
  contentType: string;
  expiresIn?: number;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: params.key,
    ContentType: params.contentType,
  });
  const url = await getSignedUrl(s3, command, { expiresIn: params.expiresIn ?? 900 });
  return url;
}

export async function getObjectAsString(key: string): Promise<string> {
  // Dev fallback: absolute path or file://
  if (key.startsWith('file://')) {
    const filePath = key.replace('file://', '');
    return await readFile(filePath, 'utf-8');
  }
  if (key.startsWith('/')) {
    return await readFile(key, 'utf-8');
  }

  const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const body = result.Body;
  if (!body) return '';
  // Body is a Readable stream in Node.js. Collect into string.
  const chunks: Buffer[] = [];
  const stream: NodeJS.ReadableStream = body as unknown as NodeJS.ReadableStream;
  return await new Promise<string>((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}


