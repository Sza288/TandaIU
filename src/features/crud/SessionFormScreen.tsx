import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { courses } from '../../data/courses';
import { dosen } from '../../data/dosen';
import { useClasses } from '../../hooks/useClasses';
import { useLaboratories } from '../../hooks/useLaboratories';
import { useAuthSession } from '../auth/AuthSessionContext';
import {
  createSession,
  getSessionById,
  updateSession,
  validateSessionInput,
} from '../../services/practicumService';
import type { SessionStatus } from '../../types';
import type { SessionInput } from '../../types/praktikum';
import {
  COURSE_OPTIONS,
  LECTURER_OPTIONS,
  addHoursToDateTime,
  combineDateTime,
  fieldForMessage,
  getCourseName,
  getErrorMessage,
  returnToManage,
  splitDateTimeInput,
  toLecturerId,
  todayDateValue,
} from './crud.utils';
import { DateField, TimeField } from './DateTimeField';
import FormScaffold, { FormLoadingScreen } from './FormScaffold';
import { FormNote, FormPickerField, FormReadOnlyField } from './FormField';
import OptionPicker from './OptionPicker';

type SessionField =
  | 'classId'
  | 'courseId'
  | 'practicumName'
  | 'startsAt'
  | 'endsAt'
  | 'lecturerId'
  | 'laboratoryId';

const SESSION_FIELDS: { field: SessionField; prefix: string }[] = [
  { field: 'classId', prefix: 'Kelas' },
  { field: 'courseId', prefix: 'Mata kuliah' },
  { field: 'practicumName', prefix: 'Nama praktikum' },
  { field: 'startsAt', prefix: 'Waktu mulai' },
  { field: 'endsAt', prefix: 'Waktu selesai' },
  { field: 'lecturerId', prefix: 'Dosen' },
  { field: 'lecturerId', prefix: 'Nama dosen' },
  { field: 'laboratoryId', prefix: 'Laboratorium' },
];

export default function SessionFormScreen() {
  const authSession = useAuthSession();
  const parity = authSession?.status === 'authenticated' && authSession.profile.role === 'asisten'
    ? authSession.profile.assistantSemesterParity
    : undefined;
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const isEdit = Boolean(id);

  const classes = useClasses();
  const laboratories = useLaboratories();

  const [ready, setReady] = useState(!id);
  const [classId, setClassId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [practicumName, setPracticumName] = useState('');
  const [lecturerId, setLecturerId] = useState('');
  const [laboratoryId, setLaboratoryId] = useState('');
  const [startDate, setStartDate] = useState(() => todayDateValue());
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [originalStartsAt, setOriginalStartsAt] = useState<string>();
  const [originalStatus, setOriginalStatus] = useState<SessionStatus>('terjadwal');
  const [coursePickerVisible, setCoursePickerVisible] = useState(false);
  const [classPickerVisible, setClassPickerVisible] = useState(false);
  const [lecturerPickerVisible, setLecturerPickerVisible] = useState(false);
  const [laboratoryPickerVisible, setLaboratoryPickerVisible] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<SessionField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    getSessionById(id)
      .then((session) => {
        if (cancelled) return;
        if (!session) {
          setFormError('Sesi tidak ditemukan.');
        } else {
          setClassId(session.classId ?? '');
          setCourseId(session.courseId);
          setPracticumName(session.practicumName);
          setLecturerId(session.lecturerId ?? '');
          setLaboratoryId(session.laboratoryId ?? '');
          setOriginalStartsAt(session.startsAt);
          const startParts = splitDateTimeInput(session.startsAt);
          const endParts = splitDateTimeInput(session.endsAt);
          setStartDate(startParts.date);
          setStartTime(startParts.time);
          setEndTime(endParts.time);
          setOriginalStatus(session.status);
        }
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

  const selectedCourse = courses.find((course) => course.id === courseId);
  const selectedClass = classes.data.find((classDoc) => classDoc.id === classId);
  const selectedLecturer = dosen.find((lecturer) => lecturer.id === lecturerId);
  const courseOptions = COURSE_OPTIONS.filter((option) => {
    const course = courses.find((item) => item.id === option.value);
    return parity && course && (course.semester % 2 === 1 ? 'ganjil' : 'genap') === parity;
  });

  const availableClasses = courseId
    ? classes.data.filter((classDoc) => classDoc.courseId === courseId)
    : classes.data;

  const classOptions = availableClasses.map((classDoc) => ({
    value: classDoc.id,
    label: `Kelas ${classDoc.className}`,
    description: getCourseName(classDoc.courseId),
  }));

  const selectedLaboratory = laboratories.data.find(
    (laboratory) => laboratory.id === laboratoryId,
  );

  /**
   * Laboratorium nonaktif tidak boleh dipakai untuk sesi baru maupun sesi yang
   * sedang diedit, tetapi tetap ditampilkan bila sesi ini sudah memakainya agar
   * pilihan lama tidak hilang diam-diam.
   */
  const selectableLaboratories = laboratories.data.filter(
    (laboratory) => laboratory.isActive !== false || laboratory.id === laboratoryId,
  );

  const laboratoryOptions = selectableLaboratories.map((laboratory) => ({
    value: laboratory.id,
    label: laboratory.name,
    description: `Lantai ${laboratory.lantai} · radius ${laboratory.radius} m`,
  }));

  const laboratoryHint = laboratories.loading
    ? 'Memuat daftar laboratorium...'
    : laboratories.error
      ? laboratories.error
      : selectableLaboratories.length === 0
        ? 'Belum ada laboratorium aktif. Tambahkan atau aktifkan laboratorium lebih dahulu agar sesi dapat dipakai untuk presensi.'
        : 'Laboratorium menentukan lokasi dan radius presensi sesi ini.';

  const classHint = classes.loading
    ? 'Memuat daftar kelas...'
    : classes.error
      ? classes.error
      : availableClasses.length === 0
        ? courseId
          ? 'Belum ada kelas untuk mata kuliah ini.'
          : 'Pilih mata kuliah atau tambahkan kelas terlebih dahulu.'
        : 'Kelas menentukan mata kuliah dan nama kelas sesi.';

  const handleSelectCourse = (value: string) => {
    setCourseId(value);
    setErrors((current) => ({ ...current, courseId: undefined }));
    if (!selectedClass || selectedClass.courseId !== value) {
      setClassId('');
    }
  };

  const handleSelectClass = (value: string) => {
    const classDoc = classes.data.find((item) => item.id === value);
    setClassId(value);
    setErrors((current) => ({ ...current, classId: undefined }));
    if (classDoc) {
      setCourseId(classDoc.courseId);
    }
  };

  const handleStartDateChange = (nextDate: string) => {
    setStartDate(nextDate);
  };

  const handleStartTimeChange = (nextTime: string) => {
    setStartTime(nextTime);
    const autoEnd = addHoursToDateTime(startDate, nextTime, 2);
    setEndTime(autoEnd.time);
  };

  /**
   * Sesi hanya punya satu tanggal. `endsAt` jatuh pada tanggal yang sama, kecuali
   * jam selesai lebih kecil dari jam mulai (praktikum melewati tengah malam).
   */
  const resolveEndDateTime = (): string => {
    const crossesMidnight = endTime <= startTime;
    if (!crossesMidnight) {
      return combineDateTime(startDate, endTime);
    }
    const nextDay = addHoursToDateTime(startDate, startTime, 24).date;
    return combineDateTime(nextDay, endTime);
  };

  const handleSelectLecturer = (value: string) => {
    setLecturerId(value);
    setErrors((current) => ({ ...current, lecturerId: undefined }));
  };

  const handleSelectLaboratory = (value: string) => {
    setLaboratoryId(value);
    setErrors((current) => ({ ...current, laboratoryId: undefined }));
  };

  const handleSubmit = async () => {
    setErrors({});
    setFormError(null);

    if (!selectedClass) {
      setErrors({ classId: 'Kelas wajib dipilih.' });
      return;
    }

    if (!selectedCourse) {
      setErrors({ courseId: 'Mata kuliah wajib dipilih.' });
      return;
    }

    if (!selectedLecturer) {
      setErrors({ lecturerId: 'Dosen pengampu wajib dipilih.' });
      return;
    }

    if (!id && !selectedLaboratory) {
      setErrors({ laboratoryId: 'Laboratorium wajib dipilih.' });
      return;
    }

    const input: SessionInput = {
      classId: selectedClass.id,
      courseId: selectedClass.courseId,
      practicumName: selectedCourse.name,
      className: selectedClass.className,
      startsAt: combineDateTime(startDate, startTime, originalStartsAt),
      endsAt: resolveEndDateTime(),
      // Status tidak diedit di sini: sesi baru selalu 'terjadwal', dan perubahan
      // status hanya lewat aksi buka/tutup sesi milik asisten.
      status: isEdit ? originalStatus : 'terjadwal',
      lecturerId: toLecturerId(lecturerId),
      lecturer: selectedLecturer.name,
      ...(selectedLaboratory ? { laboratoryId: selectedLaboratory.id } : {}),
    };

    try {
      validateSessionInput(input);
    } catch (error) {
      const message = getErrorMessage(error);
      const field = fieldForMessage<SessionField>(message, SESSION_FIELDS);
      if (field) {
        setErrors({ [field]: message });
      } else {
        setFormError(message);
      }
      return;
    }

    setSubmitting(true);
    try {
      if (id) {
        await updateSession(id, input);
      } else {
        await createSession(input);
      }
      returnToManage();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return <FormLoadingScreen title={isEdit ? 'Pindah Jadwal Sesi' : 'Tambah Sesi'} />;
  }

  return (
    <FormScaffold
      title={isEdit ? 'Pindah Jadwal Sesi' : 'Tambah Sesi'}
      submitLabel="Simpan Sesi"
      onSubmit={() => {
        void handleSubmit();
      }}
      submitting={submitting}
      formError={formError}
    >
      {isEdit ? (
        <>
          <FormReadOnlyField
            label="Mata kuliah"
            value={selectedCourse?.name ?? practicumName}
            hint="Mata kuliah tidak diubah saat sesi dipindahkan."
          />

          <FormReadOnlyField
            label="Kelas"
            value={selectedClass ? `Kelas ${selectedClass.className}` : ''}
            hint="Kelas sesi tidak berubah."
          />

          {lecturerId ? null : (
            <FormPickerField
              label="Dosen pengampu"
              value={selectedLecturer?.name ?? ''}
              placeholder="Pilih dosen pengampu"
              error={errors.lecturerId}
              hint="Sesi ini belum memiliki dosen, pilih salah satu dosen yang tersedia."
              onPress={() => setLecturerPickerVisible(true)}
            />
          )}

          <FormNote>
            Ubah tanggal dan jam untuk memindahkan sesi ini ke jadwal lain, lalu pilih
            laboratorium bila lokasinya ikut berpindah.
          </FormNote>
        </>
      ) : (
        <>
          <FormPickerField
            label="Mata kuliah"
            value={selectedCourse?.name ?? ''}
            placeholder="Pilih mata kuliah"
            error={errors.courseId}
            hint="Nama praktikum mengikuti mata kuliah yang dipilih."
            onPress={() => setCoursePickerVisible(true)}
          />

          <FormReadOnlyField
            label="Nama praktikum"
            value={selectedCourse?.name ?? practicumName}
            placeholder="Pilih mata kuliah"
            hint="Nama praktikum mengikuti mata kuliah yang dipilih."
          />

          <FormPickerField
            label="Kelas"
            value={selectedClass ? `Kelas ${selectedClass.className}` : ''}
            placeholder="Pilih kelas"
            error={errors.classId}
            hint={classHint}
            disabled={classes.loading}
            onPress={() => setClassPickerVisible(true)}
          />

          <FormPickerField
            label="Dosen pengampu"
            value={selectedLecturer?.name ?? ''}
            placeholder="Pilih dosen pengampu"
            error={errors.lecturerId}
            hint="Pilih salah satu dosen yang tersedia."
            onPress={() => setLecturerPickerVisible(true)}
          />
        </>
      )}

      <FormPickerField
        label="Laboratorium"
        value={selectedLaboratory?.name ?? ''}
        placeholder="Pilih laboratorium"
        error={errors.laboratoryId}
        hint={laboratoryHint}
        disabled={laboratories.loading}
        onPress={() => setLaboratoryPickerVisible(true)}
      />

      <DateField
        label="Tanggal"
        value={startDate}
        onChange={handleStartDateChange}
        hint="Tanggal pertemuan sesi ini."
      />

      <TimeField
        label="Jam mulai"
        value={startTime}
        onChange={handleStartTimeChange}
        error={errors.startsAt}
        hint="Jam selesai terisi otomatis 2 jam setelah jam mulai."
      />

      <TimeField
        label="Jam selesai"
        value={endTime}
        onChange={setEndTime}
        error={errors.endsAt}
      />

      <OptionPicker
        visible={coursePickerVisible}
        title="Pilih Mata Kuliah"
        options={courseOptions}
        selectedValue={courseId}
        onSelect={handleSelectCourse}
        onClose={() => setCoursePickerVisible(false)}
      />

      <OptionPicker
        visible={classPickerVisible}
        title="Pilih Kelas"
        options={classOptions}
        selectedValue={classId}
        onSelect={handleSelectClass}
        onClose={() => setClassPickerVisible(false)}
      />

      <OptionPicker
        visible={lecturerPickerVisible}
        title="Pilih Dosen Pengampu"
        options={LECTURER_OPTIONS}
        selectedValue={lecturerId}
        onSelect={handleSelectLecturer}
        onClose={() => setLecturerPickerVisible(false)}
      />

      <OptionPicker
        visible={laboratoryPickerVisible}
        title="Pilih Laboratorium"
        options={laboratoryOptions}
        selectedValue={laboratoryId}
        onSelect={handleSelectLaboratory}
        onClose={() => setLaboratoryPickerVisible(false)}
      />
    </FormScaffold>
  );
}
