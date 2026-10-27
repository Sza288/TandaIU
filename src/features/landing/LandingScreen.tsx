import { router } from 'expo-router';
import { ReactNode, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import PraktikanIdentityModal from '../../components/PraktikanIdentityModal';
import { useAttendance } from '../../state/AttendanceContext';
import { colors, fonts, shadows, spacing } from '../../theme';
import { getActivePraktikans, isPraktikanActiveInTerm } from '../../utils/academic';
import AssistantIllustration from '../role/illustrations/AssistantIllustration';
import PraktikanIllustration from '../role/illustrations/PraktikanIllustration';
import { CampusIllustration, TopLeftAccent } from './LandingDecor';

function ArrowIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12H19"
        stroke={colors.textOnPrimary}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Path
        d="M13 6L19 12L13 18"
        stroke={colors.textOnPrimary}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

type RoleCardProps = {
  name: string;
  illustration: ReactNode;
  compact: boolean;
  onPress: () => void;
};

function RoleCard({ name, illustration, compact, onPress }: RoleCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Masuk sebagai ${name}`}
      android_ripple={{ color: '#FDE7F0', borderless: false }}
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.avatar, compact && styles.avatarCompact]}>{illustration}</View>
      <Text style={[styles.roleName, compact && styles.roleNameCompact]} numberOfLines={1}>
        {name}
      </Text>
      <View style={[styles.arrowButton, compact && styles.arrowButtonCompact]}>
        <ArrowIcon size={compact ? 20 : 22} />
      </View>
    </Pressable>
  );
}

export default function LandingScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { setActiveRole, setActivePraktikanId, activePraktikanId } = useAttendance();

  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedPraktikanId, setSelectedPraktikanId] = useState<string | null>(
    activePraktikanId
  );

  const activePraktikans = getActivePraktikans();

  const compact = width < 350;
  const shortScreen = height < 700;
  const accentSize = Math.min(width * 0.36, 170);
  const campusHeight = shortScreen
    ? Math.max(120, Math.min(width * 0.48, height * 0.3, 200))
    : Math.max(160, Math.min(width * 0.82, height * 0.38, 340));
  const avatarSize = compact ? 66 : 80;
  const contentTopPadding = shortScreen
    ? spacing.xxxl
    : Math.min(96, Math.max(48, height * 0.12 - insets.top));

  const handleSelectAssistant = () => {
    setActiveRole('assistant');
    setActivePraktikanId(null);
    router.replace('/assistant');
  };

  const handleOpenPraktikan = () => {
    setSelectedPraktikanId(
      isPraktikanActiveInTerm(activePraktikanId) ? activePraktikanId : null
    );
    setPickerVisible(true);
  };

  const handleConfirmPraktikan = () => {
    if (!selectedPraktikanId || !isPraktikanActiveInTerm(selectedPraktikanId)) return;
    setActiveRole('praktikan');
    setActivePraktikanId(selectedPraktikanId);
    setPickerVisible(false);
    router.replace('/praktikan');
  };

  return (
    <View style={styles.root}>
      <View
        style={[styles.topAccent, { width: accentSize, height: accentSize }]}
        pointerEvents="none"
      >
        <TopLeftAccent width={accentSize} />
      </View>

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={[styles.content, { paddingTop: contentTopPadding }]}>
            <Text style={[styles.brand, compact && styles.brandCompact]}>TandaIU</Text>
            <Text style={[styles.question, compact && styles.questionCompact]}>
              Masuk sebagai siapa?
            </Text>

            <View style={styles.cards}>
              <RoleCard
                name="Asisten"
                compact={compact}
                onPress={handleSelectAssistant}
                illustration={<AssistantIllustration size={avatarSize} />}
              />
              <RoleCard
                name="Praktikan"
                compact={compact}
                onPress={handleOpenPraktikan}
                illustration={<PraktikanIllustration size={avatarSize} />}
              />
            </View>
          </View>

          <View style={styles.spacer} />

          <View style={[styles.campus, { height: campusHeight }]} pointerEvents="none">
            <CampusIllustration height={campusHeight} />
          </View>
        </ScrollView>
      </SafeAreaView>

      <PraktikanIdentityModal
        visible={pickerVisible}
        praktikans={activePraktikans}
        selectedId={selectedPraktikanId}
        onSelect={setSelectedPraktikanId}
        onCancel={() => setPickerVisible(false)}
        onConfirm={handleConfirmPraktikan}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    paddingHorizontal: 22,
  },
  brand: {
    fontFamily: fonts.brand,
    fontSize: 42,
    lineHeight: 52,
    color: colors.primaryDark,
    textAlign: 'center',
    letterSpacing: -1,
  },
  brandCompact: {
    fontSize: 37,
    lineHeight: 47,
  },
  question: {
    marginTop: 30,
    fontFamily: fonts.heading,
    fontSize: 26,
    lineHeight: 34,
    color: colors.primaryDeep,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  questionCompact: {
    fontSize: 23,
    lineHeight: 30,
  },
  cards: {
    marginTop: 30,
    gap: 16,
  },
  card: {
    minHeight: 116,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
    ...shadows.card,
  },
  cardCompact: {
    minHeight: 96,
    gap: spacing.sm,
    paddingLeft: spacing.md,
  },
  cardPressed: {
    backgroundColor: colors.primarySofter,
    borderColor: colors.borderStrong,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarCompact: {
    width: 66,
    height: 66,
    borderRadius: 33,
  },
  roleName: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.primaryDeep,
    letterSpacing: -0.3,
  },
  roleNameCompact: {
    fontSize: 20,
  },
  arrowButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowButtonCompact: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  spacer: {
    flexGrow: 1,
    minHeight: spacing.lg,
  },
  campus: {
    width: '100%',
  },
});
