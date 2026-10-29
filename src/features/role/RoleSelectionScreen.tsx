import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import BottomNav from '../../components/BottomNav';
import BrandWordmark from '../../components/BrandWordmark';
import PraktikanIdentityModal from '../../components/PraktikanIdentityModal';
import ScreenHeader from '../../components/ScreenHeader';
import AssistantIllustration from './illustrations/AssistantIllustration';
import CampusIllustration from './illustrations/CampusIllustration';
import PraktikanIllustration from './illustrations/PraktikanIllustration';
import TopBlob from './illustrations/TopBlob';
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
  const { width, height } = useWindowDimensions();
  const isSwitching = from === 'switch';
  const isRoleLanding = pathname === '/role' && !isSwitching;

  const landingColumnWidth = Math.min(width, 520);
  const landingHorizontalPadding = Math.round(
    Math.max(20, Math.min(width * 0.065, 34))
  );
  const landingCardWidth = Math.min(
    landingColumnWidth - landingHorizontalPadding * 2,
    460
  );
  const landingCardHeight = Math.round(
    Math.min(Math.max(landingCardWidth * 0.318, 108), 132)
  );
  const landingIllustrationSize = Math.round(landingCardHeight * 0.74);
  const landingCardTitleSize = Math.round(
    Math.min(Math.max(landingCardWidth * 0.062, 20), 26)
  );
  const landingCardGap = Math.round(
    Math.min(Math.max(landingCardWidth * 0.045, 14), 20)
  );
  const landingCardPadding = Math.round(
    Math.min(Math.max(landingCardWidth * 0.045, 14), 20)
  );
  const landingCardRadius = Math.round(
    Math.min(Math.max(landingCardWidth * 0.05, 16), 22)
  );
  const landingCardTitleGap = Math.round(
    Math.min(Math.max(landingCardWidth * 0.04, 12), 18)
  );
  const landingArrowSize = Math.round(
    Math.min(Math.max(landingCardHeight * 0.38, 40), 50)
  );
  const landingTitleSize = Math.round(
    Math.min(Math.max(width * 0.062, 21), 27)
  );
  const landingLogoSize = Math.round(
    Math.min(Math.max(width * 0.095, 31), 44)
  );
  const landingHeadingGap = height < 720 ? 18 : 24;
  const landingTitleGap = height < 720 ? 22 : 28;
  const landingSceneHeight = Math.round(
    Math.min(
      Math.max(width * 0.55, 150),
      Math.max(height * 0.3, 150),
      320
    )
  );
  const landingBlobWidth = Math.round(
    Math.min(Math.max(width * 0.4, 140), 440)
  );
  const landingBlobHeight = Math.round((landingBlobWidth * 330) / 400);

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
      style={[styles.container, isRoleLanding && styles.landingContainer]}
      edges={
        isRoleLanding
          ? ['top', 'left', 'right']
          : pathname === '/role'
            ? ['top', 'left', 'right', 'bottom']
            : ['top', 'left', 'right']
      }
    >
      {isRoleLanding ? (
        <View style={styles.landingDecor} pointerEvents="none">
          <TopBlob width={landingBlobWidth} height={landingBlobHeight} />
        </View>
      ) : null}

      {!isRoleLanding ? (
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
      ) : null}

      <ScrollView
        style={isRoleLanding ? styles.landingScroll : undefined}
        contentContainerStyle={[
          isRoleLanding ? styles.landingScrollContent : styles.content,
          isSwitching && { paddingBottom: Math.max(insets.bottom, spacing.xxl) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isRoleLanding ? (
          <View
            style={[
              styles.landingColumn,
              {
                width: landingColumnWidth,
                paddingHorizontal: landingHorizontalPadding,
              },
            ]}
          >
            <View style={styles.landingHero}>
              <BrandWordmark size={landingLogoSize} />
              <Text
                style={[
                  styles.landingTitle,
                  {
                    fontSize: landingTitleSize,
                    lineHeight: Math.round(landingTitleSize * 1.28),
                    marginTop: landingHeadingGap,
                    marginBottom: landingTitleGap,
                  },
                ]}
              >
                Masuk sebagai siapa?
              </Text>
            </View>

            <View style={[styles.roleChoiceList, { gap: landingCardGap }]}>
              <TouchableOpacity
                style={[
                  styles.roleChoiceCard,
                  {
                    height: landingCardHeight,
                    gap: landingCardTitleGap,
                    paddingHorizontal: landingCardPadding,
                    borderRadius: landingCardRadius,
                  },
                ]}
                activeOpacity={0.85}
                onPress={handleSelectAssistant}
                accessibilityRole="button"
                accessibilityLabel="Masuk sebagai Asisten"
              >
                <View
                  style={[
                    styles.roleIllustration,
                    { width: landingIllustrationSize, height: landingIllustrationSize },
                  ]}
                >
                  <AssistantIllustration size={landingIllustrationSize} />
                </View>
                <Text
                  style={[styles.roleChoiceTitle, { fontSize: landingCardTitleSize }]}
                  numberOfLines={1}
                >
                  Asisten
                </Text>
                <View
                  style={[
                    styles.roleArrow,
                    { width: landingArrowSize, height: landingArrowSize },
                  ]}
                >
                  <Ionicons
                    name="arrow-forward"
                    size={Math.round(landingArrowSize * 0.5)}
                    color={colors.textOnPrimary}
                  />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleChoiceCard,
                  {
                    height: landingCardHeight,
                    gap: landingCardTitleGap,
                    paddingHorizontal: landingCardPadding,
                    borderRadius: landingCardRadius,
                  },
                ]}
                activeOpacity={0.85}
                onPress={handleOpenPraktikanModal}
                accessibilityRole="button"
                accessibilityLabel="Masuk sebagai Praktikan"
              >
                <View
                  style={[
                    styles.roleIllustration,
                    { width: landingIllustrationSize, height: landingIllustrationSize },
                  ]}
                >
                  <PraktikanIllustration size={landingIllustrationSize} />
                </View>
                <Text
                  style={[styles.roleChoiceTitle, { fontSize: landingCardTitleSize }]}
                  numberOfLines={1}
                >
                  Praktikan
                </Text>
                <View
                  style={[
                    styles.roleArrow,
                    { width: landingArrowSize, height: landingArrowSize },
                  ]}
                >
                  <Ionicons
                    name="arrow-forward"
                    size={Math.round(landingArrowSize * 0.5)}
                    color={colors.textOnPrimary}
                  />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
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
                Data presensi tetap tersimpan
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
          </>
        )}
      </ScrollView>

      {isRoleLanding ? (
        <View
          style={[styles.landingScene, { height: landingSceneHeight }]}
          pointerEvents="none"
        >
          <CampusIllustration width={width} height={landingSceneHeight} />
        </View>
      ) : null}

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
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  landingContainer: {
    overflow: 'hidden',
  },
  landingDecor: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 0,
  },
  landingScroll: {
    flex: 1,
    zIndex: 1,
  },
  landingScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  landingColumn: {
    flexGrow: 1,
    justifyContent: 'center',
    alignSelf: 'center',
    paddingVertical: spacing.lg,
  },
  landingHero: {
    alignItems: 'center',
  },
  landingScene: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 1,
  },
  landingTitle: {
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    textAlign: 'center',
  },
  roleChoiceList: {
    gap: spacing.lg,
  },
  roleChoiceCard: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  roleIllustration: {
    width: 82,
    height: 82,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
  },
  roleChoiceTitle: {
    flex: 1,
    color: colors.primaryDeep,
    fontFamily: fonts.bold,
    fontSize: 21,
    textAlign: 'center',
  },
  roleArrow: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
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
