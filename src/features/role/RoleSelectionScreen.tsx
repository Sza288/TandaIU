import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import BrandWordmark from '../../components/BrandWordmark';
import PraktikanIdentityModal from '../../components/PraktikanIdentityModal';
import AssistantIllustration from './illustrations/AssistantIllustration';
import CampusIllustration from './illustrations/CampusIllustration';
import PraktikanIllustration from './illustrations/PraktikanIllustration';
import TopBlob from './illustrations/TopBlob';
import {
  useRoleTransition,
  type RoleLogoRect,
} from './RoleTransitionContext';
import { useAttendance } from '../../state/AttendanceContext';
import { colors, fonts, radius, spacing } from '../../theme';
import {
  getActivePraktikans,
  isPraktikanActiveInTerm,
} from '../../utils/academic';

const mascotImage = require('../../../assets/images/tandaiu-mascot.png');

export default function RoleSelectionScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

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
  const landingMascotSize = Math.round(
    Math.min(Math.max(width * 0.14, 48), 64)
  );
  const landingLogoGap = height < 720 ? 4 : 6;
  const landingHeadingGap = height < 720 ? 18 : 24;
  const landingTitleGap = height < 720 ? 22 : 28;
  const landingSceneBaseHeight = Math.round(
    Math.min(
      Math.max(width * 0.55, 150),
      Math.max(height * 0.3, 150),
      320
    )
  );
  const landingColumnContentHeight =
    spacing.lg * 2 +
    landingMascotSize +
    landingLogoGap +
    Math.round((landingLogoSize * 56) / 45) +
    landingHeadingGap +
    Math.round(landingTitleSize * 1.28) +
    landingTitleGap +
    landingCardHeight * 2 +
    landingCardGap;
  const landingAvailableSceneHeight =
    height - insets.top - landingColumnContentHeight;
  const landingSceneHeight = Math.round(
    Math.min(
      landingSceneBaseHeight,
      Math.max(landingAvailableSceneHeight, 100)
    )
  );
  const landingBlobWidth = Math.round(
    Math.min(Math.max(width * 0.4, 140), 440)
  );
  const landingBlobHeight = Math.round((landingBlobWidth * 330) / 400);

  const {
    setActiveRole,
    setActivePraktikanId,
    activePraktikanId,
  } = useAttendance();
  const { phase, registerTarget, rootOffset } = useRoleTransition();
  const isTransitionActive = phase !== 'idle';
  const hideMascotTarget = isTransitionActive;
  const roleMascotRef = useRef<ComponentRef<typeof View>>(null);
  const targetMeasureFrame = useRef<number | null>(null);
  const lastTargetRect = useRef<RoleLogoRect | null>(null);
  const stableTargetFrames = useRef(0);
  const contentOpacity = useSharedValue(isTransitionActive ? 0.15 : 1);
  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const [showPraktikanModal, setShowPraktikanModal] = useState(false);
  const [selectedPraktikan, setSelectedPraktikan] = useState<string | null>(activePraktikanId);

  const activePraktikans = getActivePraktikans();

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

  const measureRoleLogo = useCallback(() => {
    if (phase !== 'preparing') return;

    if (targetMeasureFrame.current !== null) {
      cancelAnimationFrame(targetMeasureFrame.current);
      targetMeasureFrame.current = null;
    }

    const tryMeasure = () => {
      if (phase !== 'preparing') return;
      const node = roleMascotRef.current;
      if (!node) {
        targetMeasureFrame.current = requestAnimationFrame(tryMeasure);
        return;
      }

      node.measureInWindow?.((x, y, logoWidth, logoHeight) => {
        if (logoWidth <= 0 || logoHeight <= 0) {
          targetMeasureFrame.current = requestAnimationFrame(tryMeasure);
          return;
        }

        // Normalize window coordinates to the overlay root so source and
        // target use exactly the same coordinate system.
        const rect: RoleLogoRect = {
          x: x - rootOffset.x,
          y: y - rootOffset.y,
          width: logoWidth,
          height: logoHeight,
        };

        const previous = lastTargetRect.current;
        const isStable =
          previous !== null &&
          Math.abs(previous.x - rect.x) < 0.5 &&
          Math.abs(previous.y - rect.y) < 0.5 &&
          Math.abs(previous.width - rect.width) < 0.5 &&
          Math.abs(previous.height - rect.height) < 0.5;

        if (isStable) {
          stableTargetFrames.current += 1;
        } else {
          lastTargetRect.current = rect;
          stableTargetFrames.current = 1;
        }

        // Wait for consecutive stable frames before starting; this avoids
        // animating to a position measured before safe-area/layout settles.
        if (stableTargetFrames.current >= 3) {
          targetMeasureFrame.current = null;
          registerTarget(rect);
          return;
        }

        targetMeasureFrame.current = requestAnimationFrame(tryMeasure);
      });
    };

    tryMeasure();
  }, [phase, registerTarget, rootOffset.x, rootOffset.y]);

  useEffect(() => {
    if (phase !== 'preparing') return;
    lastTargetRect.current = null;
    stableTargetFrames.current = 0;
    measureRoleLogo();

    return () => {
      if (targetMeasureFrame.current !== null) {
        cancelAnimationFrame(targetMeasureFrame.current);
        targetMeasureFrame.current = null;
      }
    };
  }, [measureRoleLogo, phase]);

  useEffect(() => {
    if (isTransitionActive) {
      // Reanimated shared values are intentionally mutable.
      // eslint-disable-next-line react-hooks/immutability
      contentOpacity.value = 0.15;
      contentOpacity.value = withTiming(1, {
        duration: 760,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }
    contentOpacity.value = withTiming(1, { duration: 180 });
  }, [contentOpacity, isTransitionActive]);

  return (
    <SafeAreaView
      style={[styles.container, styles.landingContainer]}
      edges={['top', 'left', 'right']}
    >
      <View style={styles.landingDecor} pointerEvents="none">
        <TopBlob width={landingBlobWidth} height={landingBlobHeight} />
      </View>

      <ScrollView
        style={styles.landingScroll}
        contentContainerStyle={styles.landingScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!isTransitionActive}
      >
        <Animated.View
          pointerEvents={isTransitionActive ? 'none' : 'auto'}
          style={[
            styles.landingColumn,
            {
              width: landingColumnWidth,
              paddingHorizontal: landingHorizontalPadding,
            },
            contentAnimatedStyle,
          ]}
        >
          <View style={styles.landingHero}>
            <View
              ref={roleMascotRef}
              collapsable={false}
              onLayout={measureRoleLogo}
              style={[
                styles.landingLogo,
                { width: landingMascotSize, height: landingMascotSize },
                hideMascotTarget && styles.landingLogoHidden,
              ]}
            >
              <Image
                source={mascotImage}
                style={styles.landingLogoImage}
                resizeMode="contain"
                accessibilityLabel="Logo TandaIU"
                accessibilityIgnoresInvertColors
              />
            </View>
            <BrandWordmark
              size={landingLogoSize}
              style={{ marginTop: landingLogoGap }}
            />
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
        </Animated.View>

        <Animated.View
          style={[
            styles.landingScene,
            { height: landingSceneHeight },
            contentAnimatedStyle,
          ]}
          pointerEvents="none"
        >
          <CampusIllustration width={width} height={landingSceneHeight} />
        </Animated.View>
      </ScrollView>

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
  landingLogo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  landingLogoImage: {
    width: '100%',
    height: '100%',
  },
  landingLogoHidden: {
    opacity: 0,
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
});
