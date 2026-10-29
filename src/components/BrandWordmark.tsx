import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../theme';

type BrandWordmarkProps = {
  /** Font size of the wordmark. The underline scales with it. */
  size?: number;
  /** Renders the pink swoosh used on the splash screen. */
  withUnderline?: boolean;
  /** Overrides the wordmark color without changing the shared default. */
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Shared TandaIU wordmark so the splash screen and the role selection screen
 * always render the same font, weight, color, and letter spacing.
 */
export default function BrandWordmark({
  size = 40,
  withUnderline = false,
  color = colors.primaryDark,
  style,
}: BrandWordmarkProps) {
  const underlineWidth = Math.round((size * 112) / 45);
  const underlineHeight = Math.round((underlineWidth * 20) / 112);

  return (
    <View style={[styles.container, style]}>
      <Text
        accessibilityRole="header"
        style={[
          styles.text,
          {
            color,
            fontSize: size,
            lineHeight: Math.round((size * 56) / 45),
          },
        ]}
      >
        TandaIU
      </Text>
      {withUnderline ? (
        <Svg
          width={underlineWidth}
          height={underlineHeight}
          viewBox="0 0 112 20"
          fill="none"
        >
          <Path
            d="M12 8c27 11 61 11 88 0"
            stroke="#F2789F"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  text: {
    color: colors.primaryDark,
    fontFamily: fonts.brand,
    letterSpacing: -1.5,
    textAlign: 'center',
  },
});
