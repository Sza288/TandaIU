import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNav from '../../components/BottomNav';
import ScreenHeader from '../../components/ScreenHeader';
import { useReviews } from '../../hooks/useReview';
import { useSessions } from '../../hooks/useSessions';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import { PracticumSession } from '../../types';
import { formatDateTime } from '../../utils/format';
import { SentimentBadge } from './ReviewBadges';
import { Review, ReviewSentiment } from './review.types';

type FilterKey = 'all' | ReviewSentiment;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'positif', label: 'Positif' },
  { key: 'netral', label: 'Netral' },
  { key: 'negatif', label: 'Negatif' },
];

export default function AssistantReviewsScreen() {
  const { data: sessions } = useSessions();
  const reviews = useReviews();
  const [filter, setFilter] = useState<FilterKey>('all');

  const sessionById = useMemo(
    () => new Map(sessions.map((session) => [session.id, session])),
    [sessions],
  );

  const counts = useMemo(
    () => ({
      positif: reviews.filter((review) => review.sentiment === 'positif').length,
      netral: reviews.filter((review) => review.sentiment === 'netral').length,
      negatif: reviews.filter((review) => review.sentiment === 'negatif').length,
    }),
    [reviews],
  );

  const visibleReviews = useMemo(
    () =>
      filter === 'all'
        ? reviews
        : reviews.filter((review) => review.sentiment === filter),
    [filter, reviews],
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/assistant');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Ulasan Praktikan"
        eyebrow="Asisten Praktikum"
        onBack={handleBack}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsRow}>
          <StatTile label="Positif" value={counts.positif} tone="success" />
          <StatTile label="Netral" value={counts.netral} tone="neutral" />
          <StatTile label="Negatif" value={counts.negatif} tone="danger" />
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((item) => {
            const active = item.key === filter;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(item.key)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Filter ${item.label}`}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {visibleReviews.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="chatbubble-ellipses-outline" size={26} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Belum ada ulasan</Text>
            <Text style={styles.emptyDescription}>
              Ulasan praktikan akan muncul di sini secara realtime setelah sesi ditutup.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {visibleReviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                session={sessionById.get(review.sessionId)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

function ReviewCard({
  review,
  session,
}: {
  review: Review;
  session?: PracticumSession;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{review.studentName.charAt(0)}</Text>
        </View>
        <View style={styles.cardCopy}>
          <Text style={styles.studentName} numberOfLines={1}>
            {review.studentName}
          </Text>
          <Text style={styles.cardMeta}>
            {session?.practicumName ?? 'Sesi tidak ditemukan'}
            {session ? ` · Kelas ${session.className}` : ''}
          </Text>
        </View>
      </View>

      <Text style={styles.comment}>{review.comment}</Text>

      <View style={styles.badges}>
        <SentimentBadge sentiment={review.sentiment} />
        {review.sentimentSource === 'fallback' ? (
          <View style={styles.fallbackNote}>
            <Ionicons name="warning-outline" size={13} color={colors.warning} />
            <Text style={styles.fallbackText}>Analisis cadangan</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.timestamp}>Dikirim {formatDateTime(review.createdAt)}</Text>
    </View>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'success' | 'neutral' | 'danger';
}) {
  return (
    <View style={[styles.statTile, STAT_TONES[tone]]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const STAT_TONES = {
  success: { backgroundColor: colors.successBg },
  neutral: { backgroundColor: colors.neutralBg },
  danger: { backgroundColor: colors.dangerBg },
} as const;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statTile: {
    flex: 1,
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.md,
  },
  statValue: {
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 19,
  },
  statLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 10,
    textAlign: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  filterText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  filterTextActive: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  avatar: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primarySofter,
  },
  avatarText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  studentName: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  cardMeta: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  comment: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fallbackNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  fallbackText: {
    color: colors.warning,
    fontFamily: fonts.semiBold,
    fontSize: 10,
  },
  timestamp: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 10,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    marginBottom: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primarySofter,
  },
  emptyTitle: {
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 18,
    textAlign: 'center',
  },
  emptyDescription: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
