import { useAsyncResource } from "@/hooks/useAsyncResource";
import { apiClient } from "@/lib/api";
import type { Booking } from "@/lib/bookings";
export interface TicketBoardingPass {
  bookingId: string;
  tripId: string;
  payload: string;
  expiresAt: string | null;
}
export function useTicketBoardingPass(booking: Booking) {
  const preview = __DEV__ && booking.id.startsWith("preview-ticket-");
  const result = useAsyncResource(
    async (): Promise<TicketBoardingPass> => {
      if (preview)
        return {
          bookingId: booking.id,
          tripId: booking.tripId,
          payload: `bovogo:preview:boarding:${booking.id}`,
          expiresAt: null,
        };
      return apiClient.get<TicketBoardingPass>(
        `/bookings/${booking.id}/boarding-pass`,
      );
    },
    {
      deps: [booking.id, booking.status],
      enabled: booking.status === "confirmed",
      isEmpty: () => false,
    },
  );
  const pass = result.data;
  const valid =
    pass &&
    pass.bookingId === booking.id &&
    pass.tripId === booking.tripId &&
    (!pass.expiresAt || new Date(pass.expiresAt).getTime() > Date.now());
  return { ...result, payload: valid ? pass.payload : null };
}
