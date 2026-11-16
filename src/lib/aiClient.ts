// Mock AI client – sentiment analysis based on simple keyword matching
// No external API keys are used. In production replace this file with a real implementation.

const NEGATIONS = [
  'tidak',
  'tak',
  'kurang',
  'belum',
  'bukan',
  'nggak',
  'enggak',
  'gak',
  'ga',
];

const NEGATIVE_WORDS = [
  'jelek',
  'buruk',
  'kecewa',
  'mengecewakan',
  'sulit',
  'susah',
  'bosan',
  'membosankan',
  'lambat',
  'kotor',
  'rusak',
  'error',
  'gagal',
  'malas',
  'males',
  'berisik',
  'bising',
];

const POSITIVE_WORDS = [
  'bagus',
  'baik',
  'jelas',
  'senang',
  'menyenangkan',
  'mantap',
  'seru',
  'mudah',
  'membantu',
  'nyaman',
  'enak',
  'ramah',
  'rapi',
];

function containsWord(text: string, words: string[]): boolean {
  return words.some((word) => new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`).test(text));
}

/**
 * Analyze the sentiment of a given text.
 * Returns one of: 'positif' | 'netral' | 'negatif'.
 * Negation and negative keywords are checked before positive keywords so that
 * phrases like "tidak bagus" or "kurang jelas" are not read as positive.
 */
export async function analyzeSentiment(
  text: string,
): Promise<'positif' | 'netral' | 'negatif'> {
  // Simulate network latency (optional)
  await new Promise((resolve) => setTimeout(resolve, 500));

  const lower = text.toLowerCase();
  const hasNegation = containsWord(lower, NEGATIONS);
  const hasNegative = containsWord(lower, NEGATIVE_WORDS);
  const hasPositive = containsWord(lower, POSITIVE_WORDS);

  if (hasNegative) {
    return 'negatif';
  }
  if (hasNegation && hasPositive) {
    return 'negatif';
  }
  if (hasPositive) {
    return 'positif';
  }
  // Default fallback
  return 'netral';
}
