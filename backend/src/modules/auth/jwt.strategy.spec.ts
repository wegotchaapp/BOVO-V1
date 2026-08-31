import { JwtStrategy } from './jwt.strategy';
import { UserRole } from '../../common/enums';

describe('JwtStrategy', () => {
  it('returns the enforcement fields required by authorization guards', async () => {
    const users = {
      findOne: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'driver@example.com',
        role: UserRole.DRIVER,
        is_email_verified: true,
        is_phone_verified: true,
        tax_blocked: true,
        deleted_at: null,
      }),
    };
    const config = { get: jest.fn().mockReturnValue('test-jwt-secret') };
    const strategy = new JwtStrategy(users as never, config as never);

    await expect(
      strategy.validate({
        sub: 'user-1',
        role: UserRole.DRIVER,
        verified: true,
      }),
    ).resolves.toEqual({
      id: 'user-1',
      sub: 'user-1',
      email: 'driver@example.com',
      role: UserRole.DRIVER,
      verified: true,
      phone_verified: true,
      tax_blocked: true,
    });
    expect(users.findOne).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: [
        'id',
        'email',
        'role',
        'is_email_verified',
        'is_phone_verified',
        'tax_blocked',
      ],
    });
  });
});
