import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';

import ScreenHeader from '../../components/ScreenHeader';
import { useAuthSession } from '../auth/AuthSessionContext';
import type { AuthProfile } from '../auth/authTypes';
import { colors, fonts, radius, spacing } from '../../theme';
import type { LaboratoryRecord } from '../../types/laboratorium';
import { useMapUserLocation } from '../../hooks/useMapUserLocation';
import LaboratoryDetails from './LaboratoryDetails';
import { useLaboratoryMapData } from './useLaboratoryMapData';

function MapsScreenContent({ profile }: { profile: AuthProfile }) {
  const {
    laboratories,
    activitiesByLaboratory,
    activitiesLoading,
    activitiesError,
    scheduleError,
  } = useLaboratoryMapData(profile);
  const userLocation = useMapUserLocation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedLaboratory = laboratories.data.find((item) => item.id === selectedId)
    ?? laboratories.data[0]
    ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Maps Laboratorium" eyebrow="LOKASI & AKTIVITAS" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.notice}>
          <Ionicons name="map-outline" size={22} color={colors.primary} />
          <Text style={styles.noticeText}>
            Peta interaktif tersedia pada aplikasi Android dan iOS.
          </Text>
        </View>
        {userLocation.message ? (
          <Text style={styles.locationText}>{userLocation.message}</Text>
        ) : userLocation.location ? (
          <Text style={styles.locationText}>
            Lokasi perangkat: {userLocation.location.latitude.toFixed(6)},{' '}
            {userLocation.location.longitude.toFixed(6)}
          </Text>
        ) : null}
        {scheduleError ? (
          <Text style={styles.error}>
            Informasi ruang jadwal tidak dapat dimuat: {scheduleError}
          </Text>
        ) : null}
        {laboratories.loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : laboratories.error ? (
          <Text style={styles.error}>{laboratories.error}</Text>
        ) : laboratories.data.length === 0 ? (
          <Text style={styles.empty}>Lokasi laboratorium belum tersedia.</Text>
        ) : (
          <>
            <Text style={styles.heading}>Pilih laboratorium</Text>
            {laboratories.data.map((laboratory) => (
              <LaboratoryOption
                key={laboratory.id}
                laboratory={laboratory}
                selected={laboratory.id === selectedLaboratory?.id}
                onPress={() => setSelectedId(laboratory.id)}
              />
            ))}
            {selectedLaboratory ? (
              <LaboratoryDetails
                laboratory={selectedLaboratory}
                activities={activitiesByLaboratory.get(selectedLaboratory.id)}
                activitiesLoading={activitiesLoading}
                activitiesError={activitiesError}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LaboratoryOption({
  laboratory,
  selected,
  onPress,
}: {
  laboratory: LaboratoryRecord;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected]}
    >
      <Ionicons name="location-outline" size={19} color={colors.primary} />
      <View style={styles.optionCopy}>
        <Text style={styles.optionTitle}>{laboratory.name}</Text>
        <Text style={styles.optionMeta}>
          {laboratory.latitude.toFixed(6)}, {laboratory.longitude.toFixed(6)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function MapsScreen() {
  const authSession = useAuthSession();
  if (authSession?.status === 'authenticated') {
    return <MapsScreenContent profile={authSession.profile} />;
  }
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Maps Laboratorium" eyebrow="LOKASI & AKTIVITAS" />
      <ActivityIndicator color={colors.primary} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl, gap: spacing.md },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySofter,
  },
  noticeText: { flex: 1, color: colors.primaryDark, fontFamily: fonts.semiBold, fontSize: 13 },
  locationText: {
    marginHorizontal: spacing.lg,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  heading: {
    marginHorizontal: spacing.lg,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySofter },
  optionCopy: { flex: 1, gap: 3 },
  optionTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  optionMeta: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 12 },
  empty: { marginHorizontal: spacing.lg, color: colors.textSecondary, fontFamily: fonts.regular },
  error: { marginHorizontal: spacing.lg, color: colors.danger, fontFamily: fonts.semiBold },
});
