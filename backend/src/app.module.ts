import { PrivateQueryLogger } from './database/private-query.logger';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
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
        logger: new PrivateQueryLogger(
          config.get<string>('NODE_ENV') !== 'production',
        ),
        extra: {
          /**
           * Connections per app instance. Supabase's DIRECT connection
           * (port 5432) has a hard project-wide cap, so `max × instances` must
           * stay under it. For real traffic, point DATABASE_URL at the
           * Supavisor pooler on port 6543 (transaction mode) and keep 5432 for
           * migrations only — that is what lets instances scale horizontally.
           */
          max: Number(config.get<string>('DATABASE_POOL_MAX') ?? 20),
          idleTimeoutMillis: 30_000,
          /** Fail fast when the pool is saturated instead of queueing forever. */
          connectionTimeoutMillis: 10_000,
          /**
           * A runaway query must not pin a connection indefinitely — that is
           * how one slow endpoint takes down every other one under load.
           */
          statement_timeout: Number(
            config.get<string>('DATABASE_STATEMENT_TIMEOUT_MS') ?? 15_000,
          ),
          query_timeout: Number(
            config.get<string>('DATABASE_STATEMENT_TIMEOUT_MS') ?? 15_000,
          ),
          application_name: 'bovogo-api',
        },
      }),
    }),
    /**
     * Blunt per-IP ceiling for everything that has no explicit `@Throttle`.
     * Deliberately generous: mobile carriers put thousands of subscribers
     * behind one CGNAT address, so a tight global bucket would read as an
     * outage. Endpoints worth brute-forcing (sign-in, OTP, password reset)
     * carry their own far stricter limits at the route.
     *
     * Storage is the in-memory default, so the ceiling is per instance —
     * see workflow/SECURITY_WAVE1_2026-09-23.md for the shared-store
     * follow-up, which needs a dependency this lane may not add.
     */
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 600,
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
  providers: [
    // Without this binding `ThrottlerModule.forRoot` registers storage and
    // nothing else: every `@Throttle` in the codebase is unread metadata and
    // sign-in accepts unlimited attempts.
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
  ],
})
export class AppModule {}
