export type ReviewSentiment = 'positif' | 'netral' | 'negatif';

/**
 * `model` berarti hasil model sentimen on-device di `ai/`.
 * `fallback` berarti model tidak mengenali teks atau gagal, sehingga dipakai
 * analisis cadangan dari `src/lib/aiClient.ts`.
 */
export type ReviewSentimentSource = 'model' | 'fallback';

export type Review = {
  id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  comment: string;
  sentiment: ReviewSentiment;
  sentimentSource: ReviewSentimentSource;
  createdAt: string; // ISO 8601
};
