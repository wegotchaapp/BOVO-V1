import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

const CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

function missing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; name?: string };
  return e.code === 'ENOENT' || e.name === 'NoSuchKey' || e.name === 'NotFound';
}

/** No public URL is ever generated. The local directory is outside /uploads. */
@Injectable()
export class PrivateMediaService implements OnModuleInit {
  private readonly s3: S3Client | null;
  private readonly bucket: string;
  private readonly root = join(process.cwd(), 'private-media');

  constructor(config: ConfigService) {
    const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY');
    const production = config.get<string>('NODE_ENV') === 'production';
    const validKey =
      !!accessKeyId && /^(AKIA|ASIA)[0-9A-Z]{16}$/.test(accessKeyId);
    const driver =
      config.get<string>('PRIVATE_MEDIA_DRIVER') ||
      (production || (validKey && secretAccessKey) ? 's3' : 'local');
    if (driver !== 's3' && driver !== 'local') {
      throw new Error('PRIVATE_MEDIA_DRIVER must be s3 or local');
    }
    if (production && driver === 'local') {
      throw new Error('Production identity media requires S3 storage');
    }
    if (
      driver === 's3' &&
      (accessKeyId || secretAccessKey) &&
      (!validKey || !secretAccessKey)
    ) {
      throw new Error('Invalid AWS credentials for private media storage');
    }
    const sessionToken = config.get<string>('AWS_SESSION_TOKEN');
    if (driver === 's3' && accessKeyId?.startsWith('ASIA') && !sessionToken) {
      throw new Error('Temporary AWS credentials require AWS_SESSION_TOKEN');
    }
    this.s3 =
      driver === 's3'
        ? new S3Client({
            region: config.get<string>('AWS_REGION') || 'us-east-1',
            ...(accessKeyId && secretAccessKey
              ? { credentials: { accessKeyId, secretAccessKey, sessionToken } }
              : {}),
          })
        : null;
    this.bucket =
      config.get<string>('PRIVATE_MEDIA_BUCKET') || 'bovogo-private-media';
  }

  async onModuleInit(): Promise<void> {
    // Resolve the SDK credential chain (including instance/IRSA credentials) at
    // boot. A configured cloud backend must never fall back to ephemeral disk.
    if (this.s3) await this.s3.config.credentials();
  }

  private validateKey(key: string): void {
    if (
      !key ||
      key.length > 512 ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_./-]*$/.test(key) ||
      key.includes('..') ||
      key.split('/').some((p) => !p || p === '.')
    ) {
      throw new BadRequestException('Invalid private media key');
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    this.validateKey(key);
    if (!CONTENT_TYPES.has(contentType))
      throw new BadRequestException('Unsupported private media type');
    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ServerSideEncryption: 'AES256',
        }),
      );
      return;
    }
    // A single atomic envelope keeps the content type and bytes consistent.
    const target = join(this.root, key + '.json');
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    const temp = target + '.' + randomUUID() + '.tmp';
    try {
      await writeFile(
        temp,
        JSON.stringify({ contentType, body: body.toString('base64') }),
        { mode: 0o600, flag: 'wx' },
      );
      await rename(temp, target);
    } finally {
      await unlink(temp).catch((error: unknown) => {
        if (!missing(error)) throw error;
      });
    }
  }

  async read(key: string): Promise<{ body: Buffer; contentType: string }> {
    this.validateKey(key);
    try {
      if (this.s3) {
        const result = await this.s3.send(
          new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        );
        if (!result.Body)
          throw new NotFoundException('Private media not found');
        const contentType = result.ContentType ?? 'application/octet-stream';
        return {
          body: Buffer.from(await result.Body.transformToByteArray()),
          contentType: CONTENT_TYPES.has(contentType)
            ? contentType
            : 'application/octet-stream',
        };
      }
      const envelope = JSON.parse(
        await readFile(join(this.root, key + '.json'), 'utf8'),
      ) as { body: string; contentType: string };
      return {
        body: Buffer.from(envelope.body, 'base64'),
        contentType: CONTENT_TYPES.has(envelope.contentType)
          ? envelope.contentType
          : 'application/octet-stream',
      };
    } catch (error: unknown) {
      if (missing(error))
        throw new NotFoundException('Private media not found');
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    this.validateKey(key);
    try {
      if (this.s3)
        await this.s3.send(
          new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
        );
      else await unlink(join(this.root, key + '.json'));
    } catch (error: unknown) {
      if (!missing(error)) throw error;
    }
  }
}
