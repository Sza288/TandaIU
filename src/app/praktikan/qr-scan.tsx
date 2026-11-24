import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/ScreenHeader';
import { useSessions } from '../../hooks/useSessions';
import {
  submitQrAttendance,
  validateAttendanceQr,
} from '../../services/attendanceService';
import { colors, fonts, radius, spacing } from '../../theme';
import type { MutationResult } from '../../types';
import { acquireDeviceLocation } from '../../utils/location';
import { parseAttendanceQrPayload } from '../../utils/attendanceQr';

type Feedback = {
  tone: 'info' | 'success' | 'error';
  message: string;
};

type RetryMode = 'scan' | 'location' | null;

export default function PractikanQrScanScreen() {
  const params = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const sessionResult = useSessions();
  const session = sessionResult.data.find((item) => item.id === sessionId);
  const [permission, requestPermission] = useCameraPermissions();
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [retryMode, setRetryMode] = useState<RetryMode>(null);
  const [pendingPayload, setPendingPayload] = useState<string | null>(null);
  const [result, setResult] = useState<MutationResult | null>(null);
  const permissionRequested = useRef(false);
  const scanLocked = useRef(false);

  const requestCameraPermission = useCallback(async () => {
    setRequestingPermission(true);
    try {
      await requestPermission();
    } catch {
      setFeedback({
        tone: 'error',
        message: 'Izin kamera tidak dapat diminta. Periksa pengaturan perangkat lalu coba lagi.',
      });
    } finally {
      setRequestingPermission(false);
    }
  }, [requestPermission]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/praktikan/attendance');
  }, []);

  useEffect(() => {
    if (!permission || permission.granted || permissionRequested.current || !permission.canAskAgain) {
      return;
    }
    permissionRequested.current = true;
    void requestCameraPermission();
  }, [permission, requestCameraPermission]);

  const submitWithLocation = useCallback(async (payload: string) => {
    if (!sessionId || busy) return;
    setBusy(true);
    setRetryMode(null);
    setFeedback({ tone: 'info', message: 'QR terverifikasi. Mengambil lokasi perangkat...' });
    const location = await acquireDeviceLocation();
    if (!location.ok) {
      setBusy(false);
      setRetryMode('location');
      setFeedback({ tone: 'error', message: location.reason });
      return;
    }

    setFeedback({ tone: 'info', message: 'Memvalidasi lokasi dan menyimpan presensi di server...' });
    let attendanceResult: MutationResult;
    try {
      attendanceResult = await submitQrAttendance(sessionId, payload, {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracyMeters: location.accuracyMeters,
      });
    } catch {
      setBusy(false);
      setPendingPayload(null);
      setRetryMode('scan');
      setFeedback({
        tone: 'error',
        message: 'Layanan presensi tidak merespons. Periksa koneksi lalu pindai ulang QR.',
      });
      return;
    }
    setBusy(false);
    setResult(attendanceResult);
    if (attendanceResult.ok) {
      setPendingPayload(null);
      const locationSummary = [
        typeof attendanceResult.distanceMeters === 'number'
          ? `jarak ${Math.round(attendanceResult.distanceMeters)} m`
          : null,
        typeof attendanceResult.accuracyMeters === 'number'
          ? `akurasi ${Math.round(attendanceResult.accuracyMeters)} m`
          : null,
      ].filter((value): value is string => value !== null).join('; ');
      setFeedback({
        tone: 'success',
        message: `Presensi QR berhasil.${locationSummary ? ` ${locationSummary}.` : ''}`,
      });
      return;
    }
    setPendingPayload(null);
    setRetryMode('scan');
    setFeedback({
      tone: 'error',
      message: attendanceResult.reason ?? 'Presensi QR ditolak. Silakan coba lagi.',
    });
  }, [busy, sessionId]);

  const handleBarcodeScanned = useCallback(async ({ data }: BarcodeScanningResult) => {
    if (scanLocked.current || busy || !sessionId) return;
    scanLocked.current = true;

    if (!parseAttendanceQrPayload(data)) {
      setRetryMode('scan');
      setFeedback({
        tone: 'error',
        message: 'Format QR tidak valid. Pindai QR presensi yang ditampilkan asisten.',
      });
      return;
    }

    setBusy(true);
    setFeedback({ tone: 'info', message: 'Memvalidasi QR dengan server...' });
    let validation: Awaited<ReturnType<typeof validateAttendanceQr>>;
    try {
      validation = await validateAttendanceQr(sessionId, data);
    } catch {
      setBusy(false);
      setRetryMode('scan');
      setFeedback({
        tone: 'error',
        message: 'Layanan validasi QR tidak merespons. Periksa koneksi lalu coba lagi.',
      });
      return;
    }
    setBusy(false);
    if (!validation.ok) {
      setRetryMode('scan');
      setFeedback({ tone: 'error', message: validation.reason });
      return;
    }

    setPendingPayload(data);
    await submitWithLocation(data);
  }, [busy, sessionId, submitWithLocation]);

  const handleRetry = () => {
    if (retryMode === 'location' && pendingPayload) {
      void submitWithLocation(pendingPayload);
      return;
    }
    scanLocked.current = false;
    setRetryMode(null);
    setPendingPayload(null);
    setFeedback(null);
    setResult(null);
    setCameraError(false);
  };

  if (!sessionId) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ScreenHeader eyebrow="Praktikan" title="Scan QR Asprak" onBack={handleBack} />
        <View style={styles.messageCard}>
          <Text style={styles.messageTitle}>Sesi tidak dipilih</Text>
          <Text style={styles.messageText}>Kembali ke halaman presensi dan pilih sesi terbuka.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader eyebrow="Praktikan" title="Scan QR Asprak" onBack={handleBack} />
      <View style={styles.content}>
        <View style={styles.sessionCard}>
          <Text style={styles.sessionTitle}>{session?.practicumName ?? 'Sesi praktikum'}</Text>
          <Text style={styles.sessionMeta}>
            {session ? `Kelas ${session.className}` : `Sesi ${sessionId}`}
          </Text>
          <Text style={styles.sessionMeta}>
            Status dari server akan diperiksa saat QR divalidasi.
          </Text>
        </View>

        {result?.ok ? (
          <View style={styles.messageCard}>
            <Ionicons name="checkmark-circle" size={42} color={colors.success} />
            <Text style={styles.messageTitle}>Presensi tercatat</Text>
            <Text style={styles.messageText}>{feedback?.message}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={handleBack}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>Kembali ke Presensi</Text>
            </Pressable>
          </View>
        ) : permission === null || requestingPermission ? (
          <View style={styles.messageCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.messageText}>
              {requestingPermission ? 'Meminta izin kamera...' : 'Memeriksa izin kamera...'}
            </Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.messageCard}>
            <Ionicons name="camera-outline" size={36} color={colors.primary} />
            <Text style={styles.messageTitle}>Izin kamera diperlukan</Text>
            <Text style={styles.messageText}>
              Izinkan akses kamera untuk memindai QR yang ditampilkan asisten.
            </Text>
            {feedback?.tone === 'error' ? (
              <Text style={styles.permissionError}>{feedback.message}</Text>
            ) : null}
            {permission.canAskAgain ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  permissionRequested.current = true;
                  void requestCameraPermission();
                }}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>Minta Izin Kamera</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void Linking.openSettings().catch(() => {
                    setFeedback({ tone: 'error', message: 'Pengaturan perangkat tidak dapat dibuka.' });
                  });
                }}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>Buka Pengaturan</Text>
              </Pressable>
            )}
          </View>
        ) : cameraError ? (
          <View style={styles.messageCard}>
            <Ionicons name="camera-reverse-outline" size={36} color={colors.danger} />
            <Text style={styles.messageTitle}>Kamera tidak tersedia</Text>
            <Text style={styles.messageText}>
              Kamera tidak dapat dibuka. Tutup aplikasi lain yang menggunakan kamera lalu coba lagi.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={handleRetry}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>Coba Lagi</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.cameraFrame}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleBarcodeScanned}
                onMountError={() => setCameraError(true)}
              />
              <View pointerEvents="none" style={styles.scanFrame}>
                <View style={styles.scanCornerTopLeft} />
                <View style={styles.scanCornerTopRight} />
                <View style={styles.scanCornerBottomLeft} />
                <View style={styles.scanCornerBottomRight} />
              </View>
              {busy ? (
                <View style={styles.cameraOverlay}>
                  <ActivityIndicator color="#fff" size="large" />
                  <Text style={styles.overlayText}>Mohon tunggu...</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.instruction}>
              Arahkan kamera ke QR yang sedang ditampilkan asisten. Presensi tetap memerlukan
              lokasi dalam radius laboratorium.
            </Text>
            {feedback ? (
              <View
                accessibilityLiveRegion="polite"
                style={[
                  styles.feedback,
                  feedback.tone === 'error' && styles.feedbackError,
                  feedback.tone === 'info' && styles.feedbackInfo,
                ]}
              >
                <Text style={styles.feedbackText}>{feedback.message}</Text>
              </View>
            ) : null}
            {retryMode ? (
              <Pressable
                accessibilityRole="button"
                onPress={handleRetry}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>
                  {retryMode === 'location' ? 'Coba Ambil Lokasi Lagi' : 'Pindai QR Lagi'}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  sessionCard: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  sessionTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  sessionMeta: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  cameraFrame: {
    flex: 1,
    minHeight: 280,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: '#111827',
  },
  scanFrame: {
    width: 240,
    height: 240,
  },
  scanCornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 34,
    height: 34,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#fff',
    borderTopLeftRadius: 16,
  },
  scanCornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 34,
    height: 34,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#fff',
    borderTopRightRadius: 16,
  },
  scanCornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 34,
    height: 34,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#fff',
    borderBottomLeftRadius: 16,
  },
  scanCornerBottomRight: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#fff',
    borderBottomRightRadius: 16,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  overlayText: {
    color: '#fff',
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  instruction: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  feedback: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.successBg,
  },
  feedbackError: {
    backgroundColor: colors.dangerBg,
  },
  feedbackInfo: {
    backgroundColor: colors.primarySofter,
  },
  permissionError: {
    color: colors.danger,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    textAlign: 'center',
  },
  feedbackText: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 18,
  },
  messageCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  messageTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 17,
    textAlign: 'center',
  },
  messageText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.primaryDark,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.85,
  },
});
