import React from "react";

// Web stub for @stripe/stripe-react-native, which is a native-only module
// (it imports `react-native/Libraries/Utilities/codegenNativeCommands` and
// breaks Metro's web bundle). The mobile app uses Stripe's native Payment
// Sheet on iOS/Android; on web we render a "open the mobile app" fallback,
// so these stubs are never actually invoked.

export function StripeProvider({ children }: { children?: React.ReactNode }) {
  return React.createElement(React.Fragment, null, children);
}

type InitParams = Record<string, unknown>;
type PresentResult = { error?: { code?: string; message?: string } | null };

export function useStripe() {
  return {
    initPaymentSheet: async (_params: InitParams): Promise<PresentResult> => ({
      error: { message: "Stripe is only available on iOS and Android" },
    }),
    presentPaymentSheet: async (): Promise<PresentResult> => ({
      error: { message: "Stripe is only available on iOS and Android" },
    }),
  };
}
