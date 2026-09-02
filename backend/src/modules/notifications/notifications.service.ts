import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  NotificationLog,
  Device,
  NotificationPreference,
  EmergencyContact,
} from '../../database/entities/communication.entities';
import { User } from '../../database/entities/user.entity';
import { Booking } from '../../database/entities/booking.entities';
import { PinoLogger } from 'nestjs-pino';
import { Twilio } from 'twilio';
import {
  Expo,
  ExpoPushReceipt,
  ExpoPushErrorReceipt,
  ExpoPushSuccessReceipt,
} from 'expo-server-sdk';
import { Resend } from 'resend';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as path from 'path';

export type NotificationChannel = 'push' | 'sms' | 'email' | 'in_app';
export type NotificationCategory =
  | 'booking'
  | 'pre_trip'
  | 'in_trip'
  | 'post_trip'
  | 'safety'
  | 'insurance'
  | 'marketing'
  | 't_s_action'
  | 'sos_alert'
  | 'route_deviation'
  | 'review_submitted'
  | 'payment_received'
  | 'booking_request'
  | 'booking_confirmed'
  | 'booking_declined'
  | 'trip_departing'
  | 'trip_completed';

export type NotificationPriority = 'normal' | 'high' | 'critical';

export interface NotificationPayload {
  userId: string;
  channel: NotificationChannel;
  category: NotificationCategory;
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: NotificationPriority;
  logId?: string;
}

export interface EmailTemplateContext {
  userName: string;
  [key: string]: any;
}

const CHANNEL_RULES: Record<string, NotificationChannel[]> = {
  booking: ['push', 'email'],
  pre_trip: ['push', 'sms'],
  in_trip: ['push', 'in_app'],
  post_trip: ['push', 'email'],
  safety: ['push', 'sms', 'email'],
  insurance: ['email'],
  marketing: ['email'],
  t_s_action: ['push', 'email'],
  sos_alert: ['push', 'sms', 'email'],
  route_deviation: ['push', 'sms'],
  review_submitted: ['push'],
  payment_received: ['push', 'email'],
  booking_request: ['push', 'email'],
  booking_confirmed: ['push', 'email', 'sms'],
  booking_declined: ['push', 'email'],
  trip_departing: ['push', 'sms'],
  trip_completed: ['push', 'email'],
};

const CRITICAL_CATEGORIES: Set<string> = new Set([
  'safety',
  'sos_alert',
  'route_deviation',
]);

@Injectable()
export class NotificationsService implements OnModuleInit {
  private twilio: Twilio;
  private resend: Resend;
  private expo: Expo;

  constructor(
    @InjectQueue('notifications')
    private readonly notificationQueue: Queue,
    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(NotificationPreference)
    private readonly prefRepo: Repository<NotificationPreference>,
    @InjectRepository(EmergencyContact)
    private readonly contactRepo: Repository<EmergencyContact>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.twilio = new Twilio(
      this.config.get('TWILIO_ACCOUNT_SID'),
      this.config.get('TWILIO_AUTH_TOKEN'),
    );
    this.resend = new Resend(this.config.get('RESEND_API_KEY') || '');
    this.expo = new Expo();
  }

  async onModuleInit() {
    this.logger.info('NotificationsService initialized');
  }

  async send(
    userId: string,
    category: NotificationCategory,
    title: string,
    body: string,
    data?: Record<string, string>,
    priority?: NotificationPriority,
  ) {
    const isCritical = CRITICAL_CATEGORIES.has(category);

    const channels = this.getChannelsForCategory(category, isCritical);
    const userPrefs = await this.getUserPreferences(userId);
    const allowedChannels = this.filterByPreferences(
      channels,
      category,
      userPrefs,
      isCritical,
    );

    const log = this.logRepo.create({
      user_id: userId,
      channel: allowedChannels.join(','),
      category,
      title,
      body,
      data,
      delivery_status: 'queued',
    });
    await this.logRepo.save(log);

    for (const channel of allowedChannels) {
      await this.notificationQueue.add(
        'deliver',
        {
          userId,
          channel,
          category,
          title,
          body,
          data,
          priority: priority || (isCritical ? 'critical' : 'normal'),
          logId: log.id,
          timestamp: new Date().toISOString(),
        },
        {
          delay: this.getQuietHoursDelay(userId, channel, category),
          priority: isCritical ? 1 : priority === 'high' ? 5 : 10,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          jobId: `notify_${userId}_${category}_${Date.now()}_${channel}`,
        },
      );
    }

    return log.id;
  }

  async sendPush(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    const devices = await this.deviceRepo.find({
      where: { user_id: userId, is_active: true },
    });

    if (devices.length === 0) {
      this.logger.warn({ userId }, 'No active devices for push notification');
      return { success: false, reason: 'no_devices' };
    }

    const messages = devices
      .filter((d) => Expo.isExpoPushToken(d.expo_push_token))
      .map((d) => ({
        to: d.expo_push_token,
        title,
        body,
        data,
        sound: 'default',
        priority: 'high' as const,
        channelId: 'default',
      }));

    if (messages.length === 0) {
      this.logger.warn({ userId }, 'No valid Expo push tokens');
      return { success: false, reason: 'invalid_tokens' };
    }

    const chunks = this.expo.chunkPushNotifications(messages);
    const tickets: ExpoPushReceipt[] = [];

    for (const chunk of chunks) {
      try {
        const receiptChunk = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...receiptChunk);
      } catch (err) {
        this.logger.error(
          { err, userId },
          'Failed to send push notification chunk',
        );
      }
    }

    for (let i = 0; i < tickets.length; i++) {
      const receipt = tickets[i];
      const device = devices[i];

      if (receipt.status === 'error') {
        const errorReceipt = receipt;
        this.logger.warn(
          {
            deviceId: device?.id,
            error: errorReceipt.message,
            details: errorReceipt.details,
          },
          'Push notification error',
        );

        if (errorReceipt.details?.error === 'DeviceNotRegistered') {
          await this.deviceRepo.update(device.id, { is_active: false });
        }
      }
    }

    return { success: tickets.some((t) => t.status === 'ok'), tickets };
  }

  async checkPushReceipts(receiptIds: string[]): Promise<void> {
    const receipts =
      await this.expo.getPushNotificationReceiptsAsync(receiptIds);

    for (const [id, receipt] of Object.entries(receipts)) {
      if (receipt.status === 'error') {
        const errorReceipt = receipt;
        this.logger.warn(
          { receiptId: id, error: errorReceipt.message },
          'Push receipt error',
        );

        if (errorReceipt.details?.error === 'DeviceNotRegistered') {
          await this.deviceRepo.update(
            { expo_push_token: (errorReceipt.details as any)?.deviceToken },
            { is_active: false },
          );
        }
      }
    }
  }

  async sendSMS(phone: string, body: string, mediaUrl?: string) {
    const fromNumber = this.config.get('TWILIO_PHONE_NUMBER');
    if (!fromNumber) {
      throw new Error('TWILIO_PHONE_NUMBER not configured');
    }

    const messageParams: any = {
      body,
      from: fromNumber,
      to: phone,
    };

    if (mediaUrl) {
      messageParams.mediaUrl = [mediaUrl];
    }

    const result = await this.twilio.messages.create(messageParams);

    this.logger.info(
      { messageSid: result.sid, to: phone, status: result.status },
      'SMS sent',
    );

    return result;
  }

  async sendEmail(
    to: string,
    templateName: string,
    context: EmailTemplateContext,
  ) {
    const { render } = await import('@react-email/render');

    const templatePath = this.getTemplatePath(templateName);
    const TemplateModule = await import(templatePath);
    const TemplateComponent =
      TemplateModule.default || TemplateModule[Object.keys(TemplateModule)[0]];

    if (!TemplateComponent) {
      throw new Error(`Email template "${templateName}" not found`);
    }

    const html = await render(TemplateComponent(context), { pretty: true });

    const fromAddress =
      this.config.get('RESEND_FROM_EMAIL') || 'noreply@bovogo.app';
    const appName = this.config.get('APP_NAME') || 'Bovogo';

    const result = await this.resend.emails.send({
      from: `${appName} <${fromAddress}>`,
      to,
      subject: context.subject || context.title || 'Notification from Bovogo',
      html,
      text: context.textPlain || this.stripHtml(html),
    });

    if (result.error) {
      this.logger.error({ error: result.error, to }, 'Email send failed');
      throw new Error(`Email send failed: ${result.error.message}`);
    }

    this.logger.info(
      { emailId: result.data?.id, to, template: templateName },
      'Email sent',
    );
    return result.data;
  }

  async registerDevice(
    userId: string,
    expoPushToken: string,
    deviceId?: string,
    platform?: string,
    timezone?: string,
  ) {
    if (!Expo.isExpoPushToken(expoPushToken)) {
      this.logger.warn(
        { userId, token: expoPushToken },
        'Invalid Expo push token',
      );
      throw new Error('Invalid Expo push token');
    }

    const whereClause: any = { user_id: userId };
    if (deviceId) whereClause.device_id = deviceId;
    if (platform) whereClause.platform = platform;

    let device = await this.deviceRepo.findOne({ where: whereClause });

    if (device) {
      device.expo_push_token = expoPushToken;
      device.is_active = true;
      if (timezone) device.timezone = timezone;
    } else {
      device = this.deviceRepo.create({
        user_id: userId,
        expo_push_token: expoPushToken,
        device_id: deviceId,
        platform,
        timezone,
        is_active: true,
      });
    }

    const saved = await this.deviceRepo.save(device);
    this.logger.info(
      { deviceId: saved.id, userId, platform },
      'Device registered',
    );
    return saved;
  }

  async getPreferences(userId: string) {
    const defaults = this.getDefaultPreferences();
    const userPrefs = await this.prefRepo.findOne({
      where: { user_id: userId },
    });

    if (!userPrefs) {
      const newPrefs = this.prefRepo.create({
        user_id: userId,
        preferences: defaults,
      });
      await this.prefRepo.save(newPrefs);
      return defaults;
    }

    return this.mergePreferences(defaults, userPrefs.preferences);
  }

  async updatePreferences(
    userId: string,
    updates: Partial<Record<string, Record<string, boolean>>>,
  ) {
    const defaults = this.getDefaultPreferences();
    const existing = await this.prefRepo.findOne({
      where: { user_id: userId },
    });
    const current = existing
      ? this.mergePreferences(defaults, existing.preferences)
      : defaults;

    for (const [category, channels] of Object.entries(updates)) {
      if (!current[category]) continue;

      if (CRITICAL_CATEGORIES.has(category)) {
        continue;
      }

      for (const [channel, enabled] of Object.entries(channels || {})) {
        if (current[category][channel] !== undefined) {
          current[category][channel] = enabled;
        }
      }
    }

    if (existing) {
      existing.preferences = current;
      await this.prefRepo.save(existing);
    } else {
      await this.prefRepo.save(
        this.prefRepo.create({ user_id: userId, preferences: current }),
      );
    }

    this.logger.info(
      { userId, preferences: current },
      'Notification preferences updated',
    );
    return current;
  }

  async getMyNotifications(
    userId: string,
    limit = 50,
    cursor?: string,
  ): Promise<any> {
    const query: any = { user_id: userId };
    if (cursor) {
      query.id = { lt: cursor };
    }

    const notifications = await this.logRepo.find({
      where: query,
      order: { created_at: 'DESC' },
      take: limit + 1,
    });

    const hasMore = notifications.length > limit;
    if (hasMore) notifications.pop();

    const nextCursor =
      hasMore && notifications.length > 0
        ? notifications[notifications.length - 1].id
        : undefined;

    return {
      notifications,
      has_more: hasMore,
      next_cursor: nextCursor,
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.logRepo.count({
      where: { user_id: userId, is_read: false },
    });
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    await this.logRepo.update({ id, user_id: userId }, { is_read: true });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.logRepo.update(
      { user_id: userId, is_read: false },
      { is_read: true },
    );
  }

  async scheduleBookingReminders(bookingId: string) {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip'],
    });

    if (!booking || !booking.trip?.departure_date) return;

    const departureDate = new Date(booking.trip.departure_date);
    const now = new Date();
    const hoursUntilDeparture =
      (departureDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilDeparture <= 0) return;

    const reminder48h = new Date(departureDate.getTime() - 48 * 60 * 60 * 1000);
    const reminder2h = new Date(departureDate.getTime() - 2 * 60 * 60 * 1000);

    if (reminder48h > now) {
      await this.notificationQueue.add(
        'reminder',
        {
          type: '48h',
          bookingId,
          scheduledFor: reminder48h.toISOString(),
        },
        {
          delay: reminder48h.getTime() - now.getTime(),
          jobId: `reminder_48h_${bookingId}`,
          removeOnComplete: true,
        },
      );
    }

    if (reminder2h > now) {
      await this.notificationQueue.add(
        'reminder',
        {
          type: '2h',
          bookingId,
          scheduledFor: reminder2h.toISOString(),
        },
        {
          delay: reminder2h.getTime() - now.getTime(),
          jobId: `reminder_2h_${bookingId}`,
          removeOnComplete: true,
        },
      );
    }

    this.logger.info(
      {
        bookingId,
        reminder48h: reminder48h.toISOString(),
        reminder2h: reminder2h.toISOString(),
      },
      'Booking reminders scheduled',
    );
  }

  async cancelBookingReminders(bookingId: string) {
    const jobs = await this.notificationQueue.getJobs(['delayed', 'waiting']);

    for (const job of jobs) {
      if (job.name === 'reminder' && job.data.bookingId === bookingId) {
        await job.remove();
      }
    }

    this.logger.info({ bookingId }, 'Booking reminders cancelled');
  }

  @Cron(CronExpression.EVERY_HOUR)
  async processPendingReceipts() {
    const allRecentLogs = await this.logRepo.find({
      where: {
        delivery_status: 'sent',
        channel: 'push',
      },
      take: 100,
    });

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogs = allRecentLogs.filter(
      (log) => new Date(log.created_at) >= oneDayAgo,
    );

    const receiptIds = recentLogs
      .map((log) => log.data?.receiptId)
      .filter(Boolean) as string[];

    if (receiptIds.length === 0) return;

    await this.checkPushReceipts(receiptIds);
  }

  async processNotificationJob(job: Job<NotificationPayload>) {
    const { userId, channel, category, title, body, data, priority } = job.data;

    try {
      switch (channel) {
        case 'push':
          await this.sendPush(userId, title, body, data);
          break;
        case 'sms':
          const user = await this.userRepo.findOne({ where: { id: userId } });
          if (user?.phone) {
            await this.sendSMS(user.phone, `${title}: ${body}`);
          }
          break;
        case 'email':
          const emailUser = await this.userRepo.findOne({
            where: { id: userId },
          });
          if (emailUser?.email) {
            await this.sendEmail(
              emailUser.email,
              this.getEmailTemplateForCategory(category),
              { userName: emailUser.name, title, body, ...data },
            );
          }
          break;
        case 'in_app':
          break;
      }

      await this.logRepo.update(job.data.logId || '', {
        delivery_status: 'delivered',
        delivered_at: new Date().toISOString(),
      });

      this.logger.info(
        { userId, channel, category, jobId: job.id },
        'Notification delivered',
      );
    } catch (err) {
      await this.logRepo.update(job.data.logId || '', {
        delivery_status: 'failed',
        delivered_at: new Date().toISOString(),
      });

      this.logger.error(
        {
          err,
          userId,
          channel,
          category,
          jobId: job.id,
          attempt: job.attemptsMade,
        },
        'Notification delivery failed',
      );
      throw err;
    }
  }

  async processReminderJob(
    job: Job<{ type: '48h' | '2h'; bookingId: string }>,
  ) {
    const { type, bookingId } = job.data;

    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip', 'trip.driver', 'rider'],
    });

    if (!booking || !booking.trip) return;

    const driver = booking.trip.driver;
    const rider = booking.rider;

    if (type === '48h') {
      const driverTitle = 'Trip reminder: 48 hours to departure';
      const driverBody = `Your trip from ${booking.trip.origin_metro} to ${booking.trip.dest_metro} departs in 48 hours.`;
      await this.send(driver.id, 'pre_trip', driverTitle, driverBody, {
        booking_id: bookingId,
        screen: `booking/${bookingId}`,
      });

      const riderTitle = 'Trip reminder: 48 hours to departure';
      const riderBody = `Your trip with ${driver?.name || 'your driver'} departs in 48 hours. Share your trip with emergency contacts.`;
      await this.send(rider.id, 'pre_trip', riderTitle, riderBody, {
        booking_id: bookingId,
        screen: `booking/${bookingId}`,
      });
    } else if (type === '2h') {
      const driverTitle = 'Trip departing in 2 hours';
      const driverBody = `Your trip from ${booking.trip.origin_metro} departs soon. Check your route and passenger details.`;
      await this.send(driver.id, 'pre_trip', driverTitle, driverBody, {
        booking_id: bookingId,
        screen: `trip/${booking.trip.id}`,
      });

      const riderTitle = 'Trip departing in 2 hours';
      const riderBody = `${driver?.name || 'Your driver'}\'s trip departs soon. Meet at the pickup zone. Chat with your driver in the app.`;
      await this.send(rider.id, 'pre_trip', riderTitle, riderBody, {
        booking_id: bookingId,
        screen: `booking/${bookingId}`,
      });
    }

    this.logger.info({ bookingId, type }, 'Reminder notification sent');
  }

  async notifyEmergencyContacts(
    userId: string,
    alertType: 'sos' | 'deviation',
    location?: { lat: number; lng: number },
    bookingId?: string,
  ) {
    const contacts = await this.contactRepo.find({
      where: { user_id: userId, opted_in: true },
    });

    for (const contact of contacts) {
      const isSos = alertType === 'sos';
      const title = isSos ? 'SAFETY ALERT' : 'Trip safety notification';
      const body = isSos
        ? `${this.getUserName(userId)} has activated an emergency alert.`
        : `${this.getUserName(userId)}\'s trip has deviated from the expected route.`;

      if (contact.phone) {
        const mapsLink = location
          ? `https://maps.google.com/?q=${location.lat},${location.lng}`
          : '';
        const smsBody = isSos
          ? `SAFETY ALERT from Bovogo: ${this.getUserName(userId)} has activated an emergency alert. Location: ${mapsLink}`
          : `Bovogo: ${this.getUserName(userId)}\'s trip has deviated from the expected route. ${mapsLink}`;
        await this.sendSMS(contact.phone, smsBody);
      }

      if (contact.email) {
        await this.sendEmail(contact.email, 'safety_sos_contact', {
          userName: contact.name,
          alertedUserName: this.getUserName(userId),
          alertType,
          location,
          bookingId,
        });
      }
    }

    this.logger.info(
      { userId, contactCount: contacts.length, alertType },
      'Emergency contacts notified',
    );
  }

  private getChannelsForCategory(
    category: string,
    isCritical: boolean,
  ): NotificationChannel[] {
    return CHANNEL_RULES[category] || ['push', 'in_app'];
  }

  private filterByPreferences(
    channels: NotificationChannel[],
    category: string,
    prefs: Record<string, Record<string, boolean>>,
    isCritical: boolean,
  ): NotificationChannel[] {
    if (isCritical) return channels;

    const categoryPrefs = prefs[category];
    if (!categoryPrefs) return channels;

    return channels.filter((ch) => categoryPrefs[ch] !== false);
  }

  private async getUserPreferences(
    userId: string,
  ): Promise<Record<string, Record<string, boolean>>> {
    const defaults = this.getDefaultPreferences();
    const userPrefs = await this.prefRepo.findOne({
      where: { user_id: userId },
    });
    return userPrefs
      ? this.mergePreferences(defaults, userPrefs.preferences)
      : defaults;
  }

  private getQuietHoursDelay(
    userId: string,
    channel: NotificationChannel,
    category: string,
  ): number {
    if (CRITICAL_CATEGORIES.has(category)) return 0;
    if (channel === 'sms') return 0;

    return 0;
  }

  private getDefaultPreferences(): Record<string, Record<string, boolean>> {
    return {
      booking: { push: true, email: true, sms: false, in_app: true },
      pre_trip: { push: true, email: true, sms: true, in_app: true },
      in_trip: { push: true, email: false, sms: false, in_app: true },
      post_trip: { push: true, email: true, sms: false, in_app: true },
      safety: { push: true, email: true, sms: true, in_app: true },
      insurance: { push: false, email: true, sms: false, in_app: false },
      marketing: { push: false, email: false, sms: false, in_app: false },
    };
  }

  private mergePreferences(
    defaults: Record<string, Record<string, boolean>>,
    userPrefs: Record<string, Record<string, boolean>>,
  ): Record<string, Record<string, boolean>> {
    const merged = { ...defaults };
    for (const [category, channels] of Object.entries(userPrefs)) {
      if (merged[category]) {
        merged[category] = { ...merged[category], ...channels };
      } else {
        merged[category] = channels;
      }
    }
    return merged;
  }

  private getEmailTemplateForCategory(category: string): string {
    const templateMap: Record<string, string> = {
      booking: 'booking_confirmed',
      booking_confirmed: 'booking_confirmed',
      pre_trip: 'trip_reminder_48h',
      post_trip: 'payment_receipt',
      safety: 'safety_sos_contact',
      sos_alert: 'safety_sos_contact',
      t_s_action: 'trust_safety_action',
      insurance: 'payment_receipt',
      founding_insurance: 'founding_insurance_placeholder',
      payment_received: 'payment_receipt',
    };
    return templateMap[category] || 'booking_confirmed';
  }

  private getTemplatePath(templateName: string): string {
    return path.join(__dirname, '..', '..', 'emails', templateName);
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async getUserName(userId: string): Promise<string> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['name'],
    });
    return user?.name || 'A user';
  }
}
