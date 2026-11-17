import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { useClasses } from '../../hooks/useClasses';
import {
  createSchedule,
  getScheduleById,
  updateSchedule,
  validateScheduleInput,
} from '../../services/practicumService';
import type { ScheduleInput } from '../../types/praktikum';
import {
  DAY_OPTIONS,
  addHoursToDateTime,
  fieldForMessage,
  getCourseName,
  getErrorMessage,
  returnToManage,
  toClockTime,
  toDayOfWeek,
  todayDateValue,
} from './crud.utils';
import { TimeField } from './DateTimeField';
import FormScaffold, { FormLoadingScreen } from './FormScaffold';
import {
  FormNote,
  FormPickerField,
  FormReadOnlyField,
  FormTextField,
} from './FormField';
import OptionPicker from './OptionPicker';

type ScheduleField =
  | 'classId'
  | 'courseId'
  | 'dayOfWeek'
  | 'startTime'
  | 'endTime'
  | 'room';

const SCHEDULE_FIELDS: { field: ScheduleField; prefix: string }[] = [
  { field: 'classId', prefix: 'Kelas' },
  { field: 'courseId', prefix: 'Mata kuliah' },
  { field: 'room', prefix: 'Ruangan' },
  { field: 'dayOfWeek', prefix: 'Hari' },
  { field: 'startTime', prefix: 'Waktu mulai' },
  { field: 'endTime', prefix: 'Waktu selesai' },
];

export default function ScheduleFormScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const isEdit = Boolean(id);

  const classes = useClasses();

  const [ready, setReady] = useState(!id);
  const [classId, setClassId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [room, setRoom] = useState('');
  const [classPickerVisible, setClassPickerVisible] = useState(false);
  const [dayPickerVisible, setDayPickerVisible] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<ScheduleField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    getScheduleById(id)
      .then((schedule) => {
        if (cancelled) return;
        if (!schedule) {
          setFormError('Jadwal tidak ditemukan.');
        } else {
          setClassId(schedule.classId);
          setCourseId(schedule.courseId);
          setDayOfWeek(String(schedule.dayOfWeek));
          setStartTime(schedule.startTime);
          setEndTime(schedule.endTime);
          setRoom(schedule.room);
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

  const classOptions = classes.data.map((item) => ({
    value: item.id,
    label: `Kelas ${item.className}`,
    description: getCourseName(item.courseId),
  }));

  const selectedClass = classes.data.find((item) => item.id === classId);
  const courseName = selectedClass
    ? getCourseName(selectedClass.courseId)
    : courseId
      ? getCourseName(courseId)
      : 'Pilih kelas terlebih dahulu';

  const classHint = classes.loading
    ? 'Memuat daftar kelas...'
    : classes.error
      ? classes.error
      : classes.data.length === 0
        ? 'Belum ada kelas. Tambahkan kelas terlebih dahulu.'
        : 'Mata kuliah mengikuti kelas yang dipilih.';

  const handleSelectClass = (value: string) => {
    setClassId(value);
    const selected = classes.data.find((item) => item.id === value);
    if (selected) {
      setCourseId(selected.courseId);
    }
  };

  const handleStartTimeChange = (nextTime: string) => {
    setStartTime(nextTime);
    setEndTime(addHoursToDateTime(todayDateValue(), nextTime, 2).time);
  };

  const handleSubmit = async () => {
    setErrors({});
    setFormError(null);

    const input: ScheduleInput = {
      classId,
      courseId,
      dayOfWeek: toDayOfWeek(dayOfWeek),
      startTime: toClockTime(startTime),
      endTime: toClockTime(endTime),
      room: room.trim(),
    };

    try {
      validateScheduleInput(input);
    } catch (error) {
      const message = getErrorMessage(error);
      const field = fieldForMessage<ScheduleField>(message, SCHEDULE_FIELDS);
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
        await updateSchedule(id, input);
      } else {
        await createSchedule(input);
      }
      returnToManage();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return <FormLoadingScreen title={isEdit ? 'Edit Jadwal' : 'Tambah Jadwal'} />;
  }

  return (
    <FormScaffold
      title={isEdit ? 'Edit Jadwal' : 'Tambah Jadwal'}
      submitLabel="Simpan Jadwal"
      onSubmit={() => {
        void handleSubmit();
      }}
      submitting={submitting}
      formError={formError}
    >
      <FormPickerField
        label="Kelas"
        value={selectedClass ? `Kelas ${selectedClass.className}` : ''}
        placeholder="Pilih kelas"
        error={errors.classId}
        hint={classHint}
        disabled={classes.loading}
        onPress={() => setClassPickerVisible(true)}
      />

      <FormReadOnlyField
        label="Mata kuliah"
        value={courseName}
        hint="Mata kuliah diambil otomatis dari kelas."
      />

      <FormPickerField
        label="Hari"
        value={DAY_OPTIONS.find((option) => option.value === dayOfWeek)?.label ?? ''}
        placeholder="Pilih hari"
        error={errors.dayOfWeek}
        onPress={() => setDayPickerVisible(true)}
      />

      <TimeField
        label="Waktu mulai"
        value={startTime}
        onChange={handleStartTimeChange}
        error={errors.startTime}
        hint="Pilih jam mulai praktikum."
      />

      <TimeField
        label="Waktu selesai"
        value={endTime}
        onChange={setEndTime}
        error={errors.endTime}
        hint="Harus setelah waktu mulai."
      />

      <FormTextField
        label="Ruangan"
        value={room}
        onChangeText={setRoom}
        placeholder="Contoh: Lab Komputer 2"
        error={errors.room}
      />

      <FormNote>Jadwal akan muncul untuk seluruh pengguna yang sudah login.</FormNote>

      <OptionPicker
        visible={classPickerVisible}
        title="Pilih Kelas"
        options={classOptions}
        selectedValue={classId}
        emptyMessage="Belum ada kelas. Tambahkan kelas terlebih dahulu."
        onSelect={handleSelectClass}
        onClose={() => setClassPickerVisible(false)}
      />

      <OptionPicker
        visible={dayPickerVisible}
        title="Pilih Hari"
        options={DAY_OPTIONS}
        selectedValue={dayOfWeek}
        onSelect={setDayOfWeek}
        onClose={() => setDayPickerVisible(false)}
      />
    </FormScaffold>
  );
}
