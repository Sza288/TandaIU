import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { courses } from '../../data/courses';
import { dosen } from '../../data/dosen';
import { useClasses } from '../../hooks/useClasses';
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
  SESSION_STATUS_OPTIONS,
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
  | 'status'
  | 'lecturerId';

const SESSION_FIELDS: { field: SessionField; prefix: string }[] = [
  { field: 'classId', prefix: 'Kelas' },
  { field: 'courseId', prefix: 'Mata kuliah' },
  { field: 'practicumName', prefix: 'Nama praktikum' },
  { field: 'startsAt', prefix: 'Waktu mulai' },
  { field: 'endsAt', prefix: 'Waktu selesai' },
  { field: 'status', prefix: 'Status sesi' },
  { field: 'lecturerId', prefix: 'Dosen' },
  { field: 'lecturerId', prefix: 'Nama dosen' },
];

export default function SessionFormScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const isEdit = Boolean(id);

  const classes = useClasses();

  const [ready, setReady] = useState(!id);
  const [classId, setClassId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [practicumName, setPracticumName] = useState('');
  const [lecturerId, setLecturerId] = useState('');
  const [startDate, setStartDate] = useState(() => todayDateValue());
  const [startTime, setStartTime] = useState('08:00');
  const [endDate, setEndDate] = useState(() => todayDateValue());
  const [endTime, setEndTime] = useState('10:00');
  const [status, setStatus] = useState('terjadwal');
  const [coursePickerVisible, setCoursePickerVisible] = useState(false);
  const [classPickerVisible, setClassPickerVisible] = useState(false);
  const [lecturerPickerVisible, setLecturerPickerVisible] = useState(false);
  const [statusPickerVisible, setStatusPickerVisible] = useState(false);
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
          const startParts = splitDateTimeInput(session.startsAt);
          const endParts = splitDateTimeInput(session.endsAt);
          setStartDate(startParts.date);
          setStartTime(startParts.time);
          setEndDate(endParts.date);
          setEndTime(endParts.time);
          setStatus(session.status);
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

  const availableClasses = courseId
    ? classes.data.filter((classDoc) => classDoc.courseId === courseId)
    : classes.data;

  const classOptions = availableClasses.map((classDoc) => ({
    value: classDoc.id,
    label: `Kelas ${classDoc.className}`,
    description: getCourseName(classDoc.courseId),
  }));

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
    if (endDate === startDate) {
      setEndDate(nextDate);
    }
    setStartDate(nextDate);
  };

  const handleStartTimeChange = (nextTime: string) => {
    setStartTime(nextTime);
    const autoEnd = addHoursToDateTime(startDate, nextTime, 2);
    setEndDate(autoEnd.date);
    setEndTime(autoEnd.time);
  };

  const handleSelectLecturer = (value: string) => {
    setLecturerId(value);
    setErrors((current) => ({ ...current, lecturerId: undefined }));
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

    const input: SessionInput = {
      classId: selectedClass.id,
      courseId: selectedClass.courseId,
      practicumName: selectedCourse.name,
      className: selectedClass.className,
      startsAt: combineDateTime(startDate, startTime),
      endsAt: combineDateTime(endDate, endTime),
      status: status as SessionStatus,
      lecturerId: toLecturerId(lecturerId),
      lecturer: selectedLecturer.name,
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
    return <FormLoadingScreen title={isEdit ? 'Edit Sesi' : 'Tambah Sesi'} />;
  }

  return (
    <FormScaffold
      title={isEdit ? 'Edit Sesi' : 'Tambah Sesi'}
      submitLabel="Simpan Sesi"
      onSubmit={() => {
        void handleSubmit();
      }}
      submitting={submitting}
      formError={formError}
    >
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

      <FormPickerField
        label="Status sesi"
        value={
          SESSION_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? ''
        }
        placeholder="Pilih status"
        error={errors.status}
        onPress={() => setStatusPickerVisible(true)}
      />

      <DateField
        label="Tanggal mulai"
        value={startDate}
        onChange={handleStartDateChange}
      />

      <TimeField
        label="Jam mulai"
        value={startTime}
        onChange={handleStartTimeChange}
        error={errors.startsAt}
        hint="Jam selesai terisi otomatis 2 jam setelah jam mulai."
      />

      <DateField
        label="Tanggal selesai"
        value={endDate}
        onChange={setEndDate}
        hint="Ikuti tanggal mulai, kecuali praktikum selesai di hari lain."
      />

      <TimeField
        label="Jam selesai"
        value={endTime}
        onChange={setEndTime}
        error={errors.endsAt}
        hint="Harus setelah waktu mulai."
      />

      <FormNote>
        Kelas dan dosen wajib dipilih untuk sesi baru maupun perubahan. Waktu menggunakan
        zona waktu perangkat.
      </FormNote>

      <OptionPicker
        visible={coursePickerVisible}
        title="Pilih Mata Kuliah"
        options={COURSE_OPTIONS}
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
        visible={statusPickerVisible}
        title="Pilih Status Sesi"
        options={SESSION_STATUS_OPTIONS}
        selectedValue={status}
        onSelect={setStatus}
        onClose={() => setStatusPickerVisible(false)}
      />
    </FormScaffold>
  );
}
