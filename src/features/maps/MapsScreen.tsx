import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BottomNav from '../../components/BottomNav';
import ScreenHeader from '../../components/ScreenHeader';
import { useAuthSession } from '../auth/AuthSessionContext';
import { useMapUserLocation } from '../../hooks/useMapUserLocation';
import type { LaboratoryRecord } from '../../types/laboratorium';
import type { AuthProfile } from '../auth/authTypes';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import LaboratoryDetails from './LaboratoryDetails';
import { useLaboratoryMapData } from './useLaboratoryMapData';

function isValidCoordinate(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

function MapsScreenContent({ profile }: { profile: AuthProfile }) {
  const {
    laboratories,
    activitiesByLaboratory,
    activitiesLoading,
    activitiesError,
    scheduleError,
  } = useLaboratoryMapData(profile);
  const userLocation = useMapUserLocation();
  const mapRef = useRef<MapView | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const validLaboratories = useMemo(
    () => laboratories.data.filter((laboratory) =>
      isValidCoordinate(laboratory.latitude, laboratory.longitude),
    ),
    [laboratories.data],
  );
  const selectedLaboratory = validLaboratories.find((item) => item.id === selectedId)
    ?? validLaboratories[0]
    ?? null;
  const initialLocation = selectedLaboratory ?? userLocation.location;
  const initialRegion: Region | undefined = initialLocation
    ? {
      latitude: initialLocation.latitude,
      longitude: initialLocation.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }
    : undefined;

  const selectLaboratory = (laboratory: LaboratoryRecord) => {
    setSelectedId(laboratory.id);
    mapRef.current?.animateToRegion({
      latitude: laboratory.latitude,
      longitude: laboratory.longitude,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Maps Laboratorium" eyebrow="LOKASI & AKTIVITAS" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {userLocation.status !== 'ready' ? (
          <View style={styles.locationMessage}>
            {userLocation.status === 'loading' ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons
                name={userLocation.status === 'denied' ? 'location-outline' : 'warning-outline'}
                size={18}
                color={colors.warning}
              />
            )}
            <Text style={styles.locationMessageText}>
              {userLocation.message ?? 'Mencari lokasi perangkat...'}
            </Text>
          </View>
        ) : null}

        {laboratories.loading && validLaboratories.length === 0 && !userLocation.location ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Memuat lokasi laboratorium...</Text>
          </View>
        ) : laboratories.error && validLaboratories.length === 0 && !userLocation.location ? (
          <View style={styles.stateCard}>
            <Ionicons name="cloud-offline-outline" size={26} color={colors.danger} />
            <Text style={styles.stateTitle}>Peta belum dapat dimuat</Text>
            <Text style={styles.stateText}>{laboratories.error}</Text>
          </View>
        ) : validLaboratories.length === 0 && !userLocation.location ? (
          <View style={styles.stateCard}>
            {laboratories.loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Ionicons name="map-outline" size={28} color={colors.primary} />
            )}
            <Text style={styles.stateTitle}>
              {laboratories.loading
                ? 'Memuat lokasi laboratorium...'
                : 'Lokasi laboratorium belum tersedia'}
            </Text>
            <Text style={styles.stateText}>
              {laboratories.error
                ?? 'Marker akan muncul setelah lokasi laboratorium tersimpan.'}
            </Text>
          </View>
        ) : (
          <>
            {laboratories.error ? (
              <Text style={styles.warningText}>{laboratories.error}</Text>
            ) : null}
            {validLaboratories.length === 0 ? (
              <Text style={styles.stateText}>
                Lokasi laboratorium belum tersedia. Lokasi perangkat tetap ditampilkan.
              </Text>
            ) : null}
            {scheduleError ? (
              <Text style={styles.warningText}>
                Informasi ruang jadwal tidak dapat dimuat: {scheduleError}
              </Text>
            ) : null}
            <View style={styles.mapCard}>
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={initialRegion}
                showsUserLocation={false}
                showsMyLocationButton={false}
                accessibilityLabel="Peta lokasi laboratorium"
              >
                {validLaboratories.map((laboratory) => (
                  <Marker
                    key={laboratory.id}
                    coordinate={{
                      latitude: laboratory.latitude,
                      longitude: laboratory.longitude,
                    }}
                    title={laboratory.name}
                    description={`Lantai ${laboratory.lantai}`}
                    pinColor={colors.primary}
                    onPress={() => setSelectedId(laboratory.id)}
                    accessibilityLabel={`Lokasi ${laboratory.name}`}
                  />
                ))}
                {userLocation.location ? (
                  <Marker
                    coordinate={userLocation.location}
                    title="Lokasi Anda"
                    description="Posisi perangkat saat ini"
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges={false}
                    accessibilityLabel="Lokasi perangkat Anda"
                  >
                    <View style={styles.userMarkerOuter}>
                      <View style={styles.userMarkerInner} />
                    </View>
                  </Marker>
                ) : null}
              </MapView>
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={styles.labLegendDot} />
                  <Text style={styles.legendText}>Laboratorium</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={styles.userLegendDot} />
                  <Text style={styles.legendText}>Lokasi Anda</Text>
                </View>
              </View>
            </View>

            {validLaboratories.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.laboratoryList}
              >
                {validLaboratories.map((laboratory) => {
                  const selected = laboratory.id === selectedLaboratory?.id;
                  return (
                    <Pressable
                      key={laboratory.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => selectLaboratory(laboratory)}
                      style={[styles.laboratoryChip, selected && styles.laboratoryChipSelected]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.laboratoryChipText,
                          selected && styles.laboratoryChipTextSelected,
                        ]}
                      >
                        {laboratory.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

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
      <BottomNav />
    </SafeAreaView>
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
      <View style={styles.stateCard}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.stateText}>Memeriksa sesi akun...</Text>
      </View>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  locationMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningBg,
  },
  locationMessageText: {
    flex: 1,
    color: colors.warning,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 17,
  },
  warningText: {
    marginHorizontal: spacing.lg,
    color: colors.danger,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  stateCard: {
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
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
  stateText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  mapCard: {
    height: 310,
    marginHorizontal: spacing.lg,
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  map: { flex: 1 },
  legend: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  labLegendDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  userLegendDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: '#2563EB',
  },
  legendText: { color: colors.textSecondary, fontFamily: fonts.semiBold, fontSize: 10 },
  userMarkerOuter: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: colors.surface,
    backgroundColor: '#2563EB',
  },
  userMarkerInner: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  laboratoryList: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  laboratoryChip: {
    maxWidth: 200,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  laboratoryChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySofter,
  },
  laboratoryChipText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  laboratoryChipTextSelected: { color: colors.primaryDark, fontFamily: fonts.bold },
});
