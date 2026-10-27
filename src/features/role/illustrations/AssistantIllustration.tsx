import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

type Props = {
  size?: number;
};

/**
 * Ilustrasi flat vector asisten praktikum dengan kemeja, lanyard, dan clipboard.
 * Digambar pada kanvas persegi agar aman dipotong menjadi avatar bulat.
 */
export default function AssistantIllustration({ size = 76 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <G stroke="#EE8DB2" strokeWidth={3} strokeLinecap="round" opacity={0.9}>
        <Path d="M20 62 L34 66" />
        <Path d="M15 77 L30 78" />
        <Path d="M21 91 L34 88" />
      </G>

      <Path
        d="M22 200 C24 170 34 148 62 138 L86 129 L114 129 L138 138 C166 148 176 170 178 200 Z"
        fill="#D94A7A"
      />
      <Path
        d="M78 137 L100 160 L122 137 L114 200 L86 200 Z"
        fill="#FFF7FA"
      />

      <Rect x={87} y={108} width={26} height={32} rx={12} fill="#EFB394" />

      <Circle cx={65} cy={82} r={8} fill="#F2BE9F" />
      <Circle cx={135} cy={82} r={8} fill="#F2BE9F" />
      <Ellipse cx={100} cy={80} rx={37} ry={41} fill="#F2BE9F" />

      <Path
        d="M63 70 C66 42 81 25 101 25 C123 25 138 43 138 70 C126 65 119 53 115 43 C106 56 85 64 63 70 Z"
        fill="#4A2B35"
      />
      <Path d="M63 70 C60 82 61 91 66 99 C67 87 70 78 73 68 Z" fill="#4A2B35" />
      <Path d="M138 70 C141 82 140 91 135 99 C134 87 131 78 128 68 Z" fill="#4A2B35" />

      <Path d="M78 73 C81 70 86 70 89 73" stroke="#3A2029" strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M111 73 C114 70 119 70 122 73" stroke="#3A2029" strokeWidth={2.4} strokeLinecap="round" />
      <Circle cx={84} cy={81} r={2.6} fill="#3A2029" />
      <Circle cx={116} cy={81} r={2.6} fill="#3A2029" />
      <Path
        d="M99 82 L97 90 L101 90"
        stroke="#D79A7D"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M89 98 C94 103 106 103 111 98" stroke="#B45A5A" strokeWidth={2.4} strokeLinecap="round" />
      <Circle cx={74} cy={94} r={5} fill="#F2A0A0" opacity={0.32} />
      <Circle cx={126} cy={94} r={5} fill="#F2A0A0" opacity={0.32} />

      <Path d="M84 130 L92 157" stroke="#F7A8C6" strokeWidth={4} strokeLinecap="round" />
      <Path d="M116 130 L108 157" stroke="#F7A8C6" strokeWidth={4} strokeLinecap="round" />

      <Path d="M52 148 C43 160 43 175 48 186" stroke="#C13A68" strokeWidth={20} strokeLinecap="round" />
      <Circle cx={49} cy={188} r={8} fill="#F2BE9F" />

      <Rect
        x={84}
        y={154}
        width={32}
        height={40}
        rx={5}
        fill="#FFF9FB"
        stroke="#E85D8A"
        strokeWidth={1.6}
      />
      <Circle cx={100} cy={161} r={2.6} fill="#E85D8A" />
      <Rect x={90} y={167} width={20} height={3.5} rx={1.75} fill="#E85D8A" />
      <Rect x={90} y={175} width={20} height={3} rx={1.5} fill="#F7A8C6" />
      <Rect x={90} y={182} width={14} height={3} rx={1.5} fill="#F7A8C6" />

      <Path d="M148 148 C157 158 157 171 150 181" stroke="#C13A68" strokeWidth={19} strokeLinecap="round" />

      <G transform="rotate(6 146 160)">
        <Rect x={124} y={130} width={42} height={56} rx={5} fill="#8E2A4F" />
        <Rect x={129} y={136} width={32} height={45} rx={3} fill="#FFF9FB" />
        <Rect x={134} y={144} width={22} height={3} rx={1.5} fill="#F7A8C6" />
        <Rect x={134} y={151} width={18} height={3} rx={1.5} fill="#F7A8C6" />
        <Rect x={134} y={158} width={20} height={3} rx={1.5} fill="#F7A8C6" />
        <Rect x={131} y={126} width={28} height={8} rx={4} fill="#C13A68" />
      </G>
      <Ellipse
        cx={134}
        cy={174}
        rx={9}
        ry={7}
        fill="#F2BE9F"
        transform="rotate(-12 134 174)"
      />
    </Svg>
  );
}
