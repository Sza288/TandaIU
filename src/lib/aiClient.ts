// Mock AI client – sentiment analysis based on simple keyword matching
// No external API keys are used. In production replace this file with a real implementation.

/**
 * Analyze the sentiment of a given text.
 * Returns one of: 'positif' | 'netral' | 'negatif'.
 * The mock implementation looks for a few Indonesian keywords.
 */
export async function analyzeSentiment(
  text: string,
): Promise<'positif' | 'netral' | 'negatif'> {
  // Simulate network latency (optional)
  await new Promise((resolve) => setTimeout(resolve, 500));

  const lower = text.toLowerCase();
  if (
    lower.includes('bagus') ||
    lower.includes('jelas') ||
    lower.includes('senang') ||
    lower.includes('mantap') ||
    lower.includes('baik')
  ) {
    return 'positif';
  }
  if (
    lower.includes('kecewa') ||
    lower.includes('sulit') ||
    lower.includes('buruk') ||
    lower.includes('tidak') ||
    lower.includes('mengecewakan')
  ) {
    return 'negatif';
  }
  // Default fallback
  return 'netral';
}
