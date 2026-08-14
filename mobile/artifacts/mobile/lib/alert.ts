import { enqueueAlert, type AlertButton } from "@/components/AlertHost";

/**
 * Cross-platform dialogs.
 *
 * Everything here routes through `<AlertHost />` (mounted in app/_layout.tsx),
 * so dialogs look and behave the same on web and native. Do NOT import `Alert`
 * from "react-native" — react-native-web does not implement it and every call
 * is silently dropped in the browser.
 */

export interface ConfirmOptions {
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

/** Two-button confirmation. Resolves true when the user confirms. */
export function confirm(
  title: string,
  message: string,
  options: ConfirmOptions = {},
): Promise<boolean> {
  return new Promise((resolve) => {
    enqueueAlert({
      title,
      message,
      buttons: [
        { text: options.cancelText ?? "Cancel", style: "cancel" },
        {
          text: options.confirmText ?? "OK",
          style: options.destructive ? "destructive" : "default",
        },
      ],
      resolve: (index) => resolve(index === 1),
    });
  });
}

/** Single-button notice. Resolves once dismissed. */
export function showAlert(title: string, message?: string): Promise<void> {
  return new Promise((resolve) => {
    enqueueAlert({
      title,
      message,
      buttons: [{ text: "OK" }],
      resolve: () => resolve(),
      dismissIndex: 0,
    });
  });
}

/** Success notice that runs a follow-up action (navigation, refresh, …) on OK. */
export function showSuccess(
  title: string,
  message: string,
  onOk?: () => void | Promise<void>,
): Promise<void> {
  return new Promise((resolve) => {
    enqueueAlert({
      title,
      message,
      buttons: [{ text: "OK", onPress: onOk }],
      resolve: () => resolve(),
      dismissIndex: 0,
    });
  });
}

/** Dialog with an arbitrary set of action buttons. */
export function showAlertWithActions(
  title: string,
  message: string,
  buttons: AlertButton[],
): void {
  enqueueAlert({
    title,
    message,
    buttons,
    resolve: () => {},
  });
}

/**
 * Drop-in replacement for react-native's `Alert`, so screens can keep the
 * familiar call shape while actually working in the browser.
 *
 *   import { Alert } from "@/lib/alert";
 *   Alert.alert("Title", "Message", [{ text: "OK", onPress: … }]);
 */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]): void {
    enqueueAlert({
      title,
      message,
      buttons: buttons ?? [{ text: "OK" }],
      resolve: () => {},
      dismissIndex: buttons && buttons.length > 1 ? undefined : 0,
    });
  },
};

export type { AlertButton };
