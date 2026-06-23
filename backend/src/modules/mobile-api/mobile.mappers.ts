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

export function userToDto(u: MobileUser) {
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
    // Omit when null — the mobile client normalizes a missing field to null and
    // some date coercions turn explicit null into epoch 0.
    ...(u.trial_ends_at ? { trialEndsAt: u.trial_ends_at.toISOString() } : {}),
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
    replyCount,
    createdAt: t.created_at.toISOString(),
  };
}

export function replyToDto(
  r: MobileTripReply,
  isDriverReply: boolean,
  userName: string,
) {
  return {
    id: r.id,
    userId: r.user_id,
    userName,
    text: r.text,
    isDriverReply,
    createdAt: r.created_at.toISOString(),
  };
}

export function bookingToDto(
  b: MobileBooking,
  trip: Pick<MobileTrip, 'id' | 'from_city' | 'to_city' | 'departure_at' | 'car'>,
  driverName: string,
) {
  return {
    id: b.id,
    tripId: b.trip_id,
    riderId: b.rider_id,
    seats: b.seats,
    pricePerSeat: Number(b.price_per_seat),
    serviceFee: Number(b.service_fee),
    totalAmount: Number(b.total_amount),
    paymentMethod: b.payment_method,
    status: b.status,
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
