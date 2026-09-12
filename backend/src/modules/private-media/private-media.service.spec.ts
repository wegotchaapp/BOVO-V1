import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mkdtemp, rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PrivateMediaService } from './private-media.service';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

describe('PrivateMediaService', () => {
  let dir: string;
  let cwd: jest.SpyInstance;
  let service: PrivateMediaService;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'bovogo-private-test-'));
    cwd = jest.spyOn(process, 'cwd').mockReturnValue(dir);
    service = new PrivateMediaService(
      new ConfigService({ AWS_ACCESS_KEY_ID: 'placeholder' }),
    );
  });
  afterEach(async () => {
    cwd.mockRestore();
    jest.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it('round-trips binary media with private permissions, then removes it idempotently', async () => {
    const body = Buffer.from([0, 1, 255, 24]);
    await service.put('identity/user/front', body, 'image/jpeg');
    expect(await service.read('identity/user/front')).toEqual({
      body,
      contentType: 'image/jpeg',
    });
    expect(
      (await stat(join(dir, 'private-media/identity/user/front.json'))).mode &
        0o777,
    ).toBe(0o600);
    expect((await stat(join(dir, 'private-media'))).mode & 0o777).toBe(0o700);
    await service.remove('identity/user/front');
    await service.remove('identity/user/front');
    await expect(service.read('identity/user/front')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each([
    '../secret',
    '/absolute',
    'a/../secret',
    'a\\b',
    'a//b',
    'a/./b',
    '%2e%2e',
    '',
    'a..b',
  ])('rejects unsafe key %s for every operation', async (key) => {
    await expect(
      service.put(key, Buffer.from('test'), 'image/jpeg'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.read(key)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.remove(key)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses active HTML or injected content types', async () => {
    await expect(
      service.put('id', Buffer.from('<script>'), 'text/html'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.put('id', Buffer.from('test'), 'image/jpeg\r\nX-Test: true'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses encrypted S3 without a public ACL and never falls back after an S3 failure', async () => {
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as never);
    const cloud = new PrivateMediaService(
      new ConfigService({
        AWS_ACCESS_KEY_ID: 'AKIAABCDEFGHIJKLMNOP',
        AWS_SECRET_ACCESS_KEY: 'test-secret',
        PRIVATE_MEDIA_BUCKET: 'test-private',
      }),
    );
    await cloud.put('identity/front', Buffer.from('test'), 'image/png');
    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'test-private',
      ServerSideEncryption: 'AES256',
      ContentType: 'image/png',
    });
    expect(command.input.ACL).toBeUndefined();
    send.mockResolvedValueOnce({
      Body: {
        transformToByteArray: () => Promise.resolve(Buffer.from('test')),
      },
      ContentType: 'image/png',
    } as never);
    expect((await cloud.read('identity/front')).body.toString()).toBe('test');
    expect(send.mock.calls[1][0]).toBeInstanceOf(GetObjectCommand);
    await cloud.remove('identity/front');
    expect(send.mock.calls[2][0]).toBeInstanceOf(DeleteObjectCommand);
    send.mockRejectedValueOnce(new Error('S3 unavailable') as never);
    await expect(
      cloud.put('identity/front', Buffer.from('test'), 'image/png'),
    ).rejects.toThrow('S3 unavailable');
    await expect(stat(join(dir, 'private-media'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
