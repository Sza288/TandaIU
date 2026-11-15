import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { colors } from '../../theme';

type AuthIllustrationProps = {
  size?: number;
};

export default function AuthIllustration({ size = 116 }: AuthIllustrationProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      accessibilityLabel="Ilustrasi mahasiswa siap praktikum"
    >
      <Circle cx="82" cy="82" r="72" fill={colors.primarySofter} />
      <Path
        d="M22 43c8-8 17-9 25-4M127 111c7-6 13-7 19-4"
        stroke={colors.borderStrong}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <Path
        d="m31 94 3 6 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1 3-6Z"
        fill={colors.primary}
      />
      <Path
        d="m128 40 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8 2.5-5Z"
        fill="#F4B942"
      />

      <Path
        d="M44 145c2-20 13-31 34-34h7c21 3 32 14 34 34H44Z"
        fill={colors.primary}
      />
      <Path d="m68 113 13 14 13-14-6 32H74l-6-32Z" fill={colors.surface} />
      <Rect x="75" y="98" width="13" height="19" rx="6.5" fill="#F2BE9F" />
      <Circle cx="61" cy="75" r="7" fill="#F2BE9F" />
      <Circle cx="101" cy="75" r="7" fill="#F2BE9F" />
      <Ellipse cx="81" cy="74" rx="23" ry="28" fill="#F2BE9F" />

      <Path
        d="M58 67c2-20 12-29 24-29 15 0 23 11 23 29-8-3-14-9-18-17-7 9-17 14-29 17Z"
        fill="#4A2B35"
      />
      <Path d="M67 72c2-2 5-2 7 0M89 72c2-2 5-2 7 0" stroke="#3A2029" strokeWidth="2" strokeLinecap="round" />
      <Circle cx="71" cy="78" r="2" fill="#3A2029" />
      <Circle cx="92" cy="78" r="2" fill="#3A2029" />
      <Path d="M76 88c3 3 8 3 11 0" stroke="#B45A5A" strokeWidth="2" strokeLinecap="round" />
      <Circle cx="66" cy="84" r="4" fill="#F2A0A0" opacity="0.45" />
      <Circle cx="97" cy="84" r="4" fill="#F2A0A0" opacity="0.45" />

      <G transform="rotate(-8 111 122)">
        <Rect x="100" y="98" width="29" height="39" rx="4" fill={colors.primaryDark} />
        <Rect x="104" y="103" width="21" height="29" rx="2" fill={colors.surface} />
        <Path d="m109 116 3 3 7-8" stroke={colors.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M108 124h13" stroke={colors.borderStrong} strokeWidth="2" strokeLinecap="round" />
      </G>
    </Svg>
  );
}
