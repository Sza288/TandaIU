import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNav from '../../components/BottomNav';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { useClasses } from '../../hooks/useClasses';
import { useSchedules } from '../../hooks/useSchedules';
import { useSessions } from '../../hooks/useSessions';
import {
  deleteClass,
  deleteSchedule,
  deleteSession,
  seedInitialSessions,
} from '../../services/practicumService';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import { formatDateShort, formatTimeRange } from '../../utils/format';
import CrudCard from './CrudCard';
import {
  DAY_LABELS,
  getCourseName,
  getErrorMessage,
  manageHref,
} from './crud.utils';

type TabKey = 'classes' | 'schedules' | 'sessions';
type CrudKind = 'class' | 'schedule' | 'session';

const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'classes', label: 'Kelas', icon: 'school-outline' },
  { key: 'schedules', label: 'Jadwal', icon: 'calendar-outline' },
  { key: 'sessions', label: 'Sesi', icon: 'time-outline' },
];

const FORM_PATHS: Record<CrudKind, string> = {
  class: '/assistant/manage/class-form',
  schedule: '/assistant/manage/schedule-form',
  session: '/assistant/manage/session-form',
};

export default function ManageScreen() {
  const [tab, setTab] = useState<TabKey>('classes');
  const [deleting, setDeleting] = useState<{ kind: CrudKind; id: string } | null>(null);
  const [seeding, setSeeding] = useState(false);

  const classes = useClasses();
  const schedules = useSchedules();
  const sessions = useSessions();

  const classById = new Map(classes.data.map((item) => [item.id, item]));

  const openForm = (kind: CrudKind, id?: string) => {
    router.push(manageHref(FORM_PATHS[kind], id));
  };

  const runDelete = async (kind: CrudKind, id: string) => {
    setDeleting({ kind, id });
    try {
      if (kind === 'class') {
        await deleteClass(id);
      } else if (kind === 'schedule') {
        await deleteSchedule(id);
      } else {
        await deleteSession(id);
      }
    } catch (error) {
      Alert.alert('Gagal menghapus', getErrorMessage(error));
    } finally {
      setDeleting(null);
    }
  };

  const confirmDelete = (kind: CrudKind, id: string, label: string) => {
    Alert.alert(
      `Hapus ${label}?`,
      'Data yang dihapus tidak dapat dikembalikan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            void runDelete(kind, id);
          },
        },
      ],
    );
  };

  const runSeed = async () => {
    setSeeding(true);
    try {
      const inserted = await seedInitialSessions();
      if (inserted === 0) {
        Alert.alert('Data sudah ada', 'Koleksi sesi sudah berisi data.');
      }
    } catch (error) {
      Alert.alert('Gagal mengisi data awal', getErrorMessage(error));
    } finally {
      setSeeding(false);
    }
  };

  const confirmSeed = () => {
    Alert.alert(
      'Isi data awal',
      'Tambahkan data sesi contoh ke Firestore?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Isi Data',
          onPress: () => {
            void runSeed();
          },
        },
      ],
    );
  };

  const isDeleting = (kind: CrudKind, id: string) =>
    deleting?.kind === kind && deleting.id === id;

  const seedAction = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Isi data awal"
      disabled={seeding}
      onPress={confirmSeed}
      style={({ pressed }) => [
        styles.seedButton,
        seeding ? styles.seedButtonDisabled : null,
        pressed && !seeding ? styles.pressed : null,
      ]}
    >
      {seeding ? (
        <ActivityIndicator size="small" color={colors.textOnPrimary} />
      ) : (
        <>
          <Ionicons name="cloud-download-outline" size={16} color={colors.textOnPrimary} />
          <Text style={styles.seedText}>Isi data awal</Text>
        </>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader
        title="Kelola Praktikum"
        eyebrow="Peran Asisten"
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
            return;
          }
          router.replace('/assistant');
        }}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
                onDelete={() =>
                  confirmDelete('class', item.id, `kelas ${item.className}`)
                }
                deleting={isDeleting('class', item.id)}
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
                  onDelete={() =>
                    confirmDelete('schedule', item.id, 'jadwal ini')
                  }
                  deleting={isDeleting('schedule', item.id)}
                >
                  <Text style={styles.meta}>
                    {dayLabel} · {item.startTime}-{item.endTime}
                  </Text>
                  <Text style={styles.meta}>Ruang {item.room}</Text>
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
            emptyAction={sessions.error ? null : seedAction}
          >
            {sessions.data.map((item) => {
              const lecturerName = item.lecturer?.trim();

              return (
                <CrudCard
                  key={item.id}
                  icon="flask-outline"
                  eyebrow={getCourseName(item.courseId)}
                  title={item.practicumName}
                  onEdit={() => openForm('session', item.id)}
                  onDelete={() =>
                    confirmDelete('session', item.id, item.practicumName)
                  }
                  deleting={isDeleting('session', item.id)}
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
                  <View style={styles.statusRow}>
                    <Text style={styles.meta}>Kelas {item.className}</Text>
                    <StatusBadge status={item.status} />
                  </View>
                </CrudCard>
              );
            })}
          </SectionShell>
        ) : null}
      </ScrollView>

      <BottomNav />
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
