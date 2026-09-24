import type {
  Booking,
  CreateBookingInput,
  PrepareBookingResult,
} from "./bookings";
/** Keeps a successful payment attached to its booking across confirmation retries. */
export function createCheckoutSession(dependencies: {
  prepare: (input: CreateBookingInput) => Promise<PrepareBookingResult>;
  present: (clientSecret: string) => Promise<"paid" | "cancelled">;
  confirm: (id: string) => Promise<Booking>;
}) {
  let paidBookingId: string | null = null;
  let completed: Booking | null = null;
  let inFlight: Promise<Booking | null> | null = null;
  async function perform(input: CreateBookingInput) {
    if (completed) return completed;
    if (!paidBookingId) {
      const prepared = await dependencies.prepare(input);
      if (!prepared.clientSecret)
        throw new Error(
          "Payment is unavailable. Your booking has not been confirmed.",
        );
      if ((await dependencies.present(prepared.clientSecret)) === "cancelled")
        return null;
      paidBookingId = prepared.booking.id;
    }
    const booking = await dependencies.confirm(paidBookingId);
    if (booking.status !== "confirmed" && booking.status !== "completed") {
      throw new Error(
        "Your payment was submitted, but booking confirmation is still pending. Retry confirmation without paying again.",
      );
    }
    completed = booking;
    paidBookingId = null;
    return booking;
  }
  return {
    get needsConfirmation() {
      return paidBookingId !== null;
    },
    pay(input: CreateBookingInput) {
      if (!inFlight)
        inFlight = perform(input).finally(() => {
          inFlight = null;
        });
      return inFlight;
    },
  };
}
