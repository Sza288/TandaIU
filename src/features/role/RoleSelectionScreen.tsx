import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import BottomNav from '../../components/BottomNav';
import PraktikanIdentityModal from '../../components/PraktikanIdentityModal';
import ScreenHeader from '../../components/ScreenHeader';
import { useAttendance } from '../../state/AttendanceContext';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import {
  getActivePraktikans,
  getPraktikanById,
  isPraktikanActiveInTerm,
} from '../../utils/academic';
import { getInitials } from '../../utils/format';

type IconName = keyof typeof Ionicons.glyphMap;

const ROLE_OPTIONS: {
  role: 'assistant' | 'praktikan';
  title: string;
  description: string;
  icon: IconName;
}[] = [
  {
    role: 'assistant',
    title: 'Masuk sebagai Asisten',
    description: 'Buka/tutup sesi dan lihat rekap presensi praktikan.',
    icon: 'school-outline',
  },
  {
    role: 'praktikan',
    title: 'Masuk sebagai Praktikan',
    description: 'Lakukan presensi dan lihat riwayat kehadiranmu.',
    icon: 'person-outline',
  },
];

export default function RoleSelectionScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const isSwitching = from === 'switch';

  const {
    setActiveRole,
    setActivePraktikanId,
    activeRole,
    activePraktikanId,
  } = useAttendance();

  const [showPraktikanModal, setShowPraktikanModal] = useState(false);
  const [selectedPraktikan, setSelectedPraktikan] = useState<string | null>(activePraktikanId);

  const activePraktikans = getActivePraktikans();
  const activePraktikan = getPraktikanById(activePraktikanId);
  const identityTitle = activePraktikan?.name ?? 'Belum memilih identitas';
  const identitySubtitle = activePraktikan
    ? `${activePraktikan.studentCode ?? '-'} · Semester ${activePraktikan.semester}`
    : 'Pilih praktikan untuk demo presensi';

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (isSwitching) {
      if (activeRole === 'assistant') {
        router.replace('/assistant');
        return;
      }
      if (activeRole === 'praktikan') {
        router.replace('/praktikan');
        return;
      }
      router.replace('/');
      return;
    }
    router.replace('/');
  };

  const navigateToRoleHome = (href: '/assistant' | '/praktikan') => {
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.replace(href);
  };

  const handleSelectAssistant = () => {
    setActiveRole('assistant');
    setActivePraktikanId(null);
    setShowPraktikanModal(false);
    navigateToRoleHome('/assistant');
  };

  const handleOpenPraktikanModal = () => {
    setSelectedPraktikan(
      isPraktikanActiveInTerm(activePraktikanId) ? activePraktikanId : null
    );
    setShowPraktikanModal(true);
  };

  const handleConfirmPraktikan = () => {
    if (!selectedPraktikan || !isPraktikanActiveInTerm(selectedPraktikan)) return;
    setActiveRole('praktikan');
    setActivePraktikanId(selectedPraktikan);
    setShowPraktikanModal(false);
    navigateToRoleHome('/praktikan');
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={pathname === '/role' ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']}
    >
      <ScreenHeader
        title={isSwitching ? 'Ganti Peran' : 'Profil'}
        eyebrow={isSwitching ? 'Pilih tampilan' : 'Akun demo'}
        onBack={handleBack}
        right={
          <View style={styles.headerBadge}>
            <Ionicons
              name={isSwitching ? 'swap-horizontal' : 'person'}
              size={16}
              color={colors.primary}
            />
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isSwitching && { paddingBottom: Math.max(insets.bottom, spacing.xxl) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {activePraktikan ? getInitials(activePraktikan.name) : '?'}
            </Text>
          </View>
          <View style={styles.identityText}>
            <Text style={styles.identityName} numberOfLines={1}>
              {identityTitle}
            </Text>
            <Text style={styles.identitySubtitle} numberOfLines={2}>
              {identitySubtitle}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pilih Peran</Text>
          <Text style={styles.sectionHint}>
            {isSwitching ? 'Data presensi tetap tersimpan' : 'Bisa diganti kapan saja'}
          </Text>
        </View>

        {ROLE_OPTIONS.map((option) => {
          const isActive = activeRole === option.role;
          return (
            <TouchableOpacity
              key={option.role}
              style={[styles.roleCard, isActive && styles.roleCardActive]}
              activeOpacity={0.85}
              onPress={
                option.role === 'assistant' ? handleSelectAssistant : handleOpenPraktikanModal
              }
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={option.title}
            >
              <View style={[styles.roleIcon, isActive && styles.roleIconActive]}>
                <Ionicons
                  name={option.icon}
                  size={20}
                  color={colors.primaryDark}
                />
              </View>
              <View style={styles.roleText}>
                <Text style={styles.roleTitle}>{option.title}</Text>
                <Text style={styles.roleDescription}>{option.description}</Text>
              </View>
              <Ionicons
                name={isActive ? 'checkmark-circle' : 'chevron-forward'}
                size={20}
                color={isActive ? colors.primary : colors.textMuted}
              />
            </TouchableOpacity>
          );
        })}

        <Text style={styles.note}>
          Pemilihan peran hanya untuk demo. Data sesi dan presensi tetap tersimpan saat
          kamu berpindah peran.
        </Text>
      </ScrollView>

      {pathname === '/profile' && !isSwitching ? <BottomNav /> : null}

      <PraktikanIdentityModal
        visible={showPraktikanModal}
        praktikans={activePraktikans}
        selectedId={selectedPraktikan}
        onSelect={setSelectedPraktikan}
        onCancel={() => setShowPraktikanModal(false)}
        onConfirm={handleConfirmPraktikan}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySofter,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.card,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.bold,
    color: colors.primaryDark,
    fontSize: 17,
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  identityName: {
    fontFamily: fonts.bold,
    color: colors.text,
    fontSize: 16,
  },
  identitySubtitle: {
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    color: colors.text,
    fontSize: 18,
  },
  sectionHint: {
    fontFamily: fonts.regular,
    color: colors.textMuted,
    fontSize: 11,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.card,
  },
  roleCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySofter,
  },
  roleIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primarySofter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconActive: {
    backgroundColor: colors.primarySoft,
  },
  roleText: {
    flex: 1,
    gap: 2,
  },
  roleTitle: {
    fontFamily: fonts.bold,
    color: colors.text,
    fontSize: 15,
  },
  roleDescription: {
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  note: {
    fontFamily: fonts.regular,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});
