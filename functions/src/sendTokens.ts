export const DEFAULT_ANDROID_CHANNEL_ID = 'default';

const UID_QUERY_CHUNK_SIZE = 30;
const FCM_BATCH_SIZE = 500;

export type NotificationData = Record<string, string>;

export type FcmMessage = {
  token: string;
  notification: { title: string; body: string };
  android: {
    notification: { channelId: string; title: string; body: string };
  };
  data: NotificationData;
};

export type SendResponse = {
  success: boolean;
  error?: unknown;
};

export type SendBatchResponse = {
  responses: readonly SendResponse[];
};

export type MessagingSender = {
  sendEach(messages: readonly FcmMessage[], dryRun?: boolean): Promise<SendBatchResponse>;
};

export type DeviceTokenRecord = {
  id: string;
  uid: string;
  token: string;
};

export type DeviceTokenStore = {
  listByUids(uids: readonly string[]): Promise<readonly DeviceTokenRecord[]>;
  remove(docId: string): Promise<void>;
};

export type NotificationLogger = {
  log(message: string): void;
  error(message: string): void;
};

const REMOVABLE_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

export function createConsoleLogger(): NotificationLogger {
  return {
    log: (message) => console.log(message),
    error: (message) => console.error(message),
  };
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function readErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

export function isRemovableTokenError(error: unknown): boolean {
  const code = readErrorCode(error);
  return code !== null && REMOVABLE_TOKEN_ERROR_CODES.has(code);
}

export function buildFcmMessage(input: {
  token: string;
  title: string;
  body: string;
  data: NotificationData;
}): FcmMessage {
  return {
    token: input.token,
    notification: { title: input.title, body: input.body },
    android: {
      notification: {
        channelId: DEFAULT_ANDROID_CHANNEL_ID,
        title: input.title,
        body: input.body,
      },
    },
    data: { ...input.data },
  };
}

export type SendToUidsInput = {
  uids: readonly string[];
  title: string;
  body: string;
  data: NotificationData;
  sender: MessagingSender;
  tokenStore: DeviceTokenStore;
  logger?: NotificationLogger;
  dryRun?: boolean;
};

export type SendToUidsSummary = {
  queriedUids: number;
  tokenCount: number;
  sentCount: number;
  failureCount: number;
  removedTokenDocIds: string[];
};

export async function sendNotificationToUids(
  input: SendToUidsInput,
): Promise<SendToUidsSummary> {
  const logger = input.logger ?? createConsoleLogger();
  const uids = [...new Set(
    input.uids.map((uid) => uid.trim()).filter((uid) => uid.length > 0),
  )];

  const tokenDocs: DeviceTokenRecord[] = [];
  const seenDocIds = new Set<string>();
  const seenTokens = new Set<string>();

  for (const uidChunk of chunk(uids, UID_QUERY_CHUNK_SIZE)) {
    const records = await input.tokenStore.listByUids(uidChunk);
    for (const record of records) {
      if (!record || typeof record.id !== 'string' || typeof record.token !== 'string') continue;
      const token = record.token.trim();
      if (!token || seenDocIds.has(record.id) || seenTokens.has(token)) continue;
      seenDocIds.add(record.id);
      seenTokens.add(token);
      tokenDocs.push({ ...record, token });
    }
  }

  const outbound = tokenDocs.map((record) => ({
    tokenDocId: record.id,
    message: buildFcmMessage({
      token: record.token,
      title: input.title,
      body: input.body,
      data: input.data,
    }),
  }));

  let sentCount = 0;
  let failureCount = 0;
  const removedTokenDocIds: string[] = [];

  for (const batch of chunk(outbound, FCM_BATCH_SIZE)) {
    let responses: readonly SendResponse[];
    try {
      const result = await input.sender.sendEach(
        batch.map((item) => item.message),
        input.dryRun,
      );
      responses = result.responses;
    } catch (error) {
      failureCount += batch.length;
      logger.error(`Gagal mengirim batch notifikasi: ${readErrorCode(error) ?? 'unknown'}`);
      continue;
    }

    for (let index = 0; index < responses.length; index += 1) {
      const response = responses[index];
      if (response?.success) {
        sentCount += 1;
        continue;
      }

      failureCount += 1;
      if (isRemovableTokenError(response?.error)) {
        const docId = batch[index]?.tokenDocId;
        if (!docId) continue;
        try {
          await input.tokenStore.remove(docId);
          removedTokenDocIds.push(docId);
          logger.log(`Token perangkat tidak valid dihapus: ${docId}`);
        } catch (error) {
          logger.error(`Gagal menghapus token perangkat ${docId}: ${readErrorCode(error) ?? 'unknown'}`);
        }
        continue;
      }

      logger.error(`Gagal mengirim notifikasi: ${readErrorCode(response?.error) ?? 'unknown'}`);
    }
  }

  return {
    queriedUids: uids.length,
    tokenCount: tokenDocs.length,
    sentCount,
    failureCount,
    removedTokenDocIds,
  };
}
