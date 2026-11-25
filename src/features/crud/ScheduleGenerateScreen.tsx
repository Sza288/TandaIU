import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { dosen } from '../../data/dosen';
import { useLaboratories } from '../../hooks/useLaboratories';
import {
  generateSessionsFromSchedule,
  getScheduleById,
} from '../../services/practicumService';
import type { ScheduleDoc } from '../../types/praktikum';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import {
  DAY_LABELS,
  LECTURER_OPTIONS,
  getCourseName,
  getErrorMessage,
  goBackOr,
  returnToManage,
  scheduleMeetingDates,
  toLecturerId,
  weekdayOfDate,
} from './crud.utils';
import FormScaffold, { FormLoadingScreen } from './FormScaffold';
import { FormNote, FormPickerField, FormReadOnlyField } from './FormField';
import { DateField } from './DateTimeField';
import OptionPicker from './OptionPicker';

export default function ScheduleGenerateScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const laboratories = useLaboratories();

  const [schedule, setSchedule] = useState<ScheduleDoc | null>(null);
  const [ready, setReady] = useState(false);
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lecturerId, setLecturerId] = useState('');
  const [laboratoryId, setLaboratoryId] = useState('');
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [lecturerPickerVisible, setLecturerPickerVisible] = useState(false);
  const [laboratoryPickerVisible, setLaboratoryPickerVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getScheduleById(id)
      .then((result) => {
        if (cancelled) return;
        if (!result) setFormError('Jadwal tidak ditemukan.');
        setSchedule(result);
        setReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFormError(getErrorMessage(error));
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const meetingDates = useMemo(
    () => (schedule
      ? scheduleMeetingDates(schedule.jumlahPertemuan ?? 0, fromDate)
      : []),
    [schedule, fromDate],
  );

  const selectedWeekday = weekdayOfDate(fromDate);
  const weekdayMismatch = Boolean(
    schedule && selectedWeekday !== null && selectedWeekday !== schedule.dayOfWeek,
  );

  const selectedDates = meetingDates.filter((date) => !excluded.has(date));
  const selectedLecturer = dosen.find((item) => item.id === lecturerId);
  const selectedLaboratory = laboratories.data.find((item) => item.id === laboratoryId);
  const activeLaboratories = laboratories.data.filter((item) => item.isActive !== false);
  const scheduleLaboratory = schedule
    ? laboratories.data.find((item) => item.id === schedule.laboratoryId)?.name
      ?? schedule.room
      ?? 'Laboratorium tidak diketahui'
    : '';

  const toggleDate = (date: string) => {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (!schedule) return;
    if (!selectedLecturer) {
      setFormError('Dosen pengampu wajib dipilih.');
      return;
    }
    if (!selectedLaboratory) {
      setFormError('Laboratorium wajib dipilih.');
      return;
    }
    if (selectedDates.length === 0) {
      setFormError('Pilih minimal satu tanggal pertemuan.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await generateSessionsFromSchedule({
        scheduleId: schedule.id,
        dates: selectedDates,
        lecturerId: toLecturerId(lecturerId),
        lecturer: selectedLecturer.name,
        laboratoryId: selectedLaboratory.id,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      });
      if (result.created.length === 0 && result.skipped.length > 0) {
        setFormError('Semua tanggal yang dipilih sudah memiliki sesi.');
        return;
      }
      returnToManage();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return <FormLoadingScreen title="Buat Sesi dari Jadwal" />;
  }

  if (!schedule) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.emptyWrap}>
          <Ionicons name="alert-circle-outline" size={34} color={colors.danger} />
          <Text style={styles.emptyTitle}>Jadwal tidak ditemukan</Text>
          <Text style={styles.emptyBody}>{formError ?? 'Buka kembali dari daftar jadwal.'}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => goBackOr(router, '/assistant/manage')}
            style={styles.emptyButton}
          >
            <Text style={styles.emptyButtonText}>Kembali</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const jumlahPertemuan = schedule.jumlahPertemuan ?? 0;

  return (
    <FormScaffold
      title="Buat Sesi dari Jadwal"
      submitLabel={`Buat ${selectedDates.length} Sesi`}
      onSubmit={() => {
        void handleSubmit();
      }}
      submitting={submitting}
      submitDisabled={jumlahPertemuan === 0}
      formError={formError}
    >
      <FormReadOnlyField
        label="Jadwal"
        value={`${getCourseName(schedule.courseId)} · ${DAY_LABELS[schedule.dayOfWeek] ?? '-'} ${schedule.startTime}-${schedule.endTime}`}
        hint={`Laboratorium ${scheduleLaboratory}`}
      />

      {jumlahPertemuan === 0 ? (
        <FormNote>
          Jadwal ini belum memiliki jumlah pertemuan. Isi dahulu di form jadwal agar sesi dapat
          dibuat.
        </FormNote>
      ) : (
        <FormNote>
          Jadwal menetapkan {jumlahPertemuan} pertemuan. Pilih tanggal mulai, lalu lepas tanggal
          yang tidak dipakai (hari libur atau sesi pengganti).
        </FormNote>
      )}

      <DateField
        label="Tanggal pertemuan pertama"
        value={fromDate}
        onChange={setFromDate}
        hint="Tanggal ini menjadi pertemuan pertama; pertemuan berikutnya tepat seminggu setelahnya."
      />

      {weekdayMismatch ? (
        <FormNote>
          Tanggal yang dipilih bukan hari {DAY_LABELS[schedule.dayOfWeek] ?? '-'} sesuai jadwal
          ({DAY_LABELS[schedule.dayOfWeek] ?? '-'} {schedule.startTime}-{schedule.endTime}). Sesi
          tetap dibuat pada tanggal yang dipilih, berturut-turut setiap minggu.
        </FormNote>
      ) : null}

      <FormPickerField
        label="Dosen pengampu"
        value={selectedLecturer?.name ?? ''}
        placeholder="Pilih dosen pengampu"
        hint="Dipakai untuk semua sesi yang dibuat."
        onPress={() => setLecturerPickerVisible(true)}
      />

      <FormPickerField
        label="Laboratorium"
        value={selectedLaboratory?.name ?? ''}
        placeholder="Pilih laboratorium"
        hint="Dipakai untuk semua sesi yang dibuat."
        disabled={laboratories.loading}
        onPress={() => setLaboratoryPickerVisible(true)}
      />

      {meetingDates.length > 0 ? (
        <View style={styles.dateSection}>
          <Text style={styles.dateTitle}>
            Tanggal pertemuan ({selectedDates.length}/{meetingDates.length} dipilih)
          </Text>
          {meetingDates.map((date, index) => {
            const active = !excluded.has(date);
            return (
              <Pressable
                key={date}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                onPress={() => toggleDate(date)}
                style={[styles.dateRow, active ? styles.dateRowActive : null]}
              >
                <Ionicons
                  name={active ? 'checkbox' : 'square-outline'}
                  size={19}
                  color={active ? colors.primary : colors.textMuted}
                />
                <Text style={styles.dateText}>
                  Pertemuan {index + 1} · {date}
                </Text>
                {!active ? <Text style={styles.dateSkipped}>Dilewati</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <OptionPicker
        visible={lecturerPickerVisible}
        title="Pilih Dosen Pengampu"
        options={LECTURER_OPTIONS}
        selectedValue={lecturerId}
        onSelect={setLecturerId}
        onClose={() => setLecturerPickerVisible(false)}
      />

      <OptionPicker
        visible={laboratoryPickerVisible}
        title="Pilih Laboratorium"
        options={activeLaboratories.map((item) => ({
          value: item.id,
          label: item.name,
          description: `Lantai ${item.lantai} · radius ${item.radius} m`,
        }))}
        selectedValue={laboratoryId}
        onSelect={setLaboratoryId}
        onClose={() => setLaboratoryPickerVisible(false)}
        emptyMessage="Belum ada laboratorium aktif. Tambahkan atau aktifkan laboratorium terlebih dahulu."
      />
    </FormScaffold>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  emptyTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  emptyBody: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyButton: {
    marginTop: spacing.md,
    minHeight: 40,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  emptyButtonText: { color: colors.textOnPrimary, fontFamily: fonts.bold, fontSize: 12 },
  dateSection: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  dateTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  dateRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  dateRowActive: { backgroundColor: colors.primarySofter },
  dateText: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 12 },
  dateSkipped: { color: colors.textMuted, fontFamily: fonts.semiBold, fontSize: 11 },
});
