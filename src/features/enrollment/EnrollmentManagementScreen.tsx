import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { useClasses } from '../../hooks/useClasses';
import { useEnrollments } from '../../hooks/useEnrollments';
import { useAuthSession } from '../auth/AuthSessionContext';
import {
  createEnrollment,
  deleteEnrollment,
  subscribeToStudentDirectory,
  type StudentDirectoryRecord,
} from '../../services/enrollmentService';
import { colors, fonts, radius, spacing } from '../../theme';
import { getCourseById } from '../../utils/academic';

export default function EnrollmentManagementScreen() {
  const authSession = useAuthSession();
  const profile = authSession?.status === 'authenticated' ? authSession.profile : null;
  const parity = profile?.role === 'asisten' ? profile.assistantSemesterParity : undefined;
  const classes = useClasses();
  const [directoryState, setDirectoryState] = useState<{
    parity: string | null;
    students: StudentDirectoryRecord[];
    error: string | null;
  }>({ parity: null, students: [], error: null });
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentUids, setSelectedStudentUids] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!parity) {
      return undefined;
    }
    const unsubscribe = subscribeToStudentDirectory(
      parity,
      (records) => setDirectoryState({ parity, students: records, error: null }),
      (message) => {
        setDirectoryState({ parity, students: [], error: message });
      },
    );
    return unsubscribe;
  }, [parity]);

  const ownedClasses = classes.data.filter((item) => item.assistantUid === profile?.uid
    && item.semesterParity === parity);
  const selectedClass = ownedClasses.find((item) => item.id === selectedClassId)
    ?? ownedClasses[0];
  const directoryReady = Boolean(parity && directoryState.parity === parity);
  const studentsLoading = Boolean(parity && !directoryReady);
  const visibleStudents = directoryReady ? directoryState.students : [];
  const visibleStudentsError = directoryReady ? directoryState.error : null;
  const enrollments = useEnrollments(selectedClass ? { classId: selectedClass.id } : undefined);
  const enrolledIds = useMemo(
    () => new Set(enrollments.data.map((item) => item.praktikanId)),
    [enrollments.data],
  );
  const matchingStudents = visibleStudents.filter((student) => {
    const query = search.trim().toLocaleLowerCase('id-ID');
    const matchesSearch = !query || student.name.toLocaleLowerCase('id-ID').includes(query)
      || student.studentCode.toLocaleLowerCase('id-ID').includes(query);
    return matchesSearch && student.semester === selectedClass?.semester;
  });
  const selectableStudents = matchingStudents.filter((student) => !enrolledIds.has(student.uid));
  const selectedStudents = selectableStudents.filter((student) => selectedStudentUids.has(student.uid));
  const allSelectableSelected = selectableStudents.length > 0
    && selectableStudents.every((student) => selectedStudentUids.has(student.uid));

  const toggleStudent = (uid: string) => {
    setSelectedStudentUids((current) => {
      const next = new Set(current);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
    setFeedback(null);
  };

  const toggleAllStudents = () => {
    setSelectedStudentUids(allSelectableSelected
      ? new Set()
      : new Set(selectableStudents.map((student) => student.uid)));
    setFeedback(null);
  };

  const removeEnrollment = async (record: { praktikanId: string; praktikanName: string }) => {
    if (!selectedClass) return;
    setRemovingUid(record.praktikanId);
    setFeedback(null);
    try {
      await deleteEnrollment(record.praktikanId, selectedClass.id);
      setFeedback(`${record.praktikanName} dikeluarkan dari kelas ${selectedClass.className}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Gagal mengeluarkan mahasiswa.');
    } finally {
      setRemovingUid(null);
    }
  };

  const submitEnrollment = async () => {
    if (!selectedClass || selectedStudents.length === 0) return;
    setSaving(true);
    setFeedback(null);

    const failed: string[] = [];
    let created = 0;
    for (const student of selectedStudents) {
      try {
        await createEnrollment(student, selectedClass.id);
        created += 1;
      } catch {
        failed.push(student.name);
      }
    }

    if (failed.length === 0) {
      setFeedback(
        `${created} mahasiswa berhasil didaftarkan ke kelas ${selectedClass.className}.`,
      );
    } else if (created === 0) {
      setFeedback(`Pendaftaran gagal untuk ${failed.join(', ')}.`);
    } else {
      setFeedback(
        `${created} mahasiswa terdaftar; gagal untuk ${failed.join(', ')}.`,
      );
    }
    setSelectedStudentUids(new Set(selectableStudents
      .filter((student) => failed.includes(student.name))
      .map((student) => student.uid)));
    setSaving(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader
        eyebrow="Peran Asisten"
        title="Enrollment Mahasiswa"
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.assignment}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.assignmentText}>
            {parity
              ? `Akses dibatasi ke semester ${parity}.`
              : 'Penugasan semester akun ini belum dikonfigurasi admin.'}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Pilih kelas praktikum</Text>
        {classes.loading ? <ActivityIndicator color={colors.primary} /> : null}
        {classes.error ? <Text style={styles.error}>{classes.error}</Text> : null}
        {!classes.loading && !classes.error && ownedClasses.length === 0 ? (
          <Text style={styles.muted}>Belum ada kelas yang ditugaskan ke akun ini.</Text>
        ) : null}
        <View style={styles.classList}>
          {!classes.loading ? ownedClasses.map((item) => {
            const selected = item.id === (selectedClassId || ownedClasses[0]?.id);
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  setSelectedClassId(item.id);
                  setSelectedStudentUids(new Set());
                  setFeedback(null);
                }}
                style={[styles.classOption, selected && styles.classOptionSelected]}
              >
                <Text style={[styles.course, selected && styles.selectedText]}>
                  {getCourseById(item.courseId)?.name ?? item.courseId}
                </Text>
                <Text style={[styles.className, selected && styles.selectedText]}>
                  Kelas {item.className} · Semester {item.semester ?? '—'}
                </Text>
              </Pressable>
            );
          }) : null}
        </View>

        {selectedClass ? (
          <>
            <Text style={styles.sectionTitle}>Mahasiswa</Text>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={19} color={colors.primary} />
              <TextInput
                accessibilityLabel="Cari mahasiswa"
                value={search}
                onChangeText={setSearch}
                placeholder="Cari nama atau NIM"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
              />
              {search ? (
                <Pressable onPress={() => setSearch('')} accessibilityLabel="Hapus pencarian">
                  <Ionicons name="close-circle" size={19} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
            {studentsLoading || enrollments.loading ? <ActivityIndicator color={colors.primary} /> : null}
            {enrollments.error ? <Text style={styles.error}>{enrollments.error}</Text> : null}
            {!studentsLoading && !enrollments.loading && !enrollments.error && !visibleStudentsError
              && visibleStudents.length > 0 && matchingStudents.length > 0 && selectableStudents.length === 0 ? (
                <Text style={styles.muted}>Semua mahasiswa pada daftar ini sudah terdaftar.</Text>
              ) : null}
            {visibleStudentsError ? <Text style={styles.error}>{visibleStudentsError}</Text> : null}
            {!studentsLoading && !visibleStudentsError && visibleStudents.length === 0 ? (
              <Text style={styles.muted}>
                Direktori mahasiswa resmi belum disiapkan. Pendaftaran akan tersedia setelah admin mengisi roster.
              </Text>
            ) : null}
            {!studentsLoading && !enrollments.loading && !enrollments.error
              && !visibleStudentsError && visibleStudents.length > 0 && matchingStudents.length === 0 ? (
              <Text style={styles.muted}>
                Tidak ada mahasiswa semester {selectedClass.semester} yang cocok dengan pencarian ini.
              </Text>
            ) : null}
            {!enrollments.loading && !enrollments.error && selectableStudents.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: allSelectableSelected }}
                onPress={toggleAllStudents}
                style={styles.selectAllRow}
              >
                <Ionicons
                  name={allSelectableSelected ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.selectAllText}>
                  {allSelectableSelected
                    ? 'Batalkan pilihan semua'
                    : `Pilih semua (${selectableStudents.length})`}
                </Text>
              </Pressable>
            ) : null}
            {!enrollments.loading && !enrollments.error && enrollments.data.length > 0 ? (
              <>
                <Text style={styles.subTitle}>
                  Terdaftar di kelas ini ({enrollments.data.length})
                </Text>
                {enrollments.data.map((record) => (
                  <View key={record.id} style={styles.studentRow}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <View style={styles.studentCopy}>
                      <Text style={styles.studentName}>{record.praktikanName}</Text>
                      <Text style={styles.muted}>NIM {record.studentCode}</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Keluarkan ${record.praktikanName}`}
                      disabled={removingUid === record.praktikanId}
                      onPress={() => {
                        void removeEnrollment(record);
                      }}
                      style={({ pressed }) => [
                        styles.removeButton,
                        pressed && removingUid !== record.praktikanId ? styles.removePressed : null,
                        removingUid === record.praktikanId ? styles.removeDisabled : null,
                      ]}
                    >
                      {removingUid === record.praktikanId ? (
                        <ActivityIndicator size="small" color={colors.danger} />
                      ) : (
                        <Text style={styles.removeText}>Keluarkan</Text>
                      )}
                    </Pressable>
                  </View>
                ))}
              </>
            ) : null}
            {!enrollments.loading && !enrollments.error ? matchingStudents.map((student) => {
              const enrolled = enrolledIds.has(student.uid);
              if (enrolled) return null;
              const selected = selectedStudentUids.has(student.uid);
              return (
                <Pressable
                  key={student.uid}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => toggleStudent(student.uid)}
                  style={[styles.studentRow, selected && styles.studentRowSelected]}
                >
                  <Ionicons
                    name={selected ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={colors.primary}
                  />
                  <View style={styles.studentCopy}>
                    <Text style={styles.studentName}>{student.name}</Text>
                    <Text style={styles.muted}>NIM {student.studentCode} · Semester {student.semester}</Text>
                  </View>
                  <Text style={styles.selectLabel}>{selected ? 'Dipilih' : 'Pilih'}</Text>
                </Pressable>
              );
            }) : null}
            {selectedStudents.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                disabled={saving || studentsLoading || enrollments.loading || Boolean(enrollments.error)}
                onPress={() => void submitEnrollment()}
                style={[styles.submitButton, (saving || studentsLoading || enrollments.loading || Boolean(enrollments.error)) && styles.disabledButton]}
              >
                {saving ? <ActivityIndicator color={colors.textOnPrimary} /> : null}
                <Text style={styles.submitText}>
                  Daftarkan {selectedStudents.length} mahasiswa ke Kelas {selectedClass.className}
                </Text>
              </Pressable>
            ) : null}
            {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  assignment: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.primarySofter, borderRadius: radius.md,
  },
  assignmentText: { flex: 1, color: colors.primaryDark, fontFamily: fonts.semiBold, fontSize: 13 },
  sectionTitle: { marginTop: spacing.sm, color: colors.text, fontFamily: fonts.bold, fontSize: 17 },
  classList: { gap: spacing.sm },
  classOption: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, padding: spacing.md, gap: 3 },
  classOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySofter },
  course: { color: colors.textSecondary, fontFamily: fonts.semiBold, fontSize: 12 },
  className: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  selectedText: { color: colors.primaryDark },
  searchBox: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md },
  searchInput: { flex: 1, minHeight: 46, color: colors.text, fontFamily: fonts.regular, fontSize: 14 },
  subTitle: { marginTop: spacing.sm, color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  removeButton: { minHeight: 34, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.dangerBg, backgroundColor: colors.dangerBg },
  removePressed: { opacity: 0.8 },
  removeDisabled: { opacity: 0.6 },
  removeText: { color: colors.danger, fontFamily: fonts.bold, fontSize: 12 },
  selectAllRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.primarySofter },
  selectAllText: { color: colors.primaryDark, fontFamily: fonts.bold, fontSize: 13 },
  studentRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  studentRowSelected: { backgroundColor: colors.primarySofter, borderRadius: radius.sm },
  enrolledRow: { opacity: 0.62 },
  studentCopy: { flex: 1, gap: 3 },
  studentName: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 14 },
  muted: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
  selectLabel: { color: colors.primaryDark, fontFamily: fonts.bold, fontSize: 12 },
  enrolledLabel: { color: colors.success, fontFamily: fonts.bold, fontSize: 12 },
  submitButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.primary },
  disabledButton: { opacity: 0.6 },
  submitText: { color: colors.textOnPrimary, fontFamily: fonts.bold, fontSize: 13 },
  feedback: { color: colors.primaryDark, fontFamily: fonts.semiBold, fontSize: 13 },
  error: { color: colors.danger, fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 19 },
});
