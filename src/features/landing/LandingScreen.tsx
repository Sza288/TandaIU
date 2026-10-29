import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandWordmark from '../../components/BrandWordmark';
import { colors, fonts } from '../../theme';

const mascotImage = require('../../../assets/images/tandaiu-mascot.png');

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
            <Image
              source={mascotImage}
              style={{ width: mascotSize, height: mascotSize }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <BrandWordmark size={45} withUnderline style={styles.brand} />
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
