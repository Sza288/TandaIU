import { analyzeSentiment } from '../../lib/aiClient';
import model from './ai/model-edom.json';
import { createSentimentClassifier } from './ai/sentiment';
import { ReviewSentiment, ReviewSentimentSource } from './review.types';

export type ReviewSentimentResult = {
  sentiment: ReviewSentiment;
  source: ReviewSentimentSource;
};

const SENTIMENTS: readonly ReviewSentiment[] = ['positif', 'netral', 'negatif'];

const classify = createSentimentClassifier(model);

function isReviewSentiment(value: unknown): value is ReviewSentiment {
  return typeof value === 'string' && SENTIMENTS.includes(value as ReviewSentiment);
}

/**
 * Menganalisis teks ulasan pasca-praktikum memakai model sentimen on-device di `ai/`.
 * Bila model tidak mengenali kosakata atau gagal dimuat, fungsi ini jatuh ke
 * `analyzeSentiment()` di `src/lib/aiClient.ts` dan menandai hasilnya sebagai
 * `fallback` agar UI dapat menampilkan peringatan.
 */
export async function analyzeReviewSentiment(comment: string): Promise<ReviewSentimentResult> {
  const text = comment.trim();
  if (!text) {
    return { sentiment: 'netral', source: 'fallback' };
  }

  try {
    const prediction = classify(text);
    if (isReviewSentiment(prediction.label)) {
      return { sentiment: prediction.label, source: 'model' };
    }
  } catch (error) {
    console.warn('Model sentimen lokal gagal digunakan.', error);
  }

  try {
    const sentiment = await analyzeSentiment(text);
    return { sentiment, source: 'fallback' };
  } catch (error) {
    console.warn('Analisis sentimen cadangan gagal digunakan.', error);
    return { sentiment: 'netral', source: 'fallback' };
  }
}
