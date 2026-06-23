import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class PreferencesService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly logger: PinoLogger,
  ) {}

  async setPreferences(userId: string, prefs: any): Promise<any> {
    await this.userRepo.update(userId, { ride_preferences: prefs });
    this.logger.info({ userId }, 'Preferences saved');
    return { message: 'Preferences saved', ...prefs };
  }

  async getPreferences(userId: string): Promise<any> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['ride_preferences'],
    });
    return user?.ride_preferences || {};
  }

  calculateMatchScore(riderPrefs: any, driverPrefs: any): number {
    let score = 50;
    if (riderPrefs.conversation === driverPrefs.conversation) score += 20;
    if (riderPrefs.music === driverPrefs.music) score += 15;
    if (riderPrefs.volume === driverPrefs.volume) score += 10;
    if (riderPrefs.pets === driverPrefs.pets) score += 5;
    return Math.min(100, score);
  }
}
