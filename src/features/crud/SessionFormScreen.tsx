import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { courses } from '../../data/courses';
import { dosen } from '../../data/dosen';
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
  fieldForMessage,
  fromDateTimeInput,
  getErrorMessage,
  getLecturerName,
  returnToManage,
  toDateTimeInput,
  toLecturerId,
} from './crud.utils';
import FormScaffold, { FormLoadingScreen } from './FormScaffold';
import {
  FormNote,
  FormPickerField,
  FormReadOnlyField,
  FormTextField,
} from './FormField';
import OptionPicker from './OptionPicker';

type SessionField =
  | 'courseId'
  | 'practicumName'
  | 'className'
  | 'startsAt'
  | 'endsAt'
  | 'status'
  | 'lecturerId';

const SESSION_FIELDS: { field: SessionField; prefix: string }[] = [
  { field: 'courseId', prefix: 'Mata kuliah' },
  { field: 'practicumName', prefix: 'Nama praktikum' },
  { field: 'className', prefix: 'Kelas' },
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

  const [ready, setReady] = useState(!id);
  const [courseId, setCourseId] = useState('');
  const [practicumName, setPracticumName] = useState('');
  const [className, setClassName] = useState('');
  const [lecturerId, setLecturerId] = useState('');
  const [startsAtInput, setStartsAtInput] = useState('');
  const [endsAtInput, setEndsAtInput] = useState('');
  const [status, setStatus] = useState('terjadwal');
  const [coursePickerVisible, setCoursePickerVisible] = useState(false);
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
          setCourseId(session.courseId);
          setPracticumName(session.practicumName);
          setClassName(session.className);
          setLecturerId(session.lecturerId ?? '');
          setStartsAtInput(toDateTimeInput(session.startsAt));
          setEndsAtInput(toDateTimeInput(session.endsAt));
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
  const selectedLecturer = dosen.find((lecturer) => lecturer.id === lecturerId);

  const handleSubmit = async () => {
    setErrors({});
    setFormError(null);

    const input: SessionInput = {
      courseId,
      practicumName: selectedCourse?.name ?? practicumName,
      className: className.trim(),
      startsAt: fromDateTimeInput(startsAtInput),
      endsAt: fromDateTimeInput(endsAtInput),
      status: status as SessionStatus,
      lecturerId: toLecturerId(lecturerId),
      lecturer: selectedLecturer?.name ?? '',
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

    if (!selectedLecturer) {
      setErrors({ lecturerId: 'Dosen pengampu wajib dipilih.' });
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
        value={selectedCourse?.name ?? (practicumName || 'Pilih mata kuliah')}
      />

      <FormTextField
        label="Nama kelas"
        value={className}
        onChangeText={setClassName}
        placeholder="Contoh: A1"
        autoCapitalize="characters"
        error={errors.className}
      />

      <FormPickerField
        label="Dosen pengampu"
        value={getLecturerName(lecturerId) ?? ''}
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

      <FormTextField
        label="Waktu mulai"
        value={startsAtInput}
        onChangeText={setStartsAtInput}
        placeholder="2026-11-20T08:00"
        autoCapitalize="none"
        error={errors.startsAt}
        hint="Format YYYY-MM-DDTHH:mm, contoh 2026-11-20T08:00."
      />

      <FormTextField
        label="Waktu selesai"
        value={endsAtInput}
        onChangeText={setEndsAtInput}
        placeholder="2026-11-20T10:00"
        autoCapitalize="none"
        error={errors.endsAt}
        hint="Harus setelah waktu mulai."
      />

      <FormNote>
        Waktu menggunakan zona waktu perangkat. Dosen wajib dipilih untuk sesi baru maupun
        perubahan.
      </FormNote>

      <OptionPicker
        visible={coursePickerVisible}
        title="Pilih Mata Kuliah"
        options={COURSE_OPTIONS}
        selectedValue={courseId}
        onSelect={setCourseId}
        onClose={() => setCoursePickerVisible(false)}
      />

      <OptionPicker
        visible={lecturerPickerVisible}
        title="Pilih Dosen Pengampu"
        options={LECTURER_OPTIONS}
        selectedValue={lecturerId}
        onSelect={setLecturerId}
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
