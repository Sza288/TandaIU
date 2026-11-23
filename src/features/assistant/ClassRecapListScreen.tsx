import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AssistantPageHeader from './AssistantPageHeader';
import { useClasses } from '../../hooks/useClasses';
import { useSessions } from '../../hooks/useSessions';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import { getCourseName } from '../crud/crud.utils';

export default function ClassRecapListScreen() {
  const classResult = useClasses();
  const sessionResult = useSessions();

  const summaries = useMemo(() => {
    const byClass = new Map<string, { total: number; closed: number }>();
    for (const session of sessionResult.data) {
      const current = byClass.get(session.classId) ?? { total: 0, closed: 0 };
      current.total += 1;
      if (session.status === 'ditutup') current.closed += 1;
      byClass.set(session.classId, current);
    }

    return classResult.data
      .map((classDoc) => ({
        classDoc,
        courseName: getCourseName(classDoc.courseId),
        meetings: byClass.get(classDoc.id) ?? { total: 0, closed: 0 },
      }))
      .sort((a, b) => a.courseName.localeCompare(b.courseName, 'id'));
  }, [classResult.data, sessionResult.data]);

  const loading = classResult.loading || sessionResult.loading;
  const error = classResult.error ?? sessionResult.error;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/assistant');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <AssistantPageHeader eyebrow="Peran Asisten" title="Rekap per Kelas" onBack={handleBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Rekap kehadiran gabungan seluruh pertemuan pada setiap kelas. Untuk detail satu
          pertemuan, buka menu Riwayat lalu pilih Lihat Rekap.
        </Text>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Memuat daftar kelas...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.danger} />
            <Text style={styles.stateTitle}>Rekap tidak dapat dimuat</Text>
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : summaries.length === 0 ? (
          <View style={styles.stateCard}>
            <Ionicons name="school-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.stateTitle}>Belum ada kelas</Text>
            <Text style={styles.stateText}>
              Kelas yang dikelola lewat menu Kelola Praktikum akan muncul di sini.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {summaries.map(({ classDoc, courseName, meetings }) => (
              <Pressable
                key={classDoc.id}
                accessibilityRole="button"
                accessibilityLabel={`Rekap kelas ${classDoc.className} ${courseName}`}
                onPress={() =>
                  router.push({
                    pathname: '/assistant/rekap/kelas/[classId]',
                    params: { classId: classDoc.id },
                  })
                }
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardIcon}>
                    <Ionicons name="school-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {courseName}
                    </Text>
                    <Text style={styles.cardMeta}>Kelas {classDoc.className}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </View>

                <View style={styles.divider} />

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{meetings.total}</Text>
                    <Text style={styles.statLabel}>Pertemuan</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{meetings.closed}</Text>
                    <Text style={styles.statLabel}>Sudah Selesai</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{meetings.total - meetings.closed}</Text>
                    <Text style={styles.statLabel}>Belum Selesai</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    gap: spacing.md,
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
    gap: spacing.md,
  },
  cardIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primarySofter,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  cardMeta: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySofter,
  },
  statValue: {
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  statLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 10,
    textAlign: 'center',
  },
  stateCard: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  stateTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 14,
    textAlign: 'center',
  },
  stateText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
