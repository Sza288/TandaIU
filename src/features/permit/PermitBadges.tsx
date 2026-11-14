import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { PermitSentiment, PermitStatus } from './permit.types';

const STATUS_STYLES: Record<
  PermitStatus,
  { label: string; backgroundColor: string; textColor: string }
> = {
  pending: {
    label: 'Menunggu',
    backgroundColor: colors.warningBg,
    textColor: colors.warning,
  },
  approved: {
    label: 'Disetujui',
    backgroundColor: colors.successBg,
    textColor: colors.success,
  },
  rejected: {
    label: 'Ditolak',
    backgroundColor: colors.dangerBg,
    textColor: colors.danger,
  },
};

const SENTIMENT_STYLES: Record<PermitSentiment, { label: string; backgroundColor: string; textColor: string }> = {
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

export function PermitStatusBadge({ status }: { status: PermitStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <View style={[styles.badge, { backgroundColor: style.backgroundColor }]}>
      <Text style={[styles.label, { color: style.textColor }]}>{style.label}</Text>
    </View>
  );
}

export function SentimentBadge({ sentiment }: { sentiment: PermitSentiment }) {
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
