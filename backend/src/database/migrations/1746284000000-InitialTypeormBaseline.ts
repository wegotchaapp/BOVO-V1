import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Establishes the TypeORM-managed schema for a new deployment.
 *
 * Existing fully provisioned deployments are intentionally left untouched so
 * their historical migration sequence can be recorded without rebuilding data.
 */
export class InitialTypeormBaseline1746284000000 implements MigrationInterface {
  name = 'InitialTypeormBaseline1746284000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    const requiredCoreTables = ['users', 'profiles', 'trips', 'bookings'];
    const existingCoreTables: string[] = [];

    for (const tableName of requiredCoreTables) {
      if (await queryRunner.hasTable(tableName)) {
        existingCoreTables.push(tableName);
      }
    }

    if (existingCoreTables.length === requiredCoreTables.length) {
      return;
    }

    if (existingCoreTables.length > 0) {
      throw new Error(
        `Cannot apply the initial TypeORM baseline to a partially provisioned schema. Found: ${existingCoreTables.join(', ')}`,
      );
    }

    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'premium_user', 'driver', 'ts_agent', 'admin')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_subscription_tier_enum" AS ENUM('free', 'premium')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "phone" character varying(20), "password_hash" character varying, "name" character varying NOT NULL, "dob" date, "role" "public"."users_role_enum" NOT NULL DEFAULT 'user', "selected_role" character varying(10) NOT NULL DEFAULT 'rider', "is_email_verified" boolean NOT NULL DEFAULT false, "is_phone_verified" boolean NOT NULL DEFAULT false, "is_verified" boolean NOT NULL DEFAULT false, "stripe_customer_id" character varying(100), "stripe_subscription_id" character varying(100), "stripe_account_id" character varying(100), "stripe_charges_enabled" boolean NOT NULL DEFAULT false, "stripe_payouts_enabled" boolean NOT NULL DEFAULT false, "stripe_details_submitted" boolean, "is_founding_member" boolean NOT NULL DEFAULT false, "ytd_earnings" numeric(10,2) NOT NULL DEFAULT '0', "lifetime_earnings" numeric(10,2) NOT NULL DEFAULT '0', "last_payout_at" TIMESTAMP WITH TIME ZONE, "subscription_tier" "public"."users_subscription_tier_enum" NOT NULL DEFAULT 'free', "referral_code" character varying(50), "referred_by" uuid, "avg_rating" numeric(3,2) DEFAULT '0', "total_ratings" integer NOT NULL DEFAULT '0', "total_trips" integer NOT NULL DEFAULT '0', "display_name" character varying(100), "gender" character varying(20), "rider_conversation_style" character varying(30), "rider_music_preference" character varying(30), "rider_smoking_preference" character varying(30), "rider_pet_preference" character varying(30), "background_check_status" character varying NOT NULL DEFAULT 'not_started', "is_suspended" boolean NOT NULL DEFAULT false, "is_banned" boolean NOT NULL DEFAULT false, "is_under_review" boolean NOT NULL DEFAULT false, "safe_word" character varying(32), "biometric_consent_given" boolean NOT NULL DEFAULT false, "biometric_consent_at" TIMESTAMP WITH TIME ZONE, "ytd_gross_volume" numeric(10,2) NOT NULL DEFAULT '0', "w9_on_file" boolean NOT NULL DEFAULT false, "w9_submitted_at" TIMESTAMP WITH TIME ZONE, "tax_blocked" boolean NOT NULL DEFAULT false, "tax_notification_5k_sent" boolean NOT NULL DEFAULT false, "ride_preferences" jsonb NOT NULL DEFAULT '{}', "trial_ended_at" TIMESTAMP WITH TIME ZONE, "subscription_expires_at" TIMESTAMP WITH TIME ZONE, "subscription_apple_original_transaction_id" character varying(255), "onboarded" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token" character varying NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "is_revoked" boolean NOT NULL DEFAULT false, "revoked_reason" character varying(100), "device_info" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_4542dd2f38a61354a040ba9fd57" UNIQUE ("token"), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."verifications_status_enum" AS ENUM('pending', 'verified', 'failed', 'requires_input', 'expired')`,
    );
    await queryRunner.query(
      `CREATE TABLE "verifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "provider" character varying NOT NULL DEFAULT 'stripe_identity', "provider_reference" character varying NOT NULL, "status" "public"."verifications_status_enum" NOT NULL DEFAULT 'pending', "verified_name" character varying(255), "verified_dob" date, "face_image_reference" character varying(255), "completed_at" TIMESTAMP WITH TIME ZONE, "expires_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_80f15dbd5c398d8ae9a70bcf615" UNIQUE ("provider_reference"), CONSTRAINT "PK_2127ad1b143cf012280390b01d1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."background_checks_status_enum" AS ENUM('pending', 'clear', 'consider', 'adverse')`,
    );
    await queryRunner.query(
      `CREATE TABLE "background_checks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "checkr_candidate_id" character varying NOT NULL, "status" "public"."background_checks_status_enum" NOT NULL DEFAULT 'pending', "checkr_package" character varying(100), "invitation_url" character varying(255), "ssn_hash_suffix" character varying(8), "fcra_disclosure_accepted_at" TIMESTAMP WITH TIME ZONE, "user_authorization_accepted_at" TIMESTAMP WITH TIME ZONE, "initiated_at" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, "pre_adverse_notice_sent_at" TIMESTAMP WITH TIME ZONE, "final_adverse_notice_sent_at" TIMESTAMP WITH TIME ZONE, "adverse_action_deadline" TIMESTAMP WITH TIME ZONE, "annual_recheck_scheduled" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_628b0f3a98bd47bb6b60006343e" UNIQUE ("checkr_candidate_id"), CONSTRAINT "PK_0db3759452d2be6d0e0027abe76" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "display_name" character varying NOT NULL, "bio" character varying(500), "languages" text array NOT NULL DEFAULT '{}', "profile_photo_url" character varying(500), "avg_rating" numeric(3,2), "total_trips" integer NOT NULL DEFAULT '0', "badges" text array NOT NULL DEFAULT '{}', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_9e432b7df0d182f8d292902d1a2" UNIQUE ("user_id"), CONSTRAINT "PK_8e520eb4da7dc01d0e190447c8e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."vehicles_category_enum" AS ENUM('compact', 'standard_sedan', 'suv_crossover', 'large_suv', 'truck', 'van')`,
    );
    await queryRunner.query(
      `CREATE TABLE "vehicles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "driver_id" uuid NOT NULL, "make" character varying NOT NULL, "model" character varying NOT NULL, "year" integer NOT NULL, "color" character varying NOT NULL, "license_plate" character varying NOT NULL, "state" character varying(2) NOT NULL, "vin" character varying(17), "category" "public"."vehicles_category_enum" NOT NULL, "max_luggage_class" character varying(20) NOT NULL DEFAULT 'medium', "max_passengers" integer NOT NULL DEFAULT '4', "is_verified" boolean NOT NULL DEFAULT false, "photo_urls" jsonb NOT NULL DEFAULT '{}', "documents" jsonb NOT NULL DEFAULT '{}', "category_assignment_reason" text, "category_manually_overridden" boolean NOT NULL DEFAULT false, "insurance_verified" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_18d8646b59304dce4af3a9e35b6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "trip_replies" ("id" character varying(32) NOT NULL, "trip_id" character varying(32) NOT NULL, "user_id" character varying(32) NOT NULL, "text" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8bf24287a1226cab7249b3ce98f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4fcb0e392d03f3e30e4cb29f27" ON "trip_replies" ("trip_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "trip_reply_reads" ("id" character varying(32) NOT NULL, "reply_id" character varying(32) NOT NULL, "user_id" character varying(32) NOT NULL, "read_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_755ab66e94c50988983b4b52a07" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d611911920d77611c563055d47" ON "trip_reply_reads" ("reply_id", "user_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."trips_status_enum" AS ENUM('posted', 'booked', 'confirmed', 'en_route', 'in_progress', 'completed', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "trips" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "driver_id" uuid NOT NULL, "vehicle_id" uuid NOT NULL, "origin_metro" character varying NOT NULL, "origin_pickup_zones" text array NOT NULL, "dest_metro" character varying NOT NULL, "dest_dropoff_zones" text array NOT NULL, "departure_date" date NOT NULL, "departure_time" TIME NOT NULL, "departure_time_window" character varying NOT NULL DEFAULT '+/- 30 min', "seats_total" integer NOT NULL DEFAULT '1', "seats_available" integer NOT NULL, "per_seat_price" numeric(8,2) NOT NULL, "status" "public"."trips_status_enum" NOT NULL DEFAULT 'posted', "notes" character varying(300), "distance_miles" numeric(10,2), "irs_rate_used" numeric(4,2), "total_occupants_calc" integer, "price_calculation_inputs" jsonb, "luggage_capacity" character varying(20) NOT NULL DEFAULT 'small', "mapbox_route_polyline" character varying(2000), "expected_arrival_time" TIMESTAMP WITH TIME ZONE, "origin_lat" numeric(6,3), "origin_lng" numeric(6,3), "dest_lat" numeric(6,3), "dest_lng" numeric(6,3), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_f71c231dee9c05a9522f9e840f5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "trip_preferences" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" uuid NOT NULL, "conversation" character varying NOT NULL DEFAULT 'friendly', "music" character varying NOT NULL DEFAULT 'background', "smoking" character varying NOT NULL DEFAULT 'never', "pets" character varying NOT NULL DEFAULT 'with_approval', "women_only" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_9b42ad2d1a9ae23341c47bfe532" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "trip_zones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" uuid NOT NULL, "zone_type" character varying NOT NULL, "zone_name" character varying NOT NULL, "polygon_wkt" text, CONSTRAINT "PK_a7c6da70717fc5f152fa99c3cc2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_status_enum" AS ENUM('pending', 'confirmed', 'en_route', 'completed', 'cancelled', 'declined')`,
    );
    await queryRunner.query(
      `CREATE TABLE "bookings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" uuid NOT NULL, "rider_id" uuid NOT NULL, "seats" integer NOT NULL, "total_price" numeric(8,2) NOT NULL, "insurance_opted_in" boolean NOT NULL DEFAULT false, "luggage_insurance_opted_in" boolean NOT NULL DEFAULT false, "status" "public"."bookings_status_enum" NOT NULL DEFAULT 'pending', "payment_intent_id" character varying(255), "share_token" character varying(32), "last_known_location" text, "last_ping_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "booking_luggage" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "booking_id" uuid NOT NULL, "type" character varying(20) NOT NULL, "quantity" integer NOT NULL, CONSTRAINT "PK_7238b25b585f54e280b958fcc24" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "booking_status_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "booking_id" uuid NOT NULL, "from_status" character varying NOT NULL, "to_status" character varying NOT NULL, "changed_by" uuid NOT NULL, "reason" character varying(500), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_34ac45a89e6149de12d0113c86c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "booking_id" uuid NOT NULL, "stripe_payment_intent_id" character varying NOT NULL, "amount" numeric(10,2) NOT NULL, "currency" character varying NOT NULL, "status" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "payouts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "driver_id" uuid NOT NULL, "stripe_transfer_id" character varying NOT NULL, "amount" numeric(10,2) NOT NULL, "currency" character varying NOT NULL, "status" character varying NOT NULL, "dispatched_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_76855dc4f0a6c18c72eea302e87" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "refunds" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "payment_id" uuid NOT NULL, "amount" numeric(10,2) NOT NULL, "reason" character varying NOT NULL, "stripe_refund_id" character varying NOT NULL, "status" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5106efb01eeda7e49a78b869738" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "insurance_policies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "booking_id" uuid NOT NULL, "policy_number" character varying(255), "mga_reference" character varying(255), "activated_at" TIMESTAMP WITH TIME ZONE, "expires_at" TIMESTAMP WITH TIME ZONE, "is_active" boolean NOT NULL DEFAULT false, "mga_remitted_cents" integer NOT NULL DEFAULT '0', "mga_remitted_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_69af1d3a19277d1a822c9b13bf1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "trip_pings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "booking_id" uuid NOT NULL, "location" text, "accuracy" double precision, "speed" double precision, "battery_level" integer, "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6ddc2ce0d49651abd65235d7507" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sos_events_trigger_type_enum" AS ENUM('button', 'volume_sequence', 'unsafe_feeling')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sos_events_status_enum" AS ENUM('active', 'false_alarm', 'dispatched', 'resolved')`,
    );
    await queryRunner.query(
      `CREATE TABLE "sos_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "booking_id" uuid, "trigger_type" "public"."sos_events_trigger_type_enum" NOT NULL, "status" "public"."sos_events_status_enum" NOT NULL DEFAULT 'active', "latitude" double precision NOT NULL, "longitude" double precision NOT NULL, "noonlight_alarm_id" character varying(100), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a056474ff3a26241eaeff3575c2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reports_category_enum" AS ENUM('sexual_misconduct', 'weapons_threat', 'criminal_allegations', 'unsafe_driving', 'harassment', 'discrimination', 'vehicle_condition', 'no_show', 'route_fraud', 'minor_dispute')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reports_severity_enum" AS ENUM('P0', 'P1', 'P2')`,
    );
    await queryRunner.query(
      `CREATE TABLE "reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reporter_id" uuid NOT NULL, "reported_user_id" uuid NOT NULL, "booking_id" uuid, "category" "public"."reports_category_enum" NOT NULL, "description" character varying(1000) NOT NULL, "evidence_photo_url" character varying(255), "severity" "public"."reports_severity_enum" NOT NULL, "sla_deadline" TIMESTAMP WITH TIME ZONE NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "resolved_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d9013193989303580053c0b5ef6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."moderation_actions_action_type_enum" AS ENUM('dismiss', 'warning', 'temp_suspension', 'permanent_ban', 'law_enforcement_referral')`,
    );
    await queryRunner.query(
      `CREATE TABLE "moderation_actions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "report_id" uuid NOT NULL, "taken_by" uuid NOT NULL, "action_type" "public"."moderation_actions_action_type_enum" NOT NULL, "reason" character varying(500) NOT NULL, "evidence_refs" text array NOT NULL DEFAULT '{}', "suspension_days" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d259906fb4d2a5ef718f1f66e35" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "suspensions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ends_at" TIMESTAMP WITH TIME ZONE NOT NULL, "reason" character varying(500), "moderation_action_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c3df8984cf2c9a5726c11644474" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "incidents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "booking_id" uuid, "severity" character varying NOT NULL DEFAULT 'P1', "description" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'open', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ccb34c01719889017e2246469f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "deviation_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "booking_id" uuid NOT NULL, "actual_location" text, "expected_location" text, "deviation_distance_miles" double precision NOT NULL, "time_off_route_seconds" integer, "status" character varying NOT NULL DEFAULT 'pending', "responded_at" TIMESTAMP WITH TIME ZONE, "response" text, "ts_paged_at" TIMESTAMP WITH TIME ZONE, "contacts_notified_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_422ef5c086f5c0562bd5f577688" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."appeals_status_enum" AS ENUM('pending', 'under_review', 'granted', 'denied')`,
    );
    await queryRunner.query(
      `CREATE TABLE "appeals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "action_id" uuid NOT NULL, "reason" character varying(2000) NOT NULL, "evidence_url" character varying(255), "status" "public"."appeals_status_enum" NOT NULL DEFAULT 'pending', "reviewed_by" uuid, "decision" character varying(500), "reviewed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ebd2050a02aa78081b5346152bc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "booking_id" uuid, "participant_ids" uuid array NOT NULL, "title" character varying(200), "type" character varying(20) NOT NULL DEFAULT 'booking', "last_message" character varying(500), "last_message_sender_id" uuid, "last_message_at" TIMESTAMP WITH TIME ZONE, "unread_count_driver" integer NOT NULL DEFAULT '0', "unread_count_rider" integer NOT NULL DEFAULT '0', "expires_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ff117d9f57807c4f2e3034a39f3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversation_id" uuid NOT NULL, "sender_id" uuid NOT NULL, "content" character varying(2000) NOT NULL, "is_flagged" boolean NOT NULL DEFAULT false, "flag_category" character varying(50), "requires_review" boolean NOT NULL DEFAULT false, "is_read" boolean NOT NULL DEFAULT false, "read_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_40c55ee0e571e268b0d3cd37d10" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9e5fc47ecb06d4d7b84633b171" ON "chat_messages" ("sender_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bdfd8165e694fe9d3ce4140c87" ON "chat_messages" ("conversation_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_blocks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "blocker_id" uuid NOT NULL, "blocked_user_id" uuid NOT NULL, "booking_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_701c8d3d2bb8eb7bc492291ee1c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_1ced1324de7c5b9ee6558e2dc3" ON "chat_blocks" ("blocker_id", "blocked_user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "call_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "booking_id" uuid NOT NULL, "caller_id" uuid NOT NULL, "receiver_id" uuid NOT NULL, "twilio_call_sid" character varying(255) NOT NULL, "duration_seconds" integer, "status" character varying(50), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ca3ee401ef0cd1a9cebf8f494b0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "booking_id" uuid NOT NULL, "participant_ids" text array NOT NULL, "last_message" character varying(500), "last_message_at" TIMESTAMP WITH TIME ZONE, "unread_count" integer NOT NULL DEFAULT '0', "expires_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_9bc96e73e2a6aba08e0473844ed" UNIQUE ("booking_id"), CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversation_id" uuid NOT NULL, "sender_id" uuid NOT NULL, "content" character varying(2000) NOT NULL, "is_flagged" boolean NOT NULL DEFAULT false, "flag_category" character varying(50), "is_read" boolean NOT NULL DEFAULT false, "read_at" TIMESTAMP WITH TIME ZONE, "requires_review" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "notification_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "channel" character varying NOT NULL, "category" character varying NOT NULL, "title" character varying(200) NOT NULL, "body" character varying(1000) NOT NULL, "data" jsonb, "is_read" boolean NOT NULL DEFAULT false, "delivery_status" character varying(20), "delivered_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6f761cfbbd064e0f326960877d6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "notification_preferences" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "preferences" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_64c90edc7310c6be7c10c96f675" UNIQUE ("user_id"), CONSTRAINT "PK_e94e2b543f2f218ee68e4f4fad2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "emergency_contacts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "name" character varying NOT NULL, "phone" character varying NOT NULL, "email" character varying(255), "relationship" character varying NOT NULL, "opted_in" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_8be191845b6fca1c4e5ba5bd7d1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "devices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "expo_push_token" character varying NOT NULL, "device_id" character varying(100), "platform" character varying(20), "timezone" character varying(50), "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b1514758245c12daf43486dd1f0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "saved_searches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "name" character varying(255), "origin_metro" character varying NOT NULL, "dest_metro" character varying NOT NULL, "travel_date" date NOT NULL, "seats_needed" integer NOT NULL DEFAULT '1', "conversation_style" character varying(50), "music_preference" character varying(50), "smoking_preference" character varying(50), "pet_preference" character varying(50), "women_only" boolean NOT NULL DEFAULT false, "strict_filters" boolean NOT NULL DEFAULT false, "sort_by" character varying NOT NULL DEFAULT 'best_match', "usage_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d9a53c71ccc5cf66dcdc5b33dfe" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "driver_trips" ("id" character varying(32) NOT NULL, "driver_id" character varying(32) NOT NULL, "from_city" text NOT NULL, "to_city" text NOT NULL, "miles" integer NOT NULL, "seats_booked" integer NOT NULL, "gross_amount" numeric(10,2) NOT NULL, "platform_fee" numeric(10,2) NOT NULL, "net_amount" numeric(10,2) NOT NULL, "completed_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8b43e0b7140f0e703d6e8a7a325" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c3984cebf2c7331581e7470ee2" ON "driver_trips" ("driver_id", "completed_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "support_agents" ("id" character varying(32) NOT NULL, "name" text NOT NULL, "email" text NOT NULL, "password_hash" text NOT NULL, "role" text NOT NULL DEFAULT 'agent', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_c847d6a940a4ef3277b619a427c" UNIQUE ("email"), CONSTRAINT "PK_9430cef6c3ac730c30cc3022129" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "support_tickets" ("id" character varying(32) NOT NULL, "subject" text NOT NULL, "status" text NOT NULL DEFAULT 'open', "priority" text NOT NULL DEFAULT 'normal', "requester_name" text NOT NULL, "requester_role" text NOT NULL, "requester_email" text, "requester_phone" text, "requester_avatar_url" text, "trip_id" character varying(64), "trip_origin" text, "trip_destination" text, "trip_departure_at" TIMESTAMP WITH TIME ZONE, "trip_driver_name" text, "trip_price_cents" integer, "assignee_id" character varying(32), "first_agent_response_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_942e8d8f5df86100471d2324643" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "support_ticket_messages" ("id" character varying(32) NOT NULL, "ticket_id" character varying(32) NOT NULL, "body" text NOT NULL, "author_type" text NOT NULL, "author_name" text NOT NULL, "author_agent_id" character varying(32), "internal" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c3e561853b6b303f74fde5a3e1f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "support_sessions" ("id" character varying(64) NOT NULL, "agent_id" character varying(32) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_3f42d6581b7be63ce898b1d0f65" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_sessions" ("id" character varying(64) NOT NULL, "user_id" character varying(32) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_e93e031a5fed190d4789b6bfd83" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "trip_groups" ("id" character varying(32) NOT NULL, "trip_id" character varying(32) NOT NULL, "pickup_hub_id" text, "pickup_locked" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_856b7d451f985cc6aeb5d7aa516" UNIQUE ("trip_id"), CONSTRAINT "PK_7435f37ca2c5100b96db855a5d0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "trip_group_members" ("id" character varying(32) NOT NULL, "group_id" character varying(32) NOT NULL, "user_id" character varying(32) NOT NULL, "role" character varying(12) NOT NULL, "joined_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_ad36ae34969140d7a35539e8b9e" UNIQUE ("group_id", "user_id"), CONSTRAINT "PK_65d4b74c834e808a6d8b197276d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0411da2d6272ac71e7c20537d2" ON "trip_group_members" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "trip_group_messages" ("id" character varying(32) NOT NULL, "group_id" character varying(32) NOT NULL, "sender_id" character varying(32), "text" text NOT NULL, "is_system" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b8b82ada365e446b71845f4a66c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_05728a2db44be658fb6fb1dfca" ON "trip_group_messages" ("group_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "trip_group_pickup_approvals" ("id" character varying(32) NOT NULL, "group_id" character varying(32) NOT NULL, "user_id" character varying(32) NOT NULL, "hub_id" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_a0a90ad6a727e955169e61ac636" UNIQUE ("group_id", "user_id"), CONSTRAINT "PK_4a4806bb3abcfc8666773cd74c6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "compliance_logs" ("id" character varying(32) NOT NULL, "user_id" character varying(32) NOT NULL, "rule" character varying NOT NULL, "action" character varying NOT NULL, "details" character varying(500), "triggered_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0f10ef25e2593d957c2a38873c0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "mobile_users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "email" character varying NOT NULL, "phone" character varying(32), "password_hash" character varying NOT NULL, "role" character varying(12), "rating" numeric(3,2) NOT NULL DEFAULT '5', "trips" integer NOT NULL DEFAULT '0', "is_verified" boolean NOT NULL DEFAULT false, "onboarded" boolean NOT NULL DEFAULT false, "is_founding_member" boolean NOT NULL DEFAULT false, "stripe_customer_id" character varying(100), "stripe_subscription_id" character varying(100), "subscription_status" character varying(30), "trial_ends_at" TIMESTAMP WITH TIME ZONE, "bio" text, "languages" text, "emergency_name" character varying(120), "emergency_phone" character varying(32), "photo_url" text, "ride_preferences" text, "notification_settings" text, "oauth_provider" character varying(20), "oauth_subject" character varying(128), "deletion_requested_at" TIMESTAMP WITH TIME ZONE, "checkr_candidate_id" character varying(64), "background_check_status" character varying(24) NOT NULL DEFAULT 'not_started', "ssn_verified" boolean NOT NULL DEFAULT false, "ssn_last4" character varying(4), "background_check_completed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ec56e7a9707cbf9c9809e0cd107" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c5fd69ff3b140b2c3ad83861b7" ON "mobile_users" ("email") `,
    );
    await queryRunner.query(
      `CREATE TABLE "mobile_vehicles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "make" character varying(60) NOT NULL, "model" character varying(60) NOT NULL, "year" integer NOT NULL, "color" character varying(40) NOT NULL, "license_plate" character varying(20) NOT NULL, "state" character varying(2) NOT NULL DEFAULT 'TX', "vin" character varying(17), "seat_count" integer, "door_count" integer, "photo_front_url" text, "photo_rear_url" text, "photo_left_url" text, "photo_right_url" text, "photo_interior_url" text, "insurance_doc_url" text, "insurance_expires_at" date, "registration_doc_url" text, "registration_expires_at" date, "verification_status" character varying(16) NOT NULL DEFAULT 'incomplete', "verification_note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e95bde74ddc025bee65e66d53ad" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_aa52e3b0d47cd8ae7a6fd11cd1" ON "mobile_vehicles" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "mobile_ratings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "booking_id" uuid NOT NULL, "rater_id" uuid NOT NULL, "ratee_id" uuid NOT NULL, "score" integer NOT NULL, "comment" text, "tags" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_f1e8c13db2fc9c41af9017a0ecf" UNIQUE ("booking_id", "rater_id"), CONSTRAINT "PK_ba76d87c78df7173ff84fc55a79" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_46a824d501e39171b7dca87f22" ON "mobile_ratings" ("booking_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c4e61b625b7cd0fd7fc167ede8" ON "mobile_ratings" ("rater_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5912caa944bd089b9183fddd6d" ON "mobile_ratings" ("ratee_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "mobile_sessions" ("token" character varying(64) NOT NULL, "user_id" uuid NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_96977c29b2812c81b88f7e17bdf" PRIMARY KEY ("token"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ac467ca2abde2525f2c3d7bb68" ON "mobile_sessions" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "mobile_trips" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "driver_id" uuid NOT NULL, "from_city" text NOT NULL, "to_city" text NOT NULL, "departure_at" TIMESTAMP WITH TIME ZONE NOT NULL, "seats_available" integer NOT NULL, "luggage_space" integer NOT NULL DEFAULT '0', "price_per_seat" numeric(10,2) NOT NULL, "note" text NOT NULL DEFAULT '', "car" text, "pref_smoking" boolean NOT NULL DEFAULT false, "pref_pets" boolean NOT NULL DEFAULT false, "pref_music" boolean NOT NULL DEFAULT true, "pref_ac" boolean NOT NULL DEFAULT true, "status" character varying(12) NOT NULL DEFAULT 'active', "start_video_url" text, "started_at" TIMESTAMP WITH TIME ZONE, "route_polyline" text, "route_fetched_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f59b34bfdde5c40294312fe3dac" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ef2ca3281d3952b8f8ffdb8827" ON "mobile_trips" ("driver_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "mobile_trip_replies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" uuid NOT NULL, "user_id" uuid NOT NULL, "text" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b6c0eb0ae388ef5b7488377d81a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7fffaef9d3d5f823d9e37cd85f" ON "mobile_trip_replies" ("trip_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "mobile_trip_reply_reads" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "trip_id" uuid NOT NULL, "last_read_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_60546325f3da565181cf2e6d70a" UNIQUE ("user_id", "trip_id"), CONSTRAINT "PK_c085b1d09f42db331f40c1fa6d4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "mobile_bookings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" uuid NOT NULL, "rider_id" uuid NOT NULL, "seats" integer NOT NULL, "price_per_seat" numeric(10,2) NOT NULL, "service_fee" numeric(10,2) NOT NULL, "total_amount" numeric(10,2) NOT NULL, "luggage_tier" character varying(12) NOT NULL DEFAULT 'carry_on', "luggage_surcharge" numeric(10,2) NOT NULL DEFAULT '0', "insurance_opted_in" boolean NOT NULL DEFAULT true, "insurance_premium" numeric(10,2) NOT NULL DEFAULT '0', "luggage_insurance_opted_in" boolean NOT NULL DEFAULT false, "luggage_insurance_premium" numeric(10,2) NOT NULL DEFAULT '0', "payment_method" character varying(12) NOT NULL, "status" character varying(12) NOT NULL DEFAULT 'pending', "payment_intent_id" character varying(64), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "completed_at" TIMESTAMP WITH TIME ZONE, "pickup_miles" integer, "dropoff_miles" integer, "miles_travelled" integer, "picked_up_at" TIMESTAMP WITH TIME ZONE, "dropped_off_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_81fd0b163f865ad864e73fbb0b3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e5006976e22ac8835eef2ab139" ON "mobile_bookings" ("trip_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0faf3c1c59a0328090b9b4eb90" ON "mobile_bookings" ("rider_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "mobile_odometer_readings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" uuid NOT NULL, "booking_id" uuid NOT NULL, "sailor_id" uuid NOT NULL, "voyager_id" uuid NOT NULL, "kind" character varying(8) NOT NULL, "miles" integer NOT NULL, "photo_url" text NOT NULL, "latitude" numeric(9,6), "longitude" numeric(9,6), "recorded_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_b08718223d47774d8c89fb06df0" UNIQUE ("booking_id", "kind"), CONSTRAINT "PK_a0e7e95bf4336158893b492d233" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c6a85087def94f80315da7197f" ON "mobile_odometer_readings" ("trip_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_325127acb55ce476911aa8db43" ON "mobile_odometer_readings" ("booking_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5747b47835a4fa89a8df10d207" ON "mobile_odometer_readings" ("trip_id", "recorded_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "mobile_trip_groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" uuid NOT NULL, "pickup_hub_id" text, "pickup_locked" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_cd0ccdf646f42dd23c488aefdeb" UNIQUE ("trip_id"), CONSTRAINT "PK_3cbe717a45ae72f53c601ddd08b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "mobile_trip_group_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "group_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" character varying(12) NOT NULL, "joined_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_c0558873b8dc85494a9b80c7ad5" UNIQUE ("group_id", "user_id"), CONSTRAINT "PK_b03362e96ffe291625300b213ee" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6dabb4ae5be0b45cf450c9441d" ON "mobile_trip_group_members" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "mobile_trip_group_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "group_id" uuid NOT NULL, "sender_id" uuid, "text" text NOT NULL, "is_system" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_25c41b62562ea34cb8f17c27627" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_273752b7914db4c1038841078b" ON "mobile_trip_group_messages" ("group_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "mobile_driver_trips" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "driver_id" uuid NOT NULL, "from_city" text NOT NULL, "to_city" text NOT NULL, "miles" integer NOT NULL, "seats_booked" integer NOT NULL, "gross_amount" numeric(10,2) NOT NULL, "platform_fee" numeric(10,2) NOT NULL, "net_amount" numeric(10,2) NOT NULL, "completed_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a56767e328d291e725c47eaee19" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b65815f487f0abba4f9cd22ee8" ON "mobile_driver_trips" ("driver_id", "completed_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "mobile_conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_low_id" uuid NOT NULL, "user_high_id" uuid NOT NULL, "last_message" text, "last_message_at" TIMESTAMP WITH TIME ZONE, "trip_label" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_db4029d8b006a32133aa3884991" UNIQUE ("user_low_id", "user_high_id"), CONSTRAINT "PK_1c10bf0bde5ea3a81873e105c8d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8a57b83ffffaa22ae67f0ea0b9" ON "mobile_conversations" ("user_low_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_501bc4ae1b20eb4b151d6c1cc6" ON "mobile_conversations" ("user_high_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "mobile_direct_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversation_id" uuid NOT NULL, "sender_id" uuid NOT NULL, "text" text NOT NULL, "read_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_93ffc784fbb5d898eef5f586970" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4fb2e506d745ffff52dd0a897c" ON "mobile_direct_messages" ("conversation_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_800eadcd518482307826b592f3" ON "mobile_direct_messages" ("sender_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "mobile_live_locations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" character varying(12) NOT NULL, "latitude" double precision NOT NULL, "longitude" double precision NOT NULL, "heading" double precision, "speed" double precision, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_6501be8b79ac59ff8310887841d" UNIQUE ("trip_id", "user_id"), CONSTRAINT "PK_316c5dd91437138608b6c8ba16a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ac856299ba609bcdc595303930" ON "mobile_live_locations" ("trip_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_91e0b596851cb63854f345c998" ON "mobile_live_locations" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "mobile_sos_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "trip_id" uuid, "status" character varying(20) NOT NULL DEFAULT 'active', "latitude" double precision, "longitude" double precision, "noonlight_alarm_id" character varying(100), "contact_notified" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1a15f1b81ea7ebd32204519accb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ffbcfa0f917cef22f9803cad5e" ON "mobile_sos_events" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c3d51c9476c127e6075d5c2c52" ON "mobile_sos_events" ("trip_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5872ec84c269e60a6819762b23" ON "mobile_sos_events" ("noonlight_alarm_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "mobile_deviation_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" uuid NOT NULL, "user_id" uuid NOT NULL, "latitude" double precision NOT NULL, "longitude" double precision NOT NULL, "distance_miles" double precision NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f5084c1d70060a05ddea8a53f4e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a7a73da8f502565812cd0fdd6d" ON "mobile_deviation_events" ("trip_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_aee0418f8c2655aea00543f579" ON "mobile_deviation_events" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "verifications" ADD CONSTRAINT "FK_e9a134af366776c651168916616" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "background_checks" ADD CONSTRAINT "FK_8187384dd9bbee387242f06ee2e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD CONSTRAINT "FK_9e432b7df0d182f8d292902d1a2" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicles" ADD CONSTRAINT "FK_9c2e0a8772c9e43b32f57bfcfcc" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" ADD CONSTRAINT "FK_44d36110fb38f45c2f15c946ddb" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" ADD CONSTRAINT "FK_ab4b806373c2ee43946679d572e" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_preferences" ADD CONSTRAINT "FK_c2ffcfd3cc2af617ba71d13c401" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_zones" ADD CONSTRAINT "FK_21ccda3a0ee5d7d97507ed92a5c" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_45fa98a28a6944e39d8a5754bd1" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_ab08e50599da93ee316fcc884a1" FOREIGN KEY ("rider_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_luggage" ADD CONSTRAINT "FK_d702b830b9d766b975e4a9e7cfd" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_status_log" ADD CONSTRAINT "FK_54c667e5c83b454cf55efa96120" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_e86edf76dc2424f123b9023a2b2" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payouts" ADD CONSTRAINT "FK_b652e954a4dbe464ee2a8b61864" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refunds" ADD CONSTRAINT "FK_7f48aa5d56c42aeb495db016683" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_policies" ADD CONSTRAINT "FK_e5aa8b079f553cc94e5973e9184" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_pings" ADD CONSTRAINT "FK_20579851e5c09f490ef68e4d02b" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sos_events" ADD CONSTRAINT "FK_91c987bfd526c86b9cca6817049" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sos_events" ADD CONSTRAINT "FK_5603765c8fbf5260223b0492f56" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_9459b9bf907a3807ef7143d2ead" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_a9197bd0a7e06bb92648d9efed2" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_25f4dde2f56ab000aa8db7b2495" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "moderation_actions" ADD CONSTRAINT "FK_8dd6d136a903e4f003d61123c76" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "moderation_actions" ADD CONSTRAINT "FK_1e8fa48bfa1c578073553eb33d5" FOREIGN KEY ("taken_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "suspensions" ADD CONSTRAINT "FK_36215c5979c97e95daa61224bb5" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ADD CONSTRAINT "FK_66f302514887c0a1202dc48c239" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "deviation_events" ADD CONSTRAINT "FK_396e28279350be63aa4c254a613" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appeals" ADD CONSTRAINT "FK_dc35f7b9ece670abe7ff66932c4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appeals" ADD CONSTRAINT "FK_1e833924836e28203d7585886a2" FOREIGN KEY ("action_id") REFERENCES "moderation_actions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appeals" ADD CONSTRAINT "FK_77e8a00810d3a560ec75980fa9e" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_conversations" ADD CONSTRAINT "FK_74e59c3afd8a7e56d170e5a59fa" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_3d623662d4ee1219b23cf61e649" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_blocks" ADD CONSTRAINT "FK_d417c882b341f8e817d4d507988" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_blocks" ADD CONSTRAINT "FK_8d9966d7fa07ea9170642aba7ff" FOREIGN KEY ("blocked_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_blocks" ADD CONSTRAINT "FK_fe84b5fe7a21b872397a78cc8e2" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "call_records" ADD CONSTRAINT "FK_b1ae588d2d115509c06905274c4" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "call_records" ADD CONSTRAINT "FK_dd6073dc08ab4062d337916e346" FOREIGN KEY ("caller_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "call_records" ADD CONSTRAINT "FK_093ac5c1989fc7016057c810897" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_9bc96e73e2a6aba08e0473844ed" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "emergency_contacts" ADD CONSTRAINT "FK_1cf39ea46db44d95b34d58d3605" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "saved_searches" ADD CONSTRAINT "FK_8f01d13ac8e7b451d244674274f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Baselines are irreversible: reverting this migration must never drop
    // a deployment's live schema. The generated rollback below is retained
    // only for TypeORM's generated migration record and is intentionally
    // unreachable.
    return;

    await queryRunner.query(
      `ALTER TABLE "saved_searches" DROP CONSTRAINT "FK_8f01d13ac8e7b451d244674274f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "emergency_contacts" DROP CONSTRAINT "FK_1cf39ea46db44d95b34d58d3605"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "FK_9bc96e73e2a6aba08e0473844ed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "call_records" DROP CONSTRAINT "FK_093ac5c1989fc7016057c810897"`,
    );
    await queryRunner.query(
      `ALTER TABLE "call_records" DROP CONSTRAINT "FK_dd6073dc08ab4062d337916e346"`,
    );
    await queryRunner.query(
      `ALTER TABLE "call_records" DROP CONSTRAINT "FK_b1ae588d2d115509c06905274c4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_blocks" DROP CONSTRAINT "FK_fe84b5fe7a21b872397a78cc8e2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_blocks" DROP CONSTRAINT "FK_8d9966d7fa07ea9170642aba7ff"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_blocks" DROP CONSTRAINT "FK_d417c882b341f8e817d4d507988"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_3d623662d4ee1219b23cf61e649"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_conversations" DROP CONSTRAINT "FK_74e59c3afd8a7e56d170e5a59fa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "appeals" DROP CONSTRAINT "FK_77e8a00810d3a560ec75980fa9e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "appeals" DROP CONSTRAINT "FK_1e833924836e28203d7585886a2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "appeals" DROP CONSTRAINT "FK_dc35f7b9ece670abe7ff66932c4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deviation_events" DROP CONSTRAINT "FK_396e28279350be63aa4c254a613"`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" DROP CONSTRAINT "FK_66f302514887c0a1202dc48c239"`,
    );
    await queryRunner.query(
      `ALTER TABLE "suspensions" DROP CONSTRAINT "FK_36215c5979c97e95daa61224bb5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "moderation_actions" DROP CONSTRAINT "FK_1e8fa48bfa1c578073553eb33d5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "moderation_actions" DROP CONSTRAINT "FK_8dd6d136a903e4f003d61123c76"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_25f4dde2f56ab000aa8db7b2495"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_a9197bd0a7e06bb92648d9efed2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_9459b9bf907a3807ef7143d2ead"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sos_events" DROP CONSTRAINT "FK_5603765c8fbf5260223b0492f56"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sos_events" DROP CONSTRAINT "FK_91c987bfd526c86b9cca6817049"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_pings" DROP CONSTRAINT "FK_20579851e5c09f490ef68e4d02b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_policies" DROP CONSTRAINT "FK_e5aa8b079f553cc94e5973e9184"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refunds" DROP CONSTRAINT "FK_7f48aa5d56c42aeb495db016683"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payouts" DROP CONSTRAINT "FK_b652e954a4dbe464ee2a8b61864"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_e86edf76dc2424f123b9023a2b2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_status_log" DROP CONSTRAINT "FK_54c667e5c83b454cf55efa96120"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_luggage" DROP CONSTRAINT "FK_d702b830b9d766b975e4a9e7cfd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_ab08e50599da93ee316fcc884a1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_45fa98a28a6944e39d8a5754bd1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_zones" DROP CONSTRAINT "FK_21ccda3a0ee5d7d97507ed92a5c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_preferences" DROP CONSTRAINT "FK_c2ffcfd3cc2af617ba71d13c401"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" DROP CONSTRAINT "FK_ab4b806373c2ee43946679d572e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" DROP CONSTRAINT "FK_44d36110fb38f45c2f15c946ddb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicles" DROP CONSTRAINT "FK_9c2e0a8772c9e43b32f57bfcfcc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "profiles" DROP CONSTRAINT "FK_9e432b7df0d182f8d292902d1a2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "background_checks" DROP CONSTRAINT "FK_8187384dd9bbee387242f06ee2e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "verifications" DROP CONSTRAINT "FK_e9a134af366776c651168916616"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_aee0418f8c2655aea00543f579"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a7a73da8f502565812cd0fdd6d"`,
    );
    await queryRunner.query(`DROP TABLE "mobile_deviation_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5872ec84c269e60a6819762b23"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c3d51c9476c127e6075d5c2c52"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ffbcfa0f917cef22f9803cad5e"`,
    );
    await queryRunner.query(`DROP TABLE "mobile_sos_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_91e0b596851cb63854f345c998"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ac856299ba609bcdc595303930"`,
    );
    await queryRunner.query(`DROP TABLE "mobile_live_locations"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_800eadcd518482307826b592f3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4fb2e506d745ffff52dd0a897c"`,
    );
    await queryRunner.query(`DROP TABLE "mobile_direct_messages"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_501bc4ae1b20eb4b151d6c1cc6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8a57b83ffffaa22ae67f0ea0b9"`,
    );
    await queryRunner.query(`DROP TABLE "mobile_conversations"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b65815f487f0abba4f9cd22ee8"`,
    );
    await queryRunner.query(`DROP TABLE "mobile_driver_trips"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_273752b7914db4c1038841078b"`,
    );
    await queryRunner.query(`DROP TABLE "mobile_trip_group_messages"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6dabb4ae5be0b45cf450c9441d"`,
    );
    await queryRunner.query(`DROP TABLE "mobile_trip_group_members"`);
    await queryRunner.query(`DROP TABLE "mobile_trip_groups"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5747b47835a4fa89a8df10d207"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_325127acb55ce476911aa8db43"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c6a85087def94f80315da7197f"`,
    );
    await queryRunner.query(`DROP TABLE "mobile_odometer_readings"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0faf3c1c59a0328090b9b4eb90"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e5006976e22ac8835eef2ab139"`,
    );
    await queryRunner.query(`DROP TABLE "mobile_bookings"`);
    await queryRunner.query(`DROP TABLE "mobile_trip_reply_reads"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7fffaef9d3d5f823d9e37cd85f"`,
    );
    await queryRunner.query(`DROP TABLE "mobile_trip_replies"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ef2ca3281d3952b8f8ffdb8827"`,
    );
    await queryRunner.query(`DROP TABLE "mobile_trips"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ac467ca2abde2525f2c3d7bb68"`,
    );
    await queryRunner.query(`DROP TABLE "mobile_sessions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5912caa944bd089b9183fddd6d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c4e61b625b7cd0fd7fc167ede8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_46a824d501e39171b7dca87f22"`,
    );
    await queryRunner.query(`DROP TABLE "mobile_ratings"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_aa52e3b0d47cd8ae7a6fd11cd1"`,
    );
    await queryRunner.query(`DROP TABLE "mobile_vehicles"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c5fd69ff3b140b2c3ad83861b7"`,
    );
    await queryRunner.query(`DROP TABLE "mobile_users"`);
    await queryRunner.query(`DROP TABLE "compliance_logs"`);
    await queryRunner.query(`DROP TABLE "trip_group_pickup_approvals"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_05728a2db44be658fb6fb1dfca"`,
    );
    await queryRunner.query(`DROP TABLE "trip_group_messages"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0411da2d6272ac71e7c20537d2"`,
    );
    await queryRunner.query(`DROP TABLE "trip_group_members"`);
    await queryRunner.query(`DROP TABLE "trip_groups"`);
    await queryRunner.query(`DROP TABLE "user_sessions"`);
    await queryRunner.query(`DROP TABLE "support_sessions"`);
    await queryRunner.query(`DROP TABLE "support_ticket_messages"`);
    await queryRunner.query(`DROP TABLE "support_tickets"`);
    await queryRunner.query(`DROP TABLE "support_agents"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c3984cebf2c7331581e7470ee2"`,
    );
    await queryRunner.query(`DROP TABLE "driver_trips"`);
    await queryRunner.query(`DROP TABLE "saved_searches"`);
    await queryRunner.query(`DROP TABLE "devices"`);
    await queryRunner.query(`DROP TABLE "emergency_contacts"`);
    await queryRunner.query(`DROP TABLE "notification_preferences"`);
    await queryRunner.query(`DROP TABLE "notification_log"`);
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TABLE "conversations"`);
    await queryRunner.query(`DROP TABLE "call_records"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1ced1324de7c5b9ee6558e2dc3"`,
    );
    await queryRunner.query(`DROP TABLE "chat_blocks"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bdfd8165e694fe9d3ce4140c87"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9e5fc47ecb06d4d7b84633b171"`,
    );
    await queryRunner.query(`DROP TABLE "chat_messages"`);
    await queryRunner.query(`DROP TABLE "chat_conversations"`);
    await queryRunner.query(`DROP TABLE "appeals"`);
    await queryRunner.query(`DROP TYPE "public"."appeals_status_enum"`);
    await queryRunner.query(`DROP TABLE "deviation_events"`);
    await queryRunner.query(`DROP TABLE "incidents"`);
    await queryRunner.query(`DROP TABLE "suspensions"`);
    await queryRunner.query(`DROP TABLE "moderation_actions"`);
    await queryRunner.query(
      `DROP TYPE "public"."moderation_actions_action_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE "reports"`);
    await queryRunner.query(`DROP TYPE "public"."reports_severity_enum"`);
    await queryRunner.query(`DROP TYPE "public"."reports_category_enum"`);
    await queryRunner.query(`DROP TABLE "sos_events"`);
    await queryRunner.query(`DROP TYPE "public"."sos_events_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."sos_events_trigger_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE "trip_pings"`);
    await queryRunner.query(`DROP TABLE "insurance_policies"`);
    await queryRunner.query(`DROP TABLE "refunds"`);
    await queryRunner.query(`DROP TABLE "payouts"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TABLE "booking_status_log"`);
    await queryRunner.query(`DROP TABLE "booking_luggage"`);
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`DROP TYPE "public"."bookings_status_enum"`);
    await queryRunner.query(`DROP TABLE "trip_zones"`);
    await queryRunner.query(`DROP TABLE "trip_preferences"`);
    await queryRunner.query(`DROP TABLE "trips"`);
    await queryRunner.query(`DROP TYPE "public"."trips_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d611911920d77611c563055d47"`,
    );
    await queryRunner.query(`DROP TABLE "trip_reply_reads"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4fcb0e392d03f3e30e4cb29f27"`,
    );
    await queryRunner.query(`DROP TABLE "trip_replies"`);
    await queryRunner.query(`DROP TABLE "vehicles"`);
    await queryRunner.query(`DROP TYPE "public"."vehicles_category_enum"`);
    await queryRunner.query(`DROP TABLE "profiles"`);
    await queryRunner.query(`DROP TABLE "background_checks"`);
    await queryRunner.query(
      `DROP TYPE "public"."background_checks_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "verifications"`);
    await queryRunner.query(`DROP TYPE "public"."verifications_status_enum"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(
      `DROP TYPE "public"."users_subscription_tier_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
