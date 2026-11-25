import { Ionicons } from '@expo/vector-icons';
import { router, Stack, type Href } from 'expo-router';
import { ReactNode, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { useClasses } from '../../hooks/useClasses';
import { useLaboratories } from '../../hooks/useLaboratories';
import { useSchedules } from '../../hooks/useSchedules';
import { useSessions } from '../../hooks/useSessions';
import {
  deleteSchedule,
} from '../../services/practicumService';
import { deleteLaboratory } from '../../services/laboratoryService';
import type { LaboratoryDoc } from '../../types/praktikum';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import { formatDateShort, formatTimeRange } from '../../utils/format';
import CrudCard from './CrudCard';
import {
  DAY_LABELS,
  confirmAction,
  getCourseName,
  getErrorMessage,
  goBackOr,
  manageHref,
} from './crud.utils';

type TabKey = 'classes' | 'schedules' | 'sessions' | 'laboratories';
type CrudKind = 'class' | 'schedule' | 'session' | 'laboratory';

const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'classes', label: 'Kelas', icon: 'school-outline' },
  { key: 'schedules', label: 'Jadwal', icon: 'calendar-outline' },
  { key: 'sessions', label: 'Sesi', icon: 'time-outline' },
  { key: 'laboratories', label: 'Lab', icon: 'business-outline' },
];

const FORM_PATHS: Record<CrudKind, string> = {
  class: '/assistant/manage/class-form',
  schedule: '/assistant/manage/schedule-form',
  session: '/assistant/manage/session-form',
  laboratory: '/assistant/manage/laboratory-form',
};

export default function ManageScreen() {
  const [tab, setTab] = useState<TabKey>('classes');
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const [deletingLaboratoryId, setDeletingLaboratoryId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sessionQuery, setSessionQuery] = useState('');

  const classes = useClasses();
  const schedules = useSchedules();
  const sessions = useSessions();
  const laboratories = useLaboratories();

  const classById = new Map(classes.data.map((item) => [item.id, item]));
  const laboratoryById = new Map(laboratories.data.map((item) => [item.id, item]));

  /**
   * Hanya sesi `terjadwal` yang ditampilkan: sesi yang sedang dibuka atau sudah
   * ditutup tidak dapat diubah, jadi tidak perlu muncul di pengelolaan.
   */
  const scheduledSessions = useMemo(
    () => sessions.data.filter((item) => item.status === 'terjadwal'),
    [sessions.data],
  );

  const filteredSessions = useMemo(() => {
    const needle = sessionQuery.trim().toLocaleLowerCase('id-ID');
    return scheduledSessions
      .filter((item) => {
        if (!needle) return true;
        return [
          item.practicumName,
          getCourseName(item.courseId),
          item.className,
          item.lecturer ?? '',
        ].some((value) => value.toLocaleLowerCase('id-ID').includes(needle));
      })
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  }, [scheduledSessions, sessionQuery]);

  const resetSessionFilters = () => {
    setSessionQuery('');
  };

  const openForm = (kind: CrudKind, id?: string) => {
    router.push(manageHref(FORM_PATHS[kind], id));
  };

  const runDeleteSchedule = async (id: string) => {
    setDeletingScheduleId(id);
    setDeleteError(null);
    try {
      await deleteSchedule(id);
    } catch (error) {
      setDeleteError(getErrorMessage(error));
    } finally {
      setDeletingScheduleId(null);
    }
  };

  const confirmDeleteSchedule = (id: string) => {
    confirmAction({
      title: 'Hapus jadwal ini?',
      message: 'Data yang dihapus tidak dapat dikembalikan.',
      onConfirm: () => {
        void runDeleteSchedule(id);
      },
    });
  };

  const runDeleteLaboratory = async (id: string) => {
    setDeletingLaboratoryId(id);
    setDeleteError(null);
    try {
      await deleteLaboratory(id);
    } catch (error) {
      setDeleteError(getErrorMessage(error));
    } finally {
      setDeletingLaboratoryId(null);
    }
  };

  const confirmDeleteLaboratory = (laboratory: LaboratoryDoc) => {
    const usedBySession = sessions.data.some((session) => session.laboratoryId === laboratory.id);
    confirmAction({
      title: `Hapus ${laboratory.name}?`,
      message: usedBySession
        ? 'Laboratorium ini dipakai sesi praktikum. Sesi terkait akan kehilangan lokasi presensi dan ditandai belum diatur.'
        : 'Data yang dihapus tidak dapat dikembalikan.',
      onConfirm: () => {
        void runDeleteLaboratory(laboratory.id);
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader
        title="Kelola Praktikum"
        eyebrow="Peran Asisten"
        onBack={() => goBackOr(router, '/assistant')}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {deleteError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{deleteError}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/assistant/manage/enrollments' as Href)}
          style={styles.enrollmentLink}
        >
          <Ionicons name="people-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.enrollmentLinkText}>Kelola enrollment mahasiswa</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.primaryDark} />
        </Pressable>

        <View style={styles.tabs}>
          {TABS.map((item) => {
            const active = item.key === tab;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Tab ${item.label}`}
                onPress={() => setTab(item.key)}
                style={({ pressed }) => [
                  styles.tab,
                  active ? styles.tabActive : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={15}
                  color={active ? colors.textOnPrimary : colors.textSecondary}
                />
                <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'classes' ? (
          <SectionShell
            title="Daftar Kelas"
            addLabel="Tambah Kelas"
            onAdd={() => openForm('class')}
            loading={classes.loading}
            error={classes.error}
            isEmpty={classes.data.length === 0}
            emptyIcon="school-outline"
            emptyTitle="Belum ada kelas"
            emptyBody="Tambahkan kelas praktikum untuk mulai menyusun jadwal."
          >
            {classes.data.map((item) => (
              <CrudCard
                key={item.id}
                icon="school-outline"
                eyebrow={getCourseName(item.courseId)}
                title={`Kelas ${item.className}`}
                onEdit={() => openForm('class', item.id)}
              >
                <Text style={styles.meta}>
                  Dibuat {formatDateShort(item.createdAt)}
                </Text>
              </CrudCard>
            ))}
          </SectionShell>
        ) : null}

        {tab === 'schedules' ? (
          <SectionShell
            title="Daftar Jadwal"
            addLabel="Tambah Jadwal"
            onAdd={() => openForm('schedule')}
            loading={schedules.loading}
            error={schedules.error}
            isEmpty={schedules.data.length === 0}
            emptyIcon="calendar-outline"
            emptyTitle="Belum ada jadwal"
            emptyBody="Jadwal praktikum akan muncul di sini setelah ditambahkan."
          >
            {schedules.data.map((item) => {
              const classDoc = classById.get(item.classId);
              const dayLabel = DAY_LABELS[item.dayOfWeek] ?? '-';

              return (
                <CrudCard
                  key={item.id}
                  icon="calendar-outline"
                  eyebrow={getCourseName(item.courseId)}
                  title={
                    classDoc ? `Kelas ${classDoc.className}` : `Kelas ${item.classId}`
                  }
                  onEdit={() => openForm('schedule', item.id)}
                  onDelete={() => confirmDeleteSchedule(item.id)}
                  deleting={deletingScheduleId === item.id}
                >
                  <Text style={styles.meta}>
                    {dayLabel} · {item.startTime}-{item.endTime}
                  </Text>
                  <Text style={styles.meta}>Ruang {item.room}</Text>
                  <Text style={styles.meta}>
                    {item.jumlahPertemuan
                      ? `${item.jumlahPertemuan} pertemuan`
                      : 'Jumlah pertemuan belum diisi'}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Buat sesi dari jadwal ${item.room}`}
                    onPress={() => router.push(manageHref('/assistant/manage/schedule-generate', item.id))}
                    style={({ pressed }) => [
                      styles.generateButton,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Ionicons name="add-circle-outline" size={15} color={colors.primaryDark} />
                    <Text style={styles.generateText}>Buat Sesi</Text>
                  </Pressable>
                </CrudCard>
              );
            })}
          </SectionShell>
        ) : null}

        {tab === 'sessions' ? (
          <SectionShell
            title="Daftar Sesi"
            addLabel="Tambah Sesi"
            onAdd={() => openForm('session')}
            loading={sessions.loading}
            error={sessions.error}
            isEmpty={sessions.data.length === 0}
            emptyIcon="time-outline"
            emptyTitle="Belum ada sesi"
            emptyBody="Sesi praktikum yang ditambahkan akan tampil di sini."
            emptyAction={null}
          >
            <View style={styles.filterPanel}>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color={colors.primary} />
                <TextInput
                  value={sessionQuery}
                  onChangeText={setSessionQuery}
                  placeholder="Cari praktikum, kelas, atau dosen..."
                  placeholderTextColor={colors.textMuted}
                  style={styles.searchInput}
                  returnKeyType="search"
                  accessibilityLabel="Cari sesi praktikum"
                />
                {sessionQuery.length > 0 ? (
                  <Pressable
                    onPress={() => setSessionQuery('')}
                    accessibilityRole="button"
                    accessibilityLabel="Hapus pencarian sesi"
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.filterFooter}>
                <Text style={styles.filterCount}>
                  {filteredSessions.length} dari {scheduledSessions.length} sesi terjadwal
                </Text>
                {sessionQuery.trim() ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Reset filter sesi"
                    onPress={resetSessionFilters}
                    hitSlop={6}
                  >
                    <Text style={styles.filterReset}>Reset</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {filteredSessions.length === 0 ? (
              <View style={styles.stateCard}>
                <Ionicons name="search-outline" size={30} color={colors.textSecondary} />
                <Text style={styles.stateTitle}>Tidak ada sesi yang cocok</Text>
                <Text style={styles.stateBody}>
                  Ubah kata kunci atau status untuk melihat sesi lain.
                </Text>
              </View>
            ) : (
              filteredSessions.map((item) => {
                const lecturerName = item.lecturer?.trim();
                const laboratoryName = item.laboratoryId
                  ? laboratoryById.get(item.laboratoryId)?.name
                  : undefined;
                // Jadwal sesi hanya boleh dipindah sebelum dibuka. Sesi yang
                // sedang dibuka atau sudah ditutup tidak bisa diedit lagi.
                const editable = item.status === 'terjadwal';

                return (
                  <CrudCard
                    key={item.id}
                    icon="flask-outline"
                    eyebrow={getCourseName(item.courseId)}
                    title={item.practicumName}
                    {...(editable ? { onEdit: () => openForm('session', item.id) } : {})}
                  >
                    <Text style={styles.meta}>
                      Kelas {item.className} · {formatDateShort(item.startsAt)}
                    </Text>
                    <Text style={styles.meta}>
                      {formatTimeRange(item.startsAt, item.endsAt)}
                    </Text>
                    <View style={styles.metaRow}>
                      <Ionicons
                        name="person-outline"
                        size={13}
                        color={lecturerName ? colors.primary : colors.textMuted}
                      />
                      <Text style={[styles.meta, !lecturerName ? styles.metaMuted : null]}>
                        {lecturerName || 'Dosen belum diisi'}
                      </Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Ionicons
                        name="business-outline"
                        size={13}
                        color={laboratoryName ? colors.primary : colors.textMuted}
                      />
                      <Text style={[styles.meta, !laboratoryName ? styles.metaMuted : null]}>
                        {laboratoryName || 'Laboratorium belum diatur'}
                      </Text>
                    </View>
                    <View style={styles.statusRow}>
                      <Text style={styles.meta}>Kelas {item.className}</Text>
                      <StatusBadge status={item.status} />
                    </View>
                  </CrudCard>
                );
              })
            )}
          </SectionShell>
        ) : null}

        {tab === 'laboratories' ? (
          <SectionShell
            title="Daftar Laboratorium"
            addLabel="Tambah Laboratorium"
            onAdd={() => openForm('laboratory')}
            loading={laboratories.loading}
            error={laboratories.error}
            isEmpty={laboratories.data.length === 0}
            emptyIcon="business-outline"
            emptyTitle="Belum ada laboratorium"
            emptyBody="Tambahkan laboratorium agar sesi praktikum dapat dipakai untuk presensi berbasis lokasi."
            emptyAction={null}
          >
            {laboratories.data.map((item) => (
              <CrudCard
                key={item.id}
                icon="business-outline"
                eyebrow={`Lantai ${item.lantai}`}
                title={item.name}
                onEdit={() => openForm('laboratory', item.id)}
                onDelete={() => confirmDeleteLaboratory(item)}
                deleting={deletingLaboratoryId === item.id}
              >
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                  <Text style={styles.meta}>
                    {item.latitude}, {item.longitude}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="radio-outline" size={13} color={colors.textMuted} />
                  <Text style={styles.meta}>Radius {item.radius} m</Text>
                </View>
              </CrudCard>
            ))}
          </SectionShell>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionShell({
  title,
  addLabel,
  onAdd,
  loading,
  error,
  isEmpty,
  emptyIcon,
  emptyTitle,
  emptyBody,
  emptyAction,
  children,
}: {
  title: string;
  addLabel: string;
  onAdd: () => void;
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  emptyIcon: keyof typeof Ionicons.glyphMap;
  emptyTitle: string;
  emptyBody: string;
  emptyAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          onPress={onAdd}
          style={({ pressed }) => [styles.addButton, pressed ? styles.pressed : null]}
        >
          <Ionicons name="add" size={16} color={colors.textOnPrimary} />
          <Text style={styles.addText}>Tambah</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateBody}>Memuat data...</Text>
        </View>
      ) : isEmpty ? (
        <View style={styles.stateCard}>
          <Ionicons name={emptyIcon} size={34} color={colors.textSecondary} />
          <Text style={styles.stateTitle}>{emptyTitle}</Text>
          <Text style={styles.stateBody}>{emptyBody}</Text>
          {emptyAction}
        </View>
      ) : (
        <View style={styles.list}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  enrollmentLink: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySofter,
  },
  enrollmentLinkText: {
    flex: 1,
    color: colors.primaryDark,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  tab: {
    flex: 1,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: radius.pill,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  tabTextActive: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 17,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  addText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  list: {
    gap: spacing.md,
  },
  filterPanel: {
    gap: spacing.sm,
  },
  searchBox: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  filterChips: {
    gap: spacing.xs,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  filterChipText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  filterChipTextActive: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
  },
  filterFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  filterCount: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  filterReset: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  meta: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  metaMuted: {
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  generateButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySofter,
  },
  generateText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 17,
  },
  stateCard: {
    alignItems: 'center',
    gap: spacing.sm,
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
    fontSize: 15,
    textAlign: 'center',
  },
  stateBody: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  seedButton: {
    minHeight: 42,
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  seedButtonDisabled: {
    opacity: 0.6,
  },
  seedText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.82,
  },
});
