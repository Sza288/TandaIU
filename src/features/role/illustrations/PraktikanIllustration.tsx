import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

type Props = {
  size?: number;
};

/**
 * Ilustrasi flat vector praktikan dengan tas punggung dan buku catatan.
 * Gaya dan kanvas dibuat sama dengan AssistantIllustration agar seragam.
 */
export default function PraktikanIllustration({ size = 76 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <G stroke="#EE8DB2" strokeWidth={3} strokeLinecap="round" opacity={0.9}>
        <Path d="M169 62 L155 66" />
        <Path d="M174 77 L159 78" />
        <Path d="M168 91 L155 88" />
      </G>

      <Path
        d="M55 166 C46 130 48 50 100 30 C152 50 154 130 145 166 C139 150 138 116 136 88 C120 98 80 98 64 88 C62 116 61 150 55 166 Z"
        fill="#4A2B35"
      />

      <Rect x={18} y={137} width={46} height={63} rx={20} fill="#B93A6B" />

      <Path
        d="M24 200 C26 170 36 150 64 140 L86 131 L114 131 L136 140 C164 150 174 170 176 200 Z"
        fill="#E86A96"
      />
      <Path d="M78 139 L100 160 L122 139 L114 200 L86 200 Z" fill="#FFF7FA" />

      <Path d="M72 137 C66 150 64 170 69 186" stroke="#B93A6B" strokeWidth={9} strokeLinecap="round" />
      <Path d="M128 137 C134 150 136 170 131 186" stroke="#B93A6B" strokeWidth={9} strokeLinecap="round" />

      <Rect x={88} y={110} width={24} height={30} rx={11} fill="#F3BE9F" />

      <Circle cx={67} cy={84} r={7} fill="#F3BE9F" />
      <Circle cx={133} cy={84} r={7} fill="#F3BE9F" />
      <Ellipse cx={100} cy={83} rx={34} ry={39} fill="#F3BE9F" />

      <Path
        d="M62 80 C64 45 80 27 100 27 C122 27 138 45 140 80 C132 73 124 64 119 51 C108 66 84 76 62 80 Z"
        fill="#4A2B35"
      />
      <Path d="M62 80 C58 93 58 104 63 114 C64 99 67 88 70 78 Z" fill="#4A2B35" />
      <Path d="M140 80 C144 93 144 104 139 114 C138 99 135 88 132 78 Z" fill="#4A2B35" />
      <Path d="M64 90 C60 110 60 136 64 152 C70 136 70 112 71 94 Z" fill="#4A2B35" />
      <Path d="M136 90 C140 110 140 136 136 152 C130 136 130 112 129 94 Z" fill="#4A2B35" />

      <Path d="M79 77 C82 74 87 74 90 77" stroke="#3A2029" strokeWidth={2.3} strokeLinecap="round" />
      <Path d="M111 77 C114 74 119 74 122 77" stroke="#3A2029" strokeWidth={2.3} strokeLinecap="round" />
      <Circle cx={85} cy={84} r={2.5} fill="#3A2029" />
      <Circle cx={116} cy={84} r={2.5} fill="#3A2029" />
      <Path
        d="M100 85 L98 93 L102 93"
        stroke="#D79A7D"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M90 101 C95 106 106 106 111 101" stroke="#B45A5A" strokeWidth={2.3} strokeLinecap="round" />
      <Circle cx={76} cy={96} r={5} fill="#F2A0A0" opacity={0.32} />
      <Circle cx={125} cy={96} r={5} fill="#F2A0A0" opacity={0.32} />

      <Path d="M50 150 C44 161 44 173 49 183" stroke="#D95585" strokeWidth={19} strokeLinecap="round" />
      <Circle cx={50} cy={185} r={8} fill="#F3BE9F" />

      <Path d="M148 150 C156 160 155 172 148 180" stroke="#D95585" strokeWidth={18} strokeLinecap="round" />

      <G transform="rotate(-7 145 160)">
        <Rect x={124} y={133} width={42} height={55} rx={5} fill="#B93A6B" />
        <Rect x={129} y={139} width={32} height={44} rx={3} fill="#FFF9FB" />
        <Rect x={134} y={147} width={22} height={3} rx={1.5} fill="#F7A8C6" />
        <Rect x={134} y={154} width={18} height={3} rx={1.5} fill="#F7A8C6" />
        <Rect x={134} y={161} width={20} height={3} rx={1.5} fill="#F7A8C6" />
        <Rect x={131} y={129} width={28} height={8} rx={4} fill="#8E2A4F" />
      </G>
      <Ellipse
        cx={132}
        cy={177}
        rx={9}
        ry={7}
        fill="#F3BE9F"
        transform="rotate(-12 132 177)"
      />
    </Svg>
  );
}
