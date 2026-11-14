export type PermitStatus = 'pending' | 'approved' | 'rejected';

export type PermitSentiment = 'positif' | 'netral' | 'negatif';

/**
 * `model` berarti hasil model sentimen on-device di `ai/`.
 * `fallback` berarti model tidak mengenali teks atau gagal, sehingga dipakai
 * analisis cadangan dari `src/lib/aiClient.ts`.
 */
export type PermitSentimentSource = 'model' | 'fallback';

export type Permit = {
  id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  reason: string;
  sentiment: PermitSentiment;
  sentimentSource?: PermitSentimentSource;
  status: PermitStatus;
  createdAt: string; // ISO 8601
  reviewedAt?: string; // ISO 8601
  reviewedBy?: string;
};
