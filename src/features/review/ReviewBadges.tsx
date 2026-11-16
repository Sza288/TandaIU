import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { ReviewSentiment } from './review.types';

const SENTIMENT_STYLES: Record<
  ReviewSentiment,
  { label: string; backgroundColor: string; textColor: string }
> = {
  positif: {
    label: 'Positif',
    backgroundColor: colors.successBg,
    textColor: colors.success,
  },
  netral: {
    label: 'Netral',
    backgroundColor: colors.neutralBg,
    textColor: colors.neutral,
  },
  negatif: {
    label: 'Negatif',
    backgroundColor: colors.dangerBg,
    textColor: colors.danger,
  },
};

export function SentimentBadge({ sentiment }: { sentiment: ReviewSentiment }) {
  const style = SENTIMENT_STYLES[sentiment];
  return (
    <View style={[styles.badge, { backgroundColor: style.backgroundColor }]}>
      <Text style={[styles.label, { color: style.textColor }]}>
        Sentimen AI: {style.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 10,
  },
});
