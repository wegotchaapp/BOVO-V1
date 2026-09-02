/**
 * Pure mapping functions that translate `mobile_*` entities into the exact JSON
 * shapes the Bovogo mobile app expects. Keeping them isolated makes the contract
 * explicit and easy to verify against `mobile/artifacts/mobile/lib/*` and
 * `data/trips.ts`.
 */
import {
  MobileBooking,
  MobileDriverTrip,
  MobileTrip,
  MobileTripReply,
  MobileUser,
  MobileVehicle,
} from './entities/mobile.entities';
import { getHubById } from './pickup-hubs';

export interface DriverSummary {
  id: string;
  name: string;
  rating: number;
  trips: number;
  isTopDriver: boolean;
}

export function driverSummary(u: {
  id: string;
  name: string;
  rating: string | number;
  trips: number;
}): DriverSummary {
  const rating = typeof u.rating === 'string' ? Number(u.rating) : u.rating;
  return {
    id: u.id,
    name: u.name,
    rating,
    trips: u.trips,
    isTopDriver: rating >= 4.85 && u.trips >= 20,
  };
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function parseJsonObject(
  raw: string | null | undefined,
): Record<string, string> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v)) out[k] = String(val);
    return out;
  } catch {
    return {};
  }
}

export const DEFAULT_NOTIFICATION_SETTINGS = {
  pushEnabled: true,
  emailEnabled: true,
  tripUpdates: true,
  marketing: false,
  messages: true,
};

export type NotificationSettings = typeof DEFAULT_NOTIFICATION_SETTINGS;

export function notificationSettingsFromUser(
  u: MobileUser,
): NotificationSettings {
  const defaults = { ...DEFAULT_NOTIFICATION_SETTINGS };
  if (!u.notification_settings) return defaults;
  try {
    const stored = JSON.parse(
      u.notification_settings,
    ) as Partial<NotificationSettings>;
    return {
      pushEnabled: stored.pushEnabled ?? defaults.pushEnabled,
      emailEnabled: stored.emailEnabled ?? defaults.emailEnabled,
      tripUpdates: stored.tripUpdates ?? defaults.tripUpdates,
      marketing: stored.marketing ?? defaults.marketing,
      messages: stored.messages ?? defaults.messages,
    };
  } catch {
    return defaults;
  }
}

export function userToDto(u: MobileUser) {
  const ridePreferences = parseJsonObject(u.ride_preferences);
  const notificationSettings = notificationSettingsFromUser(u);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone ?? '',
    role: u.role ?? null,
    rating: Number(u.rating),
    trips: u.trips,
    isVerified: u.is_verified,
    onboarded: u.onboarded,
    isFoundingMember: u.is_founding_member,
    subscriptionStatus: u.subscription_status ?? null,
    bio: u.bio ?? '',
    languages: parseJsonArray(u.languages),
    emergencyName: u.emergency_name ?? '',
    emergencyPhone: u.emergency_phone ?? '',
    photoUrl: u.photo_url ?? null,
    ridePreferences,
    preferencesCount: Object.keys(ridePreferences).length,
    notificationSettings,
    deletionRequestedAt: u.deletion_requested_at
      ? u.deletion_requested_at.toISOString()
      : null,
    // Omit when null — the mobile client normalizes a missing field to null and
    // some date coercions turn explicit null into epoch 0.
    ...(u.trial_ends_at ? { trialEndsAt: u.trial_ends_at.toISOString() } : {}),
  };
}

export function vehicleToDto(v: MobileVehicle, missing: string[] = []) {
  return {
    id: v.id,
    userId: v.user_id,
    make: v.make,
    model: v.model,
    year: v.year,
    color: v.color,
    licensePlate: v.license_plate,
    state: v.state,
    vin: v.vin,
    seatCount: v.seat_count,
    doorCount: v.door_count,
    photos: {
      front: v.photo_front_url,
      rear: v.photo_rear_url,
      left: v.photo_left_url,
      right: v.photo_right_url,
      interior: v.photo_interior_url,
    },
    documents: {
      insurance: {
        url: v.insurance_doc_url,
        expiresAt: v.insurance_expires_at,
      },
      registration: {
        url: v.registration_doc_url,
        expiresAt: v.registration_expires_at,
      },
    },
    verificationStatus: v.verification_status,
    verificationNote: v.verification_note,
    /** Empty when the vehicle satisfies every requirement to carry Sailors. */
    missingRequirements: missing,
    isComplete: missing.length === 0,
    createdAt: v.created_at.toISOString(),
    updatedAt: v.updated_at.toISOString(),
  };
}

export function tripToDto(
  t: MobileTrip,
  driver: DriverSummary,
  replyCount: number,
) {
  return {
    id: t.id,
    driver,
    fromCity: t.from_city,
    toCity: t.to_city,
    departureAt: t.departure_at.toISOString(),
    seatsAvailable: t.seats_available,
    luggageSpace: t.luggage_space,
    pricePerSeat: Number(t.price_per_seat),
    note: t.note,
    car: t.car ?? '',
    preferences: {
      smoking: t.pref_smoking,
      pets: t.pref_pets,
      music: t.pref_music,
      ac: t.pref_ac,
    },
    status: t.status,
    startVideoUrl: t.start_video_url ?? null,
    startedAt: t.started_at ? t.started_at.toISOString() : null,
    replyCount,
    createdAt: t.created_at.toISOString(),
  };
}

export function replyToDto(
  r: MobileTripReply,
  isDriverReply: boolean,
  userName: string,
  hasBookedSeat = false,
) {
  return {
    id: r.id,
    userId: r.user_id,
    userName,
    text: r.text,
    isDriverReply,
    hasBookedSeat,
    createdAt: r.created_at.toISOString(),
  };
}

export function bookingToDto(
  b: MobileBooking,
  trip: Pick<
    MobileTrip,
    'id' | 'from_city' | 'to_city' | 'departure_at' | 'car'
  >,
  driverName: string,
  groupId: string | null = null,
) {
  return {
    id: b.id,
    tripId: b.trip_id,
    riderId: b.rider_id,
    seats: b.seats,
    pricePerSeat: Number(b.price_per_seat),
    serviceFee: Number(b.service_fee),
    totalAmount: Number(b.total_amount),
    luggageTier: b.luggage_tier,
    luggageSurcharge: Number(b.luggage_surcharge ?? 0),
    insuranceOptedIn: !!b.insurance_opted_in,
    insurancePremium: Number(b.insurance_premium ?? 0),
    luggageInsuranceOptedIn: !!b.luggage_insurance_opted_in,
    luggageInsurancePremium: Number(b.luggage_insurance_premium ?? 0),
    paymentMethod: b.payment_method,
    status: b.status,
    groupId,
    createdAt: b.created_at.toISOString(),
    completedAt: b.completed_at ? b.completed_at.toISOString() : null,
    trip: {
      id: trip.id,
      fromCity: trip.from_city,
      toCity: trip.to_city,
      departureAt: trip.departure_at.toISOString(),
      driverName,
      car: trip.car ?? '',
    },
  };
}

export function driverTripToDto(t: MobileDriverTrip) {
  return {
    id: t.id,
    fromCity: t.from_city,
    toCity: t.to_city,
    miles: t.miles,
    seatsBooked: t.seats_booked,
    grossAmount: Number(t.gross_amount),
    platformFee: Number(t.platform_fee),
    netAmount: Number(t.net_amount),
    completedAt: t.completed_at.toISOString(),
  };
}

export function groupSummaryDto(row: {
  group: {
    id: string;
    trip_id: string;
    pickup_hub_id: string | null;
    pickup_locked: boolean;
    created_at: Date;
  };
  trip: { from_city: string; to_city: string; departure_at: Date };
  memberCount: number;
  latestMessage: string | null;
}) {
  return {
    id: row.group.id,
    tripId: row.group.trip_id,
    fromCity: row.trip.from_city,
    toCity: row.trip.to_city,
    departureAt: row.trip.departure_at.toISOString(),
    memberCount: row.memberCount,
    pickupLocked: row.group.pickup_locked,
    pickupHubId: row.group.pickup_hub_id,
    pickupHub: row.group.pickup_hub_id
      ? getHubById(row.group.pickup_hub_id)
      : null,
    latestMessage: row.latestMessage,
    createdAt: row.group.created_at.toISOString(),
  };
}
