export class Expo {
  constructor() {}
  async sendPushNotificationsAsync(): Promise<any[]> { return []; }
  chunkPushNotifications(messages: any[]): any[][] {
    return messages.length ? [messages] : [];
  }
}
export class ExpoPushMessage {}
export class ExpoPushReceipt {}
export class ExpoPushErrorReceipt {}
export class ExpoPushSuccessReceipt {}
