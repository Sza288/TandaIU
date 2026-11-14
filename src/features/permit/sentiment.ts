import { analyzeSentiment } from '../../lib/aiClient';
import model from './ai/model-edom.json';
import { createSentimentClassifier } from './ai/sentiment';
import { PermitSentiment, PermitSentimentSource } from './permit.types';

export type PermitSentimentResult = {
  sentiment: PermitSentiment;
  source: PermitSentimentSource;
};

const SENTIMENTS: readonly PermitSentiment[] = ['positif', 'netral', 'negatif'];

const classify = createSentimentClassifier(model);

function isPermitSentiment(value: unknown): value is PermitSentiment {
  return typeof value === 'string' && SENTIMENTS.includes(value as PermitSentiment);
}

/**
 * Menganalisis alasan izin memakai model sentimen on-device di `ai/`.
 * Bila model tidak mengenali kosakata atau gagal dimuat, fungsi ini jatuh ke
 * `analyzeSentiment()` di `src/lib/aiClient.ts` dan menandai hasilnya sebagai
 * `fallback` agar UI dapat menampilkan peringatan.
 */
export async function analyzePermitSentiment(reason: string): Promise<PermitSentimentResult> {
  const text = reason.trim();
  if (!text) {
    return { sentiment: 'netral', source: 'fallback' };
  }

  try {
    const prediction = classify(text);
    if (isPermitSentiment(prediction.label)) {
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
