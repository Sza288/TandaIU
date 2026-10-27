import { StyleSheet, Text, View } from 'react-native';
import { SessionStatus } from '../types';
import { fonts, statusStyles } from '../theme';

export default function StatusBadge({ status }: { status: SessionStatus }) {
  const style = statusStyles[status];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: style.backgroundColor, borderColor: style.borderColor },
      ]}
    >
      <Text style={[styles.label, { color: style.textColor }]}>{style.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
});
