import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { AuthModule } from './modules/auth/auth.module';
import { IdentityModule } from './modules/identity/identity.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { TripsModule } from './modules/trips/trips.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { LuggageModule } from './modules/luggage/luggage.module';
import { PreferencesModule } from './modules/preferences/preferences.module';
import { InsuranceModule } from './modules/insurance/insurance.module';
import { SafetyModule } from './modules/safety/safety.module';
import { ChatModule } from './modules/chat/chat.module';
import { TrustSafetyModule } from './modules/trust_safety/trust_safety.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './modules/health/health.module';
import { LoggerModule } from 'nestjs-pino';
import { RealtimeModule } from './common/gateways/realtime.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { DataRetentionModule } from './modules/retention/retention.module';
import { AdminModule } from './modules/admin/admin.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { FeedModule } from './modules/feed/feed.module';
import { WeatherModule } from './modules/weather/weather.module';
import { EmergencyContactsModule } from './modules/emergency-contacts/emergency-contacts.module';
import { LocationsModule } from './modules/locations/locations.module';
import { SupportModule } from './modules/support/support.module';
import { TripGroupsModule } from './modules/trip-groups/trip-groups.module';
import { TripRepliesModule } from './modules/trip-replies/trip-replies.module';
import { DriverTripsModule } from './modules/driver-trips/driver-trips.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { MobileApiModule } from './modules/mobile-api/mobile-api.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        base: { env: process.env.NODE_ENV || 'development' },
        customProps: () => ({ context: 'HTTP' }),
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        // Disable SSL for local/non-managed Postgres (set DATABASE_SSL=false).
        ssl:
          config.get<string>('DATABASE_SSL') === 'false'
            ? false
            : { rejectUnauthorized: false },
        autoLoadEntities: true,
        // Schema is normally managed by migrations. For local bring-up the
        // base tables can be created from entities by setting
        // DATABASE_SYNCHRONIZE=true. Never enable in production.
        synchronize:
          config.get<string>('DATABASE_SYNCHRONIZE') === 'true' &&
          config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('NODE_ENV') !== 'production',
        extra: {
          max: 20,
          idleTimeoutMillis: 30000,
        },
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL'),
          maxRetriesPerRequest: null,
          skipVersionCheck: true,
        },
      }),
    }),
    ScheduleModule.forRoot(),
    SupabaseModule,
    PricingModule,
    AuthModule,
    IdentityModule,
    ProfilesModule,
    TripsModule,
    BookingsModule,
    PaymentsModule,
    LuggageModule,
    PreferencesModule,
    InsuranceModule,
    SafetyModule,
    ChatModule,
    TrustSafetyModule,
    NotificationsModule,
    AuditModule,
    HealthModule,
    RealtimeModule,
    PrivacyModule,
    DataRetentionModule,
    AdminModule,
    FeedModule,
    WeatherModule,
    LocationsModule,
    EmergencyContactsModule,
    SupportModule,
    TripGroupsModule,
    TripRepliesModule,
    DriverTripsModule,
    ComplianceModule,
    MobileApiModule,
  ],
})
export class AppModule {}
