import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

type Props = {
  width?: number;
  height?: number;
};

const SCENE_HEIGHT = 396;
const SCHOOL_WIDTH = 520;

/**
 * Dekorasi bawah landing: tiga lapis gelombang pink dengan siluet kampus di
 * tengah. Lebar viewBox dihitung dari rasio tampilan supaya gelombang selalu
 * memenuhi lebar layar tanpa membuat kampus gepeng.
 */
export default function CampusIllustration({ width = 390, height = 150 }: Props) {
  const sceneWidth = Math.max(640, (width * SCENE_HEIGHT) / Math.max(height, 1));
  const w = sceneWidth;
  const centerX = w / 2;
  const renderedSchoolWidth = (SCHOOL_WIDTH * height) / SCENE_HEIGHT;
  const schoolScale = Math.min(1, (Math.min(width * 0.5, 520)) / Math.max(renderedSchoolWidth, 1));
  const schoolLeft = centerX - (SCHOOL_WIDTH * schoolScale) / 2;
  const schoolTop = 58;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${w} ${SCENE_HEIGHT}`} fill="none">
      <Defs>
        <LinearGradient id="campusWaveMiddle" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#F28DB8" />
          <Stop offset="0.5" stopColor="#F5A0C4" />
          <Stop offset="1" stopColor="#F7A8CA" />
        </LinearGradient>
        <LinearGradient id="campusWaveFront" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#EC74A7" />
          <Stop offset="0.55" stopColor="#F08CB5" />
          <Stop offset="1" stopColor="#F390BA" />
        </LinearGradient>
      </Defs>

      {/* Bukit pale di belakang kampus */}
      <Path
        d={`M0 152 C ${w * 0.08} 142 ${w * 0.14} 180 ${w * 0.24} 184 C ${w * 0.34} 188 ${
          w * 0.4
        } 166 ${w * 0.5} 164 C ${w * 0.6} 162 ${w * 0.68} 138 ${w * 0.78} 126 C ${
          w * 0.88
        } 114 ${w * 0.94} 120 ${w} 112 L${w} ${SCENE_HEIGHT} L0 ${SCENE_HEIGHT} Z`}
        fill="#FEE6F0"
      />

      <G transform={`translate(${schoolLeft} ${schoolTop}) scale(${schoolScale})`}>
        {/* Bendera */}
        <Rect x={256} y={0} width={6} height={62} rx={3} fill="#F7B7D0" />
        <Path d="M262 2 L296 11 L262 24 Z" fill="#F7B7D0" />

        {/* Atap dan badan gedung tengah */}
        <Path d="M182 72 L260 28 L338 72 L333 83 L187 83 Z" fill="#F8C4DA" />
        <Rect x={200} y={80} width={120} height={138} rx={2} fill="#FBD8E6" />

        {/* Jendela lantai atas gedung tengah */}
        <Rect x={210} y={94} width={15} height={23} rx={1.5} fill="#FEEFF5" />
        <Rect x={235} y={94} width={15} height={23} rx={1.5} fill="#FEEFF5" />
        <Rect x={260} y={94} width={15} height={23} rx={1.5} fill="#FEEFF5" />
        <Rect x={285} y={94} width={15} height={23} rx={1.5} fill="#FEEFF5" />

        {/* Pintu masuk berkolom */}
        <Rect x={228} y={146} width={64} height={8} rx={2} fill="#F8C4DA" />
        <Rect x={232} y={154} width={7} height={54} rx={1.5} fill="#F8C4DA" />
        <Rect x={281} y={154} width={7} height={54} rx={1.5} fill="#F8C4DA" />
        <Rect x={245} y={154} width={30} height={54} rx={1} fill="#F9CCDE" />
        <Rect x={259} y={154} width={2} height={54} fill="#FBD8E6" />

        {/* Sayap kiri */}
        <Rect x={90} y={102} width={110} height={116} rx={1} fill="#FBD8E6" />
        <Path d="M84 106 L200 106 L200 94 L84 99 Z" fill="#F8C4DA" />
        <Rect x={104} y={118} width={17} height={22} rx={1.5} fill="#FEEFF5" />
        <Rect x={132} y={118} width={17} height={22} rx={1.5} fill="#FEEFF5" />
        <Rect x={160} y={118} width={17} height={22} rx={1.5} fill="#FEEFF5" />
        <Rect x={104} y={154} width={17} height={22} rx={1.5} fill="#FEEFF5" />
        <Rect x={132} y={154} width={17} height={22} rx={1.5} fill="#FEEFF5" />
        <Rect x={160} y={154} width={17} height={22} rx={1.5} fill="#FEEFF5" />

        {/* Sayap kanan */}
        <Rect x={320} y={102} width={110} height={116} rx={1} fill="#FBD8E6" />
        <Path d="M320 94 L436 99 L436 106 L320 106 Z" fill="#F8C4DA" />
        <Rect x={343} y={118} width={17} height={22} rx={1.5} fill="#FEEFF5" />
        <Rect x={371} y={118} width={17} height={22} rx={1.5} fill="#FEEFF5" />
        <Rect x={399} y={118} width={17} height={22} rx={1.5} fill="#FEEFF5" />
        <Rect x={343} y={154} width={17} height={22} rx={1.5} fill="#FEEFF5" />
        <Rect x={371} y={154} width={17} height={22} rx={1.5} fill="#FEEFF5" />
        <Rect x={399} y={154} width={17} height={22} rx={1.5} fill="#FEEFF5" />

        {/* Pondasi */}
        <Rect x={78} y={212} width={364} height={8} rx={2} fill="#F8C4DA" />
        <Rect x={196} y={208} width={128} height={8} rx={2} fill="#F9CCDE" />

        {/* Pohon kiri */}
        <Rect x={46} y={146} width={7} height={68} rx={3.5} fill="#F5B7CF" />
        <Path
          d="M49 168 L37 156 M51 180 L63 168"
          stroke="#F5B7CF"
          strokeWidth={4}
          strokeLinecap="round"
        />
        <Circle cx={49} cy={110} r={21} fill="#FAD0E1" />
        <Circle cx={34} cy={126} r={15} fill="#FAD0E1" />
        <Circle cx={64} cy={126} r={15} fill="#FAD0E1" />
        <Circle cx={49} cy={138} r={15} fill="#FAD0E1" />

        {/* Pohon kanan */}
        <Rect x={467} y={146} width={7} height={68} rx={3.5} fill="#F5B7CF" />
        <Path
          d="M470 168 L458 156 M472 180 L484 168"
          stroke="#F5B7CF"
          strokeWidth={4}
          strokeLinecap="round"
        />
        <Circle cx={470} cy={110} r={21} fill="#FAD0E1" />
        <Circle cx={455} cy={126} r={15} fill="#FAD0E1" />
        <Circle cx={485} cy={126} r={15} fill="#FAD0E1" />
        <Circle cx={470} cy={138} r={15} fill="#FAD0E1" />
      </G>

      {/* Gelombang tengah */}
      <Path
        d={`M0 205 C ${w * 0.12} 198 ${w * 0.22} 250 ${w * 0.34} 285 C ${w * 0.46} 320 ${
          w * 0.58
        } 345 ${w * 0.68} 348 C ${w * 0.8} 350 ${w * 0.9} 300 ${w} 220 L${w} ${SCENE_HEIGHT} L0 ${SCENE_HEIGHT} Z`}
        fill="url(#campusWaveMiddle)"
      />

      {/* Gelombang depan */}
      <Path
        d={`M0 280 C ${w * 0.1} 274 ${w * 0.2} 305 ${w * 0.32} 335 C ${w * 0.44} 365 ${
          w * 0.55
        } 380 ${w * 0.65} 377 C ${w * 0.77} 372 ${w * 0.88} 335 ${w} 292 L${w} ${SCENE_HEIGHT} L0 ${SCENE_HEIGHT} Z`}
        fill="url(#campusWaveFront)"
      />
    </Svg>
  );
}
