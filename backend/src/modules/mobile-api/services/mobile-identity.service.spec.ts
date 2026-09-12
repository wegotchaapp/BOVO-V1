import {
  BadRequestException,
  ConflictException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import {
  MobileIdentityVerification,
  MobileUser,
} from '../entities/mobile.entities';
import {
  IdentityFile,
  IdentityUpload,
  MobileIdentityService,
} from './mobile-identity.service';

const USER = '11111111-1111-4111-8111-111111111111';

const LICENSE = { documentType: 'drivers_license' } as const;
const STATE_ID = { documentType: 'state_id' } as const;
const PASSPORT = { documentType: 'passport' } as const;

function image(mimetype = 'image/jpeg'): IdentityFile {
  return {
    buffer: Buffer.from('not-really-a-photo'),
    mimetype,
    originalname: 'photo.jpg',
    size: 18,
  };
}

/** All three slots filled, which is what a driver's licence needs. */
function upload(overrides: Partial<IdentityUpload> = {}): IdentityUpload {
  return {
    idFront: [image()],
    idBack: [image()],
    selfie: [image()],
    ...overrides,
  };
}

/** A passport submission: front and selfie, no back. */
const NO_BACK: IdentityUpload = { idFront: [image()], selfie: [image()] };

function row(
  overrides: Partial<MobileIdentityVerification> = {},
): MobileIdentityVerification {
  return {
    id: 'verification_1',
    user_id: USER,
    status: 'pending_review',
    document_type: 'drivers_license',
    id_front_key: `identity/${USER}/abc/id-front.jpg`,
    id_back_key: `identity/${USER}/abc/id-back.jpg`,
    selfie_key: `identity/${USER}/abc/selfie.jpg`,
    review_note: null,
    reviewed_by: null,
    reviewed_at: null,
    submitted_at: new Date('2026-09-12T10:00:00.000Z'),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function build() {
  const verifications = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((init: Partial<MobileIdentityVerification>) => ({
      ...init,
    })),
    save: jest.fn((r: Partial<MobileIdentityVerification>) =>
      Promise.resolve({ ...row(), ...r }),
    ),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const media = {
    put: jest.fn().mockResolvedValue(undefined),
    read: jest.fn(),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  // The account row the submission locks, and the purge deletes.
  const users = {
    findOne: jest
      .fn()
      .mockResolvedValue({ id: USER, deletion_requested_at: null }),
  };
  const manager = {
    getRepository: jest.fn((entity: unknown) =>
      entity === MobileUser ? users : verifications,
    ),
  };
  const dataSource = {
    transaction: jest.fn((run: (m: unknown) => unknown) => run(manager)),
  };
  const service = new MobileIdentityService(
    verifications as never,
    media as never,
    dataSource as never,
  );
  return { service, verifications, media, users, manager, dataSource };
}

/** Every key `put` was asked to write, in order. */
function writtenKeys(media: { put: jest.Mock }): string[] {
  return media.put.mock.calls.map(([key]) => key as string);
}

/** Every key `remove` was asked to erase, sorted. */
function removedKeys(media: { remove: jest.Mock }): string[] {
  return media.remove.mock.calls.map(([key]) => key as string).sort();
}

// Storage failures are logged loudly on purpose; the paths below exercise that,
// and the output belongs in production logs rather than in a test run.
beforeEach(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('MobileIdentityService.latest', () => {
  it('reports nothing for a user who has never submitted', async () => {
    const { service } = build();
    await expect(service.latest(USER)).resolves.toEqual({ verification: null });
  });

  it('never hands a storage key to the client', async () => {
    // The point of private media: a reviewer reads the bytes through the admin
    // routes, and the app that uploaded them cannot address them at all.
    const { service, verifications } = build();
    verifications.findOne.mockResolvedValue(row());

    const { verification } = await service.latest(USER);

    expect(verification).toEqual({
      id: 'verification_1',
      status: 'pending_review',
      documentType: 'drivers_license',
      submittedAt: '2026-09-12T10:00:00.000Z',
      reviewedAt: null,
      reviewNote: null,
    });
    expect(JSON.stringify(verification)).not.toContain('identity/');
  });

  it('reads the newest submission, not an older one', async () => {
    const { service, verifications } = build();
    verifications.findOne.mockResolvedValue(row());

    await service.latest(USER);

    expect(verifications.findOne).toHaveBeenCalledWith({
      where: { user_id: USER },
      order: { submitted_at: 'DESC' },
    });
  });
});

describe('MobileIdentityService.submit', () => {
  it('stores three images under one per-submission folder', async () => {
    const { service, verifications, media } = build();

    await service.submit(USER, LICENSE, upload());

    const keys = writtenKeys(media);
    expect(keys).toHaveLength(3);
    // One folder per submission, so a resubmission cannot overwrite the images
    // a reviewer is looking at.
    const folders = keys.map((k) => k.split('/').slice(0, 3).join('/'));
    expect(new Set(folders).size).toBe(1);
    const shape = new RegExp(
      `^identity/${USER}/[0-9a-f-]{36}/(id-front|id-back|selfie)\\.jpg$`,
    );
    for (const key of keys) expect(key).toMatch(shape);
    expect(verifications.save).toHaveBeenCalled();
  });

  it('records the row only after every image is stored', async () => {
    // A row whose images are missing puts a reviewer in front of a submission
    // they can neither approve nor reject fairly.
    const { service, verifications, media } = build();
    const order: string[] = [];
    media.put.mockImplementation(() => {
      order.push('put');
      return Promise.resolve();
    });
    verifications.save.mockImplementation(() => {
      order.push('save');
      return Promise.resolve(row());
    });

    await service.submit(USER, LICENSE, upload());

    expect(order).toEqual(['put', 'put', 'put', 'save']);
  });

  it('takes a passport without a back image', async () => {
    const { service, media } = build();

    await service.submit(USER, PASSPORT, NO_BACK);

    const keys = writtenKeys(media);
    expect(keys).toHaveLength(2);
    expect(keys.some((k) => k.includes('id-back'))).toBe(false);
  });

  it('names the missing side rather than failing vaguely', async () => {
    const { service, media } = build();

    const submit = service.submit(USER, STATE_ID, NO_BACK);

    await expect(submit).rejects.toThrow(/back of your ID/);
    expect(media.put).not.toHaveBeenCalled();
  });

  it('refuses a file that is not one of the accepted image types', async () => {
    const { service, media } = build();
    const pdf = upload({ selfie: [image('application/pdf')] });

    await expect(service.submit(USER, LICENSE, pdf)).rejects.toThrow(
      BadRequestException,
    );
    // Validation happens before anything reaches storage.
    expect(media.put).not.toHaveBeenCalled();
  });

  it('refuses a MIME type inherited from Object.prototype', async () => {
    // `constructor` used to resolve to a truthy value on the lookup object and
    // pass for a supported image type.
    const { service, media } = build();
    const inherited = upload({ idFront: [image('constructor')] });

    await expect(service.submit(USER, LICENSE, inherited)).rejects.toThrow(
      BadRequestException,
    );
    expect(media.put).not.toHaveBeenCalled();
  });

  it('refuses an empty file', async () => {
    const { service } = build();
    const blank = { ...image(), buffer: Buffer.alloc(0), size: 0 };
    const empty = upload({ idFront: [blank] });

    await expect(service.submit(USER, LICENSE, empty)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('will not take a second submission while one is under review', async () => {
    const { service, verifications, media } = build();
    verifications.findOne.mockResolvedValue(row({ status: 'pending_review' }));

    await expect(service.submit(USER, LICENSE, upload())).rejects.toThrow(
      ConflictException,
    );
    expect(media.put).not.toHaveBeenCalled();
    expect(verifications.save).not.toHaveBeenCalled();
  });

  it('will not re-verify someone already approved', async () => {
    const { service, verifications } = build();
    verifications.findOne.mockResolvedValue(row({ status: 'approved' }));

    await expect(service.submit(USER, LICENSE, upload())).rejects.toThrow(
      ConflictException,
    );
  });

  it('lets a rejected submission be replaced', async () => {
    const { service, verifications, media } = build();
    const rejected = row({ status: 'rejected', review_note: 'Too dark.' });
    verifications.findOne.mockResolvedValue(rejected);

    await service.submit(USER, LICENSE, upload());

    expect(media.put).toHaveBeenCalledTimes(3);
    expect(verifications.save).toHaveBeenCalled();
  });

  it('erases the images it wrote when the row cannot be saved', async () => {
    // Otherwise a government ID sits in storage with no row pointing at it, so
    // neither a purge nor a reviewer can ever reach it again.
    const { service, verifications, media } = build();
    verifications.save.mockRejectedValue(new Error('connection lost'));

    await expect(service.submit(USER, LICENSE, upload())).rejects.toThrow(
      'connection lost',
    );

    expect(removedKeys(media)).toEqual(writtenKeys(media).sort());
  });

  it('erases every key it tried to write when a later upload fails', async () => {
    const { service, media } = build();
    media.put
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(service.submit(USER, LICENSE, upload())).rejects.toThrow(
      'storage unavailable',
    );

    // Both the image that landed and the one that failed: a failed `put` can
    // still have stored the object. The selfie was never attempted.
    expect(removedKeys(media)).toEqual(writtenKeys(media).sort());
    expect(media.remove).toHaveBeenCalledTimes(2);
    expect(removedKeys(media).some((k) => k.includes('selfie'))).toBe(false);
  });

  it('erases the first key even when that very upload is the one that failed', async () => {
    // The ambiguous case, and the one that used to leak: `put` rejecting says
    // nothing about whether S3 stored the bytes — a write that succeeds and
    // then times out on the response looks identical from here. Recording the
    // key before the call is what makes it reachable by the cleanup at all.
    const { service, verifications, media } = build();
    media.put.mockRejectedValueOnce(new Error('socket hang up'));

    await expect(service.submit(USER, LICENSE, upload())).rejects.toThrow(
      'socket hang up',
    );

    expect(media.put).toHaveBeenCalledTimes(1);
    expect(media.remove).toHaveBeenCalledTimes(1);
    expect(media.remove).toHaveBeenCalledWith(writtenKeys(media)[0]);
    expect(verifications.save).not.toHaveBeenCalled();
  });

  it('reports the real failure when the cleanup fails too', async () => {
    // There is no row left to retry from, so the cleanup logs and gives up —
    // but the user must hear about the save, not about our housekeeping.
    const { service, verifications, media } = build();
    verifications.save.mockRejectedValue(new Error('connection lost'));
    media.remove.mockRejectedValue(new Error('storage unavailable'));

    await expect(service.submit(USER, LICENSE, upload())).rejects.toThrow(
      'connection lost',
    );
    expect(media.remove).toHaveBeenCalledTimes(3);
  });

  it('turns the one-pending index violation into a conflict', async () => {
    // Two submissions racing each other: the partial unique index is what
    // actually enforces one pending review per user.
    const { service, verifications, media } = build();
    const duplicate = Object.assign(new Error('duplicate key value'), {
      code: '23505',
    });
    verifications.save.mockRejectedValue(duplicate);

    await expect(service.submit(USER, LICENSE, upload())).rejects.toThrow(
      ConflictException,
    );
    expect(media.remove).toHaveBeenCalledTimes(3);
  });
});

describe('MobileIdentityService.submit — the account-deletion race', () => {
  it('locks the account row for the insert', async () => {
    // `mobile_identity_verifications` has no foreign key to the user, so the
    // lock is the only thing stopping a purge finishing mid-submission.
    const { service, users, dataSource } = build();

    await service.submit(USER, LICENSE, upload());

    expect(dataSource.transaction).toHaveBeenCalled();
    expect(users.findOne).toHaveBeenCalledWith({
      where: { id: USER },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it('refuses, and erases the images, when the account has been purged', async () => {
    // Otherwise the row and three ID images outlive their owner, unreachable by
    // any later purge and attached to nobody a reviewer could act on.
    const { service, verifications, users, media } = build();
    users.findOne.mockResolvedValue(null);

    await expect(service.submit(USER, LICENSE, upload())).rejects.toThrow(
      UnauthorizedException,
    );
    expect(verifications.save).not.toHaveBeenCalled();
    expect(removedKeys(media)).toEqual(writtenKeys(media).sort());
  });

  it('refuses, and erases the images, while deletion is scheduled', async () => {
    const { service, verifications, users, media } = build();
    users.findOne.mockResolvedValue({
      id: USER,
      deletion_requested_at: new Date(),
    });

    await expect(service.submit(USER, LICENSE, upload())).rejects.toThrow(
      ConflictException,
    );
    expect(verifications.save).not.toHaveBeenCalled();
    expect(media.remove).toHaveBeenCalledTimes(3);
  });
});

describe('MobileIdentityService.submit — the approval race', () => {
  it('rechecks the status under the account lock, not only before the uploads', async () => {
    const { service, verifications, users, media } = build();
    const order: string[] = [];
    verifications.findOne.mockImplementation(() => {
      order.push('status');
      return Promise.resolve(null);
    });
    users.findOne.mockImplementation(() => {
      order.push('lock');
      return Promise.resolve({ id: USER, deletion_requested_at: null });
    });
    verifications.save.mockImplementation(() => {
      order.push('save');
      return Promise.resolve(row());
    });

    await service.submit(USER, LICENSE, upload());

    // The second read has to sit between the lock and the insert. Before the
    // lock it would be exactly as stale as the first one.
    expect(order).toEqual(['status', 'lock', 'status', 'save']);
    expect(media.put).toHaveBeenCalledTimes(3);
  });

  it('refuses a submission that was approved while its images uploaded', async () => {
    // The race: two submissions both clear the cheap pre-upload check, the
    // first is saved and an admin approves it, and the second then takes the
    // lock and lands a fresh pending row on an already-verified identity. The
    // partial unique index cannot catch this one — it only covers
    // `pending_review`, and the row it would collide with is now `approved`.
    const { service, verifications, media } = build();
    verifications.findOne
      .mockResolvedValueOnce(row({ status: 'rejected' }))
      .mockResolvedValueOnce(row({ status: 'approved' }));

    await expect(service.submit(USER, LICENSE, upload())).rejects.toThrow(
      /already verified/,
    );

    expect(verifications.save).not.toHaveBeenCalled();
    // And the images it uploaded for that refused submission are erased.
    expect(removedKeys(media)).toEqual(writtenKeys(media).sort());
  });

  it('refuses a submission that went under review while its images uploaded', async () => {
    const { service, verifications, media } = build();
    verifications.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(row({ status: 'pending_review' }));

    await expect(service.submit(USER, LICENSE, upload())).rejects.toThrow(
      ConflictException,
    );

    expect(verifications.save).not.toHaveBeenCalled();
    expect(removedKeys(media)).toEqual(writtenKeys(media).sort());
  });

  it('asks for the newest submission on the recheck, not an arbitrary one', async () => {
    const { service, verifications } = build();

    await service.submit(USER, LICENSE, upload());

    expect(verifications.findOne).toHaveBeenCalledTimes(2);
    expect(verifications.findOne).toHaveBeenLastCalledWith({
      where: { user_id: USER },
      order: { submitted_at: 'DESC' },
    });
  });
});

describe('MobileIdentityService.purge', () => {
  it('erases every image and every row for the user', async () => {
    const { service, verifications, media, manager } = build();
    verifications.find.mockResolvedValue([
      row({ id: 'v1' }),
      row({
        id: 'v2',
        id_front_key: `identity/${USER}/def/id-front.png`,
        // A passport submission: no back image to erase.
        id_back_key: null,
        selfie_key: `identity/${USER}/def/selfie.png`,
      }),
    ]);

    await service.purge(USER, manager as never);

    expect(removedKeys(media)).toEqual([
      `identity/${USER}/abc/id-back.jpg`,
      `identity/${USER}/abc/id-front.jpg`,
      `identity/${USER}/abc/selfie.jpg`,
      `identity/${USER}/def/id-front.png`,
      `identity/${USER}/def/selfie.png`,
    ]);
    expect(verifications.delete).toHaveBeenCalledWith({ user_id: USER });
  });

  it('keeps the rows and fails when an image cannot be erased', async () => {
    // Deleting the rows would destroy the only record of those keys, so a
    // storage failure has to abort the whole purge and leave it retryable.
    const { service, verifications, media, manager } = build();
    verifications.find.mockResolvedValue([row()]);
    media.remove.mockRejectedValue(new Error('storage unavailable'));

    await expect(service.purge(USER, manager as never)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(verifications.delete).not.toHaveBeenCalled();
  });

  it('fails the purge even when only one image of several is stuck', async () => {
    const { service, verifications, media, manager } = build();
    verifications.find.mockResolvedValue([row()]);
    media.remove
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce(undefined);

    await expect(service.purge(USER, manager as never)).rejects.toThrow(
      ServiceUnavailableException,
    );
    // Every key is still attempted, so a retry has less to do.
    expect(media.remove).toHaveBeenCalledTimes(3);
    expect(verifications.delete).not.toHaveBeenCalled();
  });

  it('does nothing for a user who never submitted', async () => {
    const { service, verifications, media, manager } = build();

    await service.purge(USER, manager as never);

    expect(media.remove).not.toHaveBeenCalled();
    expect(verifications.delete).not.toHaveBeenCalled();
  });
});
