import { apiClient } from "./api";
import { platformFee } from "./pricing";

export interface BookingTripSummary {
  id: string;
  fromCity: string;
  toCity: string;
  departureAt: string;
  driverName: string;
  car: string;
}

export type LuggageTier = "carry_on" | "standard" | "large" | "oversized";

export interface Booking {
  id: string;
  tripId: string;
  riderId: string;
  seats: number;
  pricePerSeat: number;
  serviceFee: number;
  totalAmount: number;
  luggageTier: LuggageTier;
  luggageSurcharge: number;
  insuranceOptedIn: boolean;
  insurancePremium: number;
  luggageInsuranceOptedIn: boolean;
  luggageInsurancePremium: number;
  paymentMethod: "card" | "apple" | "venmo";
  status: "pending" | "confirmed" | "cancelled" | "completed";
  createdAt: string;
  completedAt: string | null;
  /** Adventure group unlocked after payment. */
  groupId?: string | null;
  trip: BookingTripSummary;
}

export interface CreateBookingInput {
  tripId: string;
  seats: number;
  paymentMethod: "card" | "apple" | "venmo";
  luggageTier?: LuggageTier;
  /** Trip insurance is default-on; send false to decline. */
  insuranceOptedIn?: boolean;
  luggageInsuranceOptedIn?: boolean;
}

export interface PrepareBookingResult {
  booking: Booking;
  clientSecret: string | null;
  publishableKey: string;
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const data = await apiClient.post<{ booking: Booking }>("/bookings", input);
  return data.booking;
}

/** Start Stripe PaymentIntent for a booking (pay-first flow). */
export async function prepareBooking(
  input: CreateBookingInput,
): Promise<PrepareBookingResult> {
  return apiClient.post<PrepareBookingResult>("/bookings/prepare", input);
}

/**
 * Confirm booking after Payment Sheet succeeds.
 *
 * Opted back into retrying, which POSTs no longer do by default. This one runs
 * *after* the Sailor's money has moved, so a dropped connection here is the
 * worst moment to give up — and repeating it is safe: the server returns the
 * existing booking when it is already confirmed rather than reserving seats a
 * second time.
 */
export async function confirmBooking(bookingId: string): Promise<Booking> {
  const data = await apiClient.post<{ booking: Booking }>(
    "/bookings/confirm",
    { bookingId },
    { retry: true },
  );
  return data.booking;
}

export async function getBooking(id: string): Promise<Booking> {
  const data = await apiClient.get<{ booking: Booking }>(`/bookings/${id}`);
  return data.booking;
}

export async function listMyBookings(): Promise<Booking[]> {
  const data = await apiClient.get<{ bookings: Booking[] }>("/bookings/mine");
  return data.bookings;
}

/**
 * Bovogo's platform fee for a booking subtotal. Must match `feeForSubtotal` in
 * the API's mobile-pricing module — the server value is authoritative.
 */
export function computeServiceFee(subtotal: number): number {
  return platformFee(subtotal);
}
