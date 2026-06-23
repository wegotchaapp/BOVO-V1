import { apiClient } from "./api";

export interface BookingTripSummary {
  id: string;
  fromCity: string;
  toCity: string;
  departureAt: string;
  driverName: string;
  car: string;
}

export interface Booking {
  id: string;
  tripId: string;
  riderId: string;
  seats: number;
  pricePerSeat: number;
  serviceFee: number;
  totalAmount: number;
  paymentMethod: "card" | "apple" | "venmo";
  status: "confirmed" | "cancelled" | "completed";
  createdAt: string;
  completedAt: string | null;
  trip: BookingTripSummary;
}

export interface CreateBookingInput {
  tripId: string;
  seats: number;
  paymentMethod: "card" | "apple" | "venmo";
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const data = await apiClient.post<{ booking: Booking }>("/bookings", input);
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

/** Service-fee formula must match the API (artifacts/api-server/src/routes/bookings). */
export function computeServiceFee(subtotal: number): number {
  return Math.round(subtotal * 0.06 * 100) / 100;
}
