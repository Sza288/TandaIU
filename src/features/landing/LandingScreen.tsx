import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../theme';

function MascotIllustration({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 220 220" fill="none">
      <Circle cx="110" cy="110" r="108" fill="#FBE1E9" />
      <Path
        d="M108 30c10-1 13 14 21 17 8 3 19-9 27-4 9 5 1 19 6 27 4 8 21 6 24 15 3 9-12 16-12 25 0 9 16 15 14 24-2 10-19 10-24 18-5 8 4 23-4 29-8 7-20-5-29-2-9 3-10 20-20 21-10 1-13-15-22-18-9-3-21 8-29 3-8-5 0-19-4-27-4-8-21-7-24-16-3-9 12-16 12-25 0-9-16-15-14-24 2-9 19-10 24-18 5-8-4-23 4-29 8-6 20 5 29 2 9-3 10-19 21-18Z"
        fill={colors.primary}
      />
      <Circle cx="85" cy="96" r="4.5" fill="#76213F" />
      <Circle cx="135" cy="96" r="4.5" fill="#76213F" />
      <Circle cx="74" cy="113" r="8" fill="#F77FA7" />
      <Circle cx="146" cy="113" r="8" fill="#F77FA7" />
      <Path
        d="M96 117c8 9 20 9 28 0"
        stroke="#76213F"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <Circle cx="173" cy="163" r="22" fill={colors.surface} />
      <Path
        d="m163 163 7 7 13-16"
        stroke={colors.primary}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="m28 59 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Zm164 98 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill={colors.primary} />
      <Circle cx="202" cy="37" r="3.5" fill={colors.primary} />
      <Circle cx="36" cy="184" r="2.5" fill="#F28CAF" />
    </Svg>
  );
}

function CornerDecorations() {
  return (
    <>
      <Svg style={styles.topAccent} width={225} height={205} viewBox="0 0 225 205" fill="none">
        <Path
          d="M-50 30C-8-18 48 10 54 54c5 38-41 66-77 46-31-18-15-57 14-69 49-20 96 24 93 71-3 56-55 86-116 82M131 112c35-30 70-68 97-127"
          stroke="#F6CAD8"
          strokeWidth="18"
          strokeLinecap="round"
        />
      </Svg>
      <Svg style={styles.bottomAccent} width={230} height={190} viewBox="0 0 230 190" fill="none">
        <Path
          d="M245 5c-83 26-151 58-177 106-19 35 1 70 35 75 40 6 70-25 60-58-10-33-54-47-87-31-44 20-65 59-58 105"
          stroke="#F6CAD8"
          strokeWidth="19"
          strokeLinecap="round"
        />
      </Svg>
    </>
  );
}

export default function LandingScreen() {
  const { width, height } = useWindowDimensions();
  const mascotSize = Math.min(width * 0.53, height * 0.28, 230);

  const continueToRoles = () => router.replace('/role');

  return (
    <View style={styles.root}>
      <CornerDecorations />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Pressable
            onPress={continueToRoles}
            accessibilityRole="button"
            accessibilityLabel="Lanjut ke pemilihan peran"
            style={({ pressed }) => [styles.brandAction, pressed && styles.pressed]}
          >
            <MascotIllustration size={mascotSize} />
            <Text style={styles.brand}>TandaIU</Text>
            <Svg width={112} height={20} viewBox="0 0 112 20" fill="none">
              <Path
                d="M12 8c27 11 61 11 88 0"
                stroke="#F2789F"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
          <Pressable
            onPress={continueToRoles}
            accessibilityRole="button"
            style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}
          >
            <Text style={styles.continueText}>Ketuk untuk melanjutkan</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  brandAction: {
    alignItems: 'center',
  },
  brand: {
    marginTop: 16,
    color: colors.primaryDark,
    fontFamily: fonts.brand,
    fontSize: 45,
    lineHeight: 56,
    letterSpacing: -1.5,
  },
  continueButton: {
    minHeight: 44,
    marginTop: 22,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  continueText: {
    color: colors.primaryDark,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.75,
  },
  topAccent: {
    position: 'absolute',
    top: -4,
    left: -20,
  },
  bottomAccent: {
    position: 'absolute',
    right: -14,
    bottom: -16,
  },
});
