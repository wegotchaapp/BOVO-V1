import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../src/database/data-source';
import { User } from '../src/database/entities/user.entity';
import { UserRole, SubscriptionTier, TripStatus, BookingStatus, VehicleCategory, LuggageCapacity } from '../src/common/enums';
import { Profile, Vehicle } from '../src/database/entities/profile.entities';
import { Trip, TripPreference } from '../src/database/entities/trip.entities';
import { Booking } from '../src/database/entities/booking.entities';
import { Conversation, Message, EmergencyContact } from '../src/database/entities/communication.entities';

async function seed() {
  console.log('🌱 Connecting to database...');
  const dataSource = AppDataSource.initialize ? await AppDataSource.initialize() : AppDataSource;
  
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const userRepo = dataSource.getRepository(User);
  const profileRepo = dataSource.getRepository(Profile);
  const vehicleRepo = dataSource.getRepository(Vehicle);
  const tripRepo = dataSource.getRepository(Trip);
  const tripPrefRepo = dataSource.getRepository(TripPreference);
  const bookingRepo = dataSource.getRepository(Booking);
  const conversationRepo = dataSource.getRepository(Conversation);
  const messageRepo = dataSource.getRepository(Message);
  const emergencyContactRepo = dataSource.getRepository(EmergencyContact);

  try {
    // Check if already seeded
    const existingUsers = await userRepo.count();
    if (existingUsers > 0) {
      console.log('⚠️ Database already has users, skipping seed');
      return;
    }

    // Create test users
    const passwordHash = await bcrypt.hash('testpass123', 10);

    console.log('👤 Creating test users...');
    const users: User[] = await userRepo.save([
      // Driver 1
      {
        email: 'driver1@test.com',
        phone: '+15551234567',
        password_hash: passwordHash,
        name: 'Marcus Johnson',
        display_name: 'Marcus J',
        dob: '1985-06-15',
        role: UserRole.DRIVER,
        is_email_verified: true,
        is_phone_verified: true,
        avg_rating: 4.92,
        total_ratings: 47,
        total_trips: 89,
        background_check_status: 'clear',
        safe_word: 'bluebird',
      },
      // Driver 2
      {
        email: 'driver2@test.com',
        phone: '+15559876543',
        password_hash: passwordHash,
        name: 'Sarah Chen',
        display_name: 'Sarah C',
        dob: '1990-03-22',
        role: UserRole.DRIVER,
        is_email_verified: true,
        is_phone_verified: true,
        avg_rating: 4.87,
        total_ratings: 32,
        total_trips: 64,
        background_check_status: 'clear',
        safe_word: 'mountain',
      },
      // Driver 3
      {
        email: 'driver3@test.com',
        phone: '+15555551234',
        password_hash: passwordHash,
        name: 'David Rodriguez',
        display_name: 'David R',
        dob: '1988-11-08',
        role: UserRole.DRIVER,
        is_email_verified: true,
        is_phone_verified: true,
        avg_rating: 4.95,
        total_ratings: 61,
        total_trips: 112,
        background_check_status: 'clear',
        safe_word: 'sunset',
      },
      // Rider (for testing bookings)
      {
        email: 'rider@test.com',
        phone: '+15555559999',
        password_hash: passwordHash,
        name: 'Alex Thompson',
        display_name: 'Alex T',
        dob: '1992-09-01',
        role: UserRole.USER,
        is_email_verified: true,
        is_phone_verified: true,
        avg_rating: 4.75,
        total_ratings: 12,
        total_trips: 15,
        safe_word: 'coffee',
      },
      // Admin user
      {
        email: 'admin@test.com',
        phone: '+15550000000',
        password_hash: passwordHash,
        name: 'Admin User',
        display_name: 'Admin',
        dob: '1980-01-01',
        role: UserRole.ADMIN,
        is_email_verified: true,
        is_phone_verified: true,
      },
    ]);

    const [driver1, driver2, driver3, rider] = users;

    // Create profiles
    console.log('📋 Creating profiles...');
    await profileRepo.save([
      {
        user_id: driver1.id,
        user: driver1,
        display_name: 'Marcus J',
        bio: 'Professional driver, love good conversations and smooth rides. Clean car, punctual always.',
        languages: ['English', 'Spanish'],
        avg_rating: 4.92,
        total_trips: 89,
        badges: ['verified', 'top_rated', 'punctual'],
      },
      {
        user_id: driver2.id,
        user: driver2,
        display_name: 'Sarah C',
        bio: 'Tech worker commuting Austin-Houston weekly. Happy to chat or keep it quiet!',
        languages: ['English', 'Mandarin'],
        avg_rating: 4.87,
        total_trips: 64,
        badges: ['verified', 'female_driver'],
      },
      {
        user_id: driver3.id,
        user: driver3,
        display_name: 'David R',
        bio: 'Retired veteran, love helping people. Safe driving is my priority.',
        languages: ['English'],
        avg_rating: 4.95,
        total_trips: 112,
        badges: ['verified', 'top_rated', 'military'],
      },
      {
        user_id: rider.id,
        user: rider,
        display_name: 'Alex T',
        bio: 'Frequent traveler, respectful rider.',
        languages: ['English'],
        avg_rating: 4.75,
        total_trips: 15,
        badges: ['verified'],
      },
    ]);

    // Create vehicles
    console.log('🚗 Creating vehicles...');
    const vehicles: Vehicle[] = await vehicleRepo.save([
      {
        driver_id: driver1.id,
        driver: driver1,
        make: 'Toyota',
        model: 'Camry',
        year: 2023,
        color: 'Silver',
        license_plate: 'TX-ABC123',
        state: 'TX',
        category: VehicleCategory.STANDARD_SEDAN,
        max_luggage_class: LuggageCapacity.MEDIUM,
        max_passengers: 3,
        is_verified: true,
      },
      {
        driver_id: driver2.id,
        driver: driver2,
        make: 'Honda',
        model: 'CR-V',
        year: 2022,
        color: 'Blue',
        license_plate: 'TX-DEF456',
        state: 'TX',
        category: VehicleCategory.SUV_CROSSOVER,
        max_luggage_class: LuggageCapacity.LARGE,
        max_passengers: 3,
        is_verified: true,
      },
      {
        driver_id: driver3.id,
        driver: driver3,
        make: 'Ford',
        model: 'Explorer',
        year: 2024,
        color: 'Black',
        license_plate: 'TX-GHI789',
        state: 'TX',
        category: VehicleCategory.LARGE_SUV,
        max_luggage_class: LuggageCapacity.LARGE,
        max_passengers: 5,
        is_verified: true,
      },
    ]);

    // Calculate tomorrow's date for trips
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Create trips
    console.log('🛣️ Creating trips...');
    const trips: Trip[] = await tripRepo.save([
      // Austin -> Houston (Morning)
      {
        driver_id: driver1.id,
        driver: driver1,
        vehicle_id: vehicles[0].id,
        vehicle: vehicles[0],
        origin_metro: 'Austin, TX',
        origin_pickup_zones: ['Downtown Austin', 'UT Campus', 'South Congress'],
        dest_metro: 'Houston, TX',
        dest_dropoff_zones: ['Downtown Houston', 'Galleria', 'Medical Center'],
        departure_date: tomorrowStr,
        departure_time: '08:00:00',
        departure_time_window: '+/- 30 min',
        seats_total: 3,
        seats_available: 3,
        per_seat_price: 35.00,
        status: TripStatus.POSTED,
        distance_miles: 165.0,
        irs_rate_used: 0.67,
        origin_lat: 30.267,
        origin_lng: -97.743,
        dest_lat: 29.760,
        dest_lng: -95.369,
      },
      // Houston -> Austin (Afternoon)
      {
        driver_id: driver2.id,
        driver: driver2,
        vehicle_id: vehicles[1].id,
        vehicle: vehicles[1],
        origin_metro: 'Houston, TX',
        origin_pickup_zones: ['Downtown Houston', 'Energy Corridor'],
        dest_metro: 'Austin, TX',
        dest_dropoff_zones: ['Downtown Austin', 'Domain'],
        departure_date: tomorrowStr,
        departure_time: '14:00:00',
        departure_time_window: '+/- 1 hour',
        seats_total: 3,
        seats_available: 2,
        per_seat_price: 32.00,
        status: TripStatus.POSTED,
        distance_miles: 165.0,
        irs_rate_used: 0.67,
        origin_lat: 29.760,
        origin_lng: -95.369,
        dest_lat: 30.267,
        dest_lng: -97.743,
      },
      // Austin -> San Antonio
      {
        driver_id: driver3.id,
        driver: driver3,
        vehicle_id: vehicles[2].id,
        vehicle: vehicles[2],
        origin_metro: 'Austin, TX',
        origin_pickup_zones: ['Downtown Austin', 'Airport'],
        dest_metro: 'San Antonio, TX',
        dest_dropoff_zones: ['Downtown SA', 'River Walk', 'Alamo Area'],
        departure_date: tomorrowStr,
        departure_time: '10:30:00',
        departure_time_window: '+/- 30 min',
        seats_total: 5,
        seats_available: 4,
        per_seat_price: 28.00,
        status: TripStatus.POSTED,
        distance_miles: 80.0,
        irs_rate_used: 0.67,
        origin_lat: 30.267,
        origin_lng: -97.743,
        dest_lat: 29.424,
        dest_lng: -98.493,
      },
      // Dallas -> Austin (next day)
      {
        driver_id: driver1.id,
        driver: driver1,
        vehicle_id: vehicles[0].id,
        vehicle: vehicles[0],
        origin_metro: 'Dallas, TX',
        origin_pickup_zones: ['Downtown Dallas', 'DFW Airport'],
        dest_metro: 'Austin, TX',
        dest_dropoff_zones: ['Downtown Austin', 'South Congress'],
        departure_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        departure_time: '09:00:00',
        departure_time_window: '+/- 1 hour',
        seats_total: 3,
        seats_available: 3,
        per_seat_price: 55.00,
        status: TripStatus.POSTED,
        distance_miles: 195.0,
        irs_rate_used: 0.67,
        origin_lat: 32.776,
        origin_lng: -96.797,
        dest_lat: 30.267,
        dest_lng: -97.743,
      },
    ]);

    // Create trip preferences
    console.log('⚙️ Creating trip preferences...');
    await tripPrefRepo.save([
      {
        trip_id: trips[0].id,
        trip: trips[0],
        conversation: 'friendly',
        music: 'background',
        smoking: 'never',
        pets: 'with_approval',
        women_only: false,
      },
      {
        trip_id: trips[1].id,
        trip: trips[1],
        conversation: 'quiet',
        music: 'no_music',
        smoking: 'never',
        pets: 'with_approval',
        women_only: false,
      },
      {
        trip_id: trips[2].id,
        trip: trips[2],
        conversation: 'chatty',
        music: 'driver_choice',
        smoking: 'never',
        pets: 'welcome',
        women_only: false,
      },
      {
        trip_id: trips[3].id,
        trip: trips[3],
        conversation: 'friendly',
        music: 'background',
        smoking: 'never',
        pets: 'with_approval',
        women_only: false,
      },
    ]);

    // Create an existing booking + conversation for testing
    console.log('📅 Creating test booking...');
    const booking = await bookingRepo.save({
      rider_id: rider.id,
      rider: rider,
      trip_id: trips[1].id,
      trip: trips[1],
      seats: 1,
      total_price: 32.00,
      status: BookingStatus.CONFIRMED,
    });

    // Create conversation for this booking
    const conversation = await conversationRepo.save({
      booking_id: booking.id,
      booking: booking,
      participant_ids: [driver2.id, rider.id],
    });

    // Add some test messages
    await messageRepo.save([
      {
        conversation_id: conversation.id,
        conversation: conversation,
        sender_id: rider.id,
        content: 'Hi Sarah! Looking forward to the ride tomorrow.',
        created_at: new Date().toISOString(),
      },
      {
        conversation_id: conversation.id,
        conversation: conversation,
        sender_id: driver2.id,
        content: 'Hey Alex! See you at 2pm at the Downtown Houston pickup point.',
        created_at: new Date(Date.now() + 60000).toISOString(),
      },
    ]);

    // Update seats available on booked trip
    trips[1].seats_available = 1;
    await tripRepo.save(trips[1]);

    // Create emergency contact for rider
    await emergencyContactRepo.save({
      user_id: rider.id,
      name: 'Jordan Thompson',
      phone: '+15555558888',
      email: 'jordan@test.com',
      relationship: 'spouse',
    });

    console.log('✅ Seed completed successfully!');
    console.log('');
    console.log('📝 Test Credentials (password: testpass123 for all):');
    console.log('  Driver 1: driver1@test.com (Marcus Johnson - Toyota Camry)');
    console.log('  Driver 2: driver2@test.com (Sarah Chen - Honda CR-V)');
    console.log('  Driver 3: driver3@test.com (David Rodriguez - Ford Explorer)');
    console.log('  Rider:    rider@test.com (Alex Thompson)');
    console.log('  Admin:    admin@test.com');
    console.log('');
    console.log('🛣️ Trips created:');
    console.log(`  - Austin → Houston (Tomorrow 8:00 AM) - $35/seat`);
    console.log(`  - Houston → Austin (Tomorrow 2:00 PM) - $32/seat - 1 booked`);
    console.log(`  - Austin → San Antonio (Tomorrow 10:30 AM) - $28/seat`);
    console.log(`  - Dallas → Austin (Day after 9:00 AM) - $55/seat`);
    console.log('');
    console.log('💬 Active conversation between Sarah and Alex on Houston→Austin trip');

  } catch (error) {
    console.error('❌ Seed failed:', error);
  } finally {
    await dataSource.destroy();
  }
}

seed();
