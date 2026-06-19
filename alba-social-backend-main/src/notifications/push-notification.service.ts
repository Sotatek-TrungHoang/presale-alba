import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: any;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  subtitle?: string;
  ttl?: number;
}

export type PushSendOutcome =
  | { status: 'ok'; ticketId: string }
  | { status: 'error'; errorCode?: string; errorMessage: string }
  | { status: 'invalid_token'; errorMessage: string };

export interface PushSendResult {
  token: string;
  outcome: PushSendOutcome;
}

export type ReceiptOutcome =
  | { status: 'ok' }
  | { status: 'error'; errorCode?: string; errorMessage: string };

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private expo: Expo;

  constructor() {
    this.expo = new Expo();
  }

  /**
   * Send push notification to a single token
   */
  async sendNotificationToToken(
    pushToken: string,
    payload: NotificationPayload,
  ): Promise<ExpoPushTicket | null> {
    if (!Expo.isExpoPushToken(pushToken)) {
      this.logger.error(
        `Push token ${pushToken} is not a valid Expo push token`,
      );
      return null;
    }

    const message: ExpoPushMessage = {
      to: pushToken,
      sound: payload.sound || 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data,
      badge: payload.badge,
      channelId: payload.channelId,
      priority: payload.priority || 'high',
      subtitle: payload.subtitle,
      ttl: payload.ttl,
    };

    try {
      const tickets = await this.expo.sendPushNotificationsAsync([message]);
      const ticket = tickets[0];

      if (ticket.status === 'error') {
        this.logger.error(`Error sending notification: ${ticket.message}`);
        return null;
      }

      this.logger.log(`Notification sent successfully to ${pushToken}`);
      return ticket;
    } catch (error) {
      this.logger.error(`Failed to send notification to ${pushToken}:`, error);
      return null;
    }
  }

  /**
   * Send push notification to multiple tokens. Returns one result per input
   * token, in the same order, so callers can map ticket ids back to the token
   * (and the user/device) they were sent to.
   */
  async sendNotificationToTokens(
    pushTokens: string[],
    payload: NotificationPayload,
  ): Promise<PushSendResult[]> {
    const results: PushSendResult[] = pushTokens.map((token) => ({
      token,
      outcome: Expo.isExpoPushToken(token)
        ? { status: 'error', errorMessage: 'pending' }
        : { status: 'invalid_token', errorMessage: 'Not a valid Expo push token' },
    }));

    const sendable = results
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.outcome.status !== 'invalid_token');

    const invalidCount = results.length - sendable.length;
    if (invalidCount > 0) {
      this.logger.warn(`${invalidCount} invalid tokens filtered out`);
    }

    if (sendable.length === 0) {
      this.logger.warn('No valid push tokens provided');
      return results;
    }

    const messages: ExpoPushMessage[] = sendable.map(({ result }) => ({
      to: result.token,
      sound: payload.sound || 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data,
      badge: payload.badge,
      channelId: payload.channelId,
      priority: payload.priority || 'high',
      subtitle: payload.subtitle,
      ttl: payload.ttl,
    }));

    try {
      // Expo allows up to 100 notifications per request
      const chunks = this.chunkArray(messages, 100);
      const tickets: ExpoPushTicket[] = [];
      for (const chunk of chunks) {
        const chunkTickets = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...chunkTickets);
      }

      sendable.forEach(({ index }, sendableIdx) => {
        const ticket = tickets[sendableIdx];
        results[index].outcome = this.ticketToOutcome(ticket);
      });

      const errorCount = results.filter(
        (r) => r.outcome.status !== 'ok',
      ).length;
      const okCount = results.length - errorCount;
      if (errorCount > 0) {
        this.logger.error(`${errorCount} notifications failed to send`);
      }
      this.logger.log(`Sent ${okCount} notifications successfully`);

      return results;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to send batch notifications:', error);
      sendable.forEach(({ index }) => {
        results[index].outcome = { status: 'error', errorMessage };
      });
      return results;
    }
  }

  private ticketToOutcome(ticket: ExpoPushTicket | undefined): PushSendOutcome {
    if (!ticket) {
      return { status: 'error', errorMessage: 'No ticket returned from Expo' };
    }
    if (ticket.status === 'ok') {
      return { status: 'ok', ticketId: ticket.id };
    }
    return {
      status: 'error',
      errorCode: ticket.details?.error,
      errorMessage: ticket.message,
    };
  }

  /**
   * Fetch delivery receipts from Expo for the given ticket ids. Returns one
   * entry per ticket for which Expo has a verdict; tickets still being
   * processed by the Expo/APNS/FCM pipeline are simply absent.
   */
  async checkNotificationReceipts(
    ticketIds: string[],
  ): Promise<Map<string, ReceiptOutcome>> {
    const outcomes = new Map<string, ReceiptOutcome>();
    if (ticketIds.length === 0) return outcomes;

    try {
      const chunks = this.chunkArray(ticketIds, 1000);
      for (const chunk of chunks) {
        const receipts =
          await this.expo.getPushNotificationReceiptsAsync(chunk);
        for (const [ticketId, receipt] of Object.entries(receipts)) {
          if (receipt.status === 'ok') {
            outcomes.set(ticketId, { status: 'ok' });
          } else {
            outcomes.set(ticketId, {
              status: 'error',
              errorCode: receipt.details?.error,
              errorMessage: receipt.message ?? 'Unknown error',
            });
          }
        }
      }
      return outcomes;
    } catch (error) {
      this.logger.error('Failed to check notification receipts:', error);
      return outcomes;
    }
  }

  /**
   * Utility method to chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
