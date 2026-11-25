import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  createLaboratory,
  getLaboratoryById,
  updateLaboratory,
  validateLaboratoryInput,
} from '../../services/laboratoryService';
import { colors, fonts, radius, spacing } from '../../theme';
import { LABORATORY_LIMITS, type LaboratoryInput } from '../../types/praktikum';
import {
  fieldForMessage,
  getErrorMessage,
  returnToManage,
} from './crud.utils';
import FormScaffold, { FormLoadingScreen } from './FormScaffold';
import { FormNote, FormTextField } from './FormField';

type LaboratoryField =
  | 'name'
  | 'latitude'
  | 'longitude'
  | 'radius'
  | 'lantai';

const LABORATORY_FIELDS: { field: LaboratoryField; prefix: string }[] = [
  { field: 'name', prefix: 'Nama laboratorium' },
  { field: 'latitude', prefix: 'Latitude' },
  { field: 'longitude', prefix: 'Longitude' },
  { field: 'radius', prefix: 'Radius' },
  { field: 'lantai', prefix: 'Lantai' },
];

function parseDecimal(value: string): number {
  return Number(value.trim().replace(',', '.'));
}

export default function LaboratoryFormScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const isEdit = Boolean(id);

  const [ready, setReady] = useState(!id);
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('');
  const [lantai, setLantai] = useState('');
  const [createdAt, setCreatedAt] = useState(() => new Date().toISOString());
  const [errors, setErrors] = useState<Partial<Record<LaboratoryField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    getLaboratoryById(id)
      .then((laboratory) => {
        if (cancelled) return;
        if (!laboratory) {
          setFormError('Laboratorium tidak ditemukan.');
        } else {
          setName(laboratory.name);
          setLatitude(String(laboratory.latitude));
          setLongitude(String(laboratory.longitude));
          setRadius(String(laboratory.radius));
          setLantai(String(laboratory.lantai));
          setCreatedAt(laboratory.createdAt);
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

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    setLocationMessage(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationMessage(
          'Izin lokasi ditolak. Isi koordinat secara manual atau aktifkan izin lokasi.',
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLatitude(position.coords.latitude.toFixed(6));
      setLongitude(position.coords.longitude.toFixed(6));
      setErrors((current) => ({ ...current, latitude: undefined, longitude: undefined }));
      setLocationMessage(
        `Koordinat diambil dari perangkat (akurasi ±${Math.round(position.coords.accuracy ?? 0)} m).`,
      );
    } catch (error) {
      setLocationMessage(
        error instanceof Error && error.message
          ? `Lokasi gagal diambil: ${error.message}`
          : 'Lokasi gagal diambil. Coba lagi atau isi koordinat manual.',
      );
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = async () => {
    setErrors({});
    setFormError(null);

    const now = new Date().toISOString();
    const input: LaboratoryInput = {
      name: name.trim(),
      latitude: parseDecimal(latitude),
      longitude: parseDecimal(longitude),
      radius: parseDecimal(radius),
      lantai: parseDecimal(lantai),
      createdAt,
      updatedAt: now,
    };

    try {
      validateLaboratoryInput(input);
    } catch (error) {
      const message = getErrorMessage(error);
      const field = fieldForMessage<LaboratoryField>(message, LABORATORY_FIELDS);
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
        await updateLaboratory(id, input);
      } else {
        await createLaboratory(input);
      }
      returnToManage();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <FormLoadingScreen title={isEdit ? 'Edit Laboratorium' : 'Tambah Laboratorium'} />
    );
  }

  return (
    <FormScaffold
      title={isEdit ? 'Edit Laboratorium' : 'Tambah Laboratorium'}
      submitLabel="Simpan Laboratorium"
      onSubmit={() => {
        void handleSubmit();
      }}
      submitting={submitting}
      formError={formError}
    >
      <FormTextField
        label="Nama laboratorium"
        value={name}
        onChangeText={setName}
        placeholder="Contoh: Laboratorium B"
        error={errors.name}
      />

      <FormTextField
        label="Lantai"
        value={lantai}
        onChangeText={setLantai}
        placeholder="Contoh: 2"
        keyboardType="number-pad"
        error={errors.lantai}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Gunakan lokasi saat ini"
        disabled={locating}
        onPress={() => {
          void handleUseCurrentLocation();
        }}
        style={({ pressed }) => [
          styles.locationButton,
          locating ? styles.locationButtonDisabled : null,
          pressed && !locating ? styles.locationButtonPressed : null,
        ]}
      >
        {locating ? (
          <ActivityIndicator size="small" color={colors.primaryDark} />
        ) : (
          <Ionicons name="locate-outline" size={16} color={colors.primaryDark} />
        )}
        <Text style={styles.locationButtonText}>Gunakan lokasi saat ini</Text>
      </Pressable>

      <Text style={styles.locationHint}>
        Koordinat dapat diambil dari izinkan lokasi perangkat.
      </Text>

      {locationMessage ? (
        <View style={styles.locationNote}>
          <Text style={styles.locationNoteText}>{locationMessage}</Text>
        </View>
      ) : null}

      <FormTextField
        label="Latitude"
        value={latitude}
        onChangeText={setLatitude}
        placeholder="Contoh: -7.048246"
        keyboardType="numbers-and-punctuation"
        error={errors.latitude}
      />

      <FormTextField
        label="Longitude"
        value={longitude}
        onChangeText={setLongitude}
        placeholder="Contoh: 110.440753"
        keyboardType="numbers-and-punctuation"
        error={errors.longitude}
      />

      <FormTextField
        label="Radius presensi (meter)"
        value={radius}
        onChangeText={setRadius}
        placeholder="Contoh: 150"
        keyboardType="number-pad"
        error={errors.radius}
        hint={`Radius ${LABORATORY_LIMITS.minRadius} m sampai ${LABORATORY_LIMITS.maxRadius} m.`}
      />

      <FormNote>
        Radius menentukan jarak maksimum praktikan dari laboratorium saat presensi. Ambil
        koordinat langsung di lokasi agar jarak yang dihitung backend sesuai kondisi asli.
      </FormNote>
    </FormScaffold>
  );
}

const styles = StyleSheet.create({
  locationButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySofter,
  },
  locationButtonDisabled: {
    opacity: 0.6,
  },
  locationButtonPressed: {
    opacity: 0.8,
  },
  locationButtonText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  locationHint: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
  },
  locationNote: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  locationNoteText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },
});
