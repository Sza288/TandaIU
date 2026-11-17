import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { courses } from '../../data/courses';
import {
  createClass,
  getClassById,
  updateClass,
  validateClassInput,
} from '../../services/practicumService';
import type { ClassInput } from '../../types/praktikum';
import {
  COURSE_OPTIONS,
  fieldForMessage,
  getErrorMessage,
  returnToManage,
} from './crud.utils';
import FormScaffold, { FormLoadingScreen } from './FormScaffold';
import {
  FormNote,
  FormPickerField,
  FormReadOnlyField,
  FormTextField,
} from './FormField';
import OptionPicker from './OptionPicker';

type ClassField = 'courseId' | 'className';

const CLASS_FIELDS: { field: ClassField; prefix: string }[] = [
  { field: 'courseId', prefix: 'Mata kuliah' },
  { field: 'className', prefix: 'Nama kelas' },
];

export default function ClassFormScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const isEdit = Boolean(id);

  const [ready, setReady] = useState(!id);
  const [courseId, setCourseId] = useState('');
  const [className, setClassName] = useState('');
  const [createdAt, setCreatedAt] = useState(() => new Date().toISOString());
  const [coursePickerVisible, setCoursePickerVisible] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<ClassField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    getClassById(id)
      .then((classDoc) => {
        if (cancelled) return;
        if (!classDoc) {
          setFormError('Kelas tidak ditemukan.');
        } else {
          setCourseId(classDoc.courseId);
          setClassName(classDoc.className);
          setCreatedAt(classDoc.createdAt);
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

  const handleSubmit = async () => {
    setErrors({});
    setFormError(null);

    const input: ClassInput = {
      courseId,
      className: className.trim(),
      createdAt,
    };

    try {
      validateClassInput(input);
    } catch (error) {
      const message = getErrorMessage(error);
      const field = fieldForMessage<ClassField>(message, CLASS_FIELDS);
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
        await updateClass(id, input);
      } else {
        await createClass(input);
      }
      returnToManage();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return <FormLoadingScreen title={isEdit ? 'Edit Kelas' : 'Tambah Kelas'} />;
  }

  return (
    <FormScaffold
      title={isEdit ? 'Edit Kelas' : 'Tambah Kelas'}
      submitLabel="Simpan Kelas"
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
        hint="Daftar mata kuliah praktikum yang tersedia."
        onPress={() => setCoursePickerVisible(true)}
      />

      <FormTextField
        label="Nama kelas"
        value={className}
        onChangeText={setClassName}
        placeholder="Contoh: A1"
        autoCapitalize="characters"
        error={errors.className}
        hint="Gunakan kode kelas sesuai jadwal, misalnya A1 atau B2."
      />

      {isEdit ? (
        <FormReadOnlyField
          label="Dibuat pada"
          value={new Date(createdAt).toLocaleString('id-ID')}
          hint="Tanggal pembuatan tidak dapat diubah."
        />
      ) : (
        <FormNote>Tanggal pembuatan akan diisi otomatis saat data disimpan.</FormNote>
      )}

      <OptionPicker
        visible={coursePickerVisible}
        title="Pilih Mata Kuliah"
        options={COURSE_OPTIONS}
        selectedValue={courseId}
        onSelect={setCourseId}
        onClose={() => setCoursePickerVisible(false)}
      />
    </FormScaffold>
  );
}
