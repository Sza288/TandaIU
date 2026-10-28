import { StyleSheet, View, ViewStyle } from 'react-native';

type Props = {
  size?: number;
  color?: string;
  style?: ViewStyle;
};

/**
 * Decorative flower built from plain Views so the landing page keeps the
 * floral accent from the design without shipping a bitmap asset.
 */
export default function FlowerAccent({ size = 72, color = '#F9C6D8', style }: Props) {
  const petal = size * 0.46;
  const center = size * 0.3;
  const offset = size * 0.27;

  return (
    <View style={[styles.container, { width: size, height: size }, style]} pointerEvents="none">
      <View
        style={[
          styles.petal,
          { width: petal, height: petal, borderRadius: petal / 2, backgroundColor: color },
          { top: 0, left: offset },
        ]}
      />
      <View
        style={[
          styles.petal,
          { width: petal, height: petal, borderRadius: petal / 2, backgroundColor: color },
          { top: offset, left: 0 },
        ]}
      />
      <View
        style={[
          styles.petal,
          { width: petal, height: petal, borderRadius: petal / 2, backgroundColor: color },
          { top: offset, right: 0 },
        ]}
      />
      <View
        style={[
          styles.petal,
          { width: petal, height: petal, borderRadius: petal / 2, backgroundColor: color },
          { bottom: 0, left: offset },
        ]}
      />
      <View
        style={[
          styles.center,
          {
            width: center,
            height: center,
            borderRadius: center / 2,
            backgroundColor: '#FFFFFF',
            top: (size - center) / 2,
            left: (size - center) / 2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  petal: {
    position: 'absolute',
    opacity: 0.85,
  },
  center: {
    position: 'absolute',
    opacity: 0.9,
  },
});
