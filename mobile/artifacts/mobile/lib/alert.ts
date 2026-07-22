import { Alert, Platform } from "react-native";

export interface ConfirmOptions {
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

/**
 * Cross-platform confirmation. On web, Alert.alert button callbacks are
 * unreliable — window.confirm is used instead.
 */
export function confirm(
  title: string,
  message: string,
  options: ConfirmOptions = {},
): Promise<boolean> {
  const confirmText = options.confirmText ?? "OK";
  const cancelText = options.cancelText ?? "Cancel";

  if (Platform.OS === "web") {
    const full = message ? `${title}\n\n${message}` : title;
    return Promise.resolve(window.confirm(full));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: "cancel", onPress: () => resolve(false) },
      {
        text: confirmText,
        style: options.destructive ? "destructive" : "default",
        onPress: () => resolve(true),
      },
    ]);
  });
}

/** Simple OK dialog. */
export function showAlert(title: string, message?: string): Promise<void> {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [{ text: "OK", onPress: () => resolve() }]);
  });
}

/**
 * Success feedback with optional follow-up action.
 * On web, shows alert then runs onOk (navigation, etc.).
 */
export async function showSuccess(
  title: string,
  message: string,
  onOk?: () => void | Promise<void>,
): Promise<void> {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
    await onOk?.();
    return;
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      {
        text: "OK",
        onPress: async () => {
          await onOk?.();
          resolve();
        },
      },
    ]);
  });
}

/**
 * Alert with one or more action buttons (native only uses Alert; web runs
 * first button's onPress after confirm-style alert, or single OK).
 */
export function showAlertWithActions(
  title: string,
  message: string,
  buttons: Array<{ text: string; onPress?: () => void | Promise<void>; style?: "cancel" | "destructive" | "default" }>,
): void {
  if (Platform.OS === "web") {
    const primary = buttons.find((b) => b.style !== "cancel") ?? buttons[0];
    window.alert(`${title}\n\n${message}`);
    void primary?.onPress?.();
    return;
  }
  Alert.alert(title, message, buttons);
}
