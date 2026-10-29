import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

type Props = {
  width?: number;
  height?: number;
};

/**
 * Dekorasi sudut kiri atas mengikuti referensi landing: lingkaran pink besar
 * yang keluar dari tepi layar, bulan sabit pale di sisi kanannya, dan satu
 * garis lengkung tipis sebagai aksen.
 */
export default function TopBlob({ width = 400, height = 330 }: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 400 330" fill="none">
      <Defs>
        <LinearGradient id="topBlobFill" x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor="#F9BED8" />
          <Stop offset="0.55" stopColor="#F7AFCE" />
          <Stop offset="1" stopColor="#F5A6C7" />
        </LinearGradient>
      </Defs>

      {/* Bulan sabit pale di belakang lingkaran utama */}
      <Circle cx={200} cy={-170} r={243} fill="#FDE9F1" />

      {/* Lingkaran utama di sudut kiri atas */}
      <Circle cx={-102} cy={-236} r={438} fill="url(#topBlobFill)" />

      {/* Garis lengkung tipis di luar lingkaran */}
      <Path
        d="M182 92 C130 155 70 225 0 300"
        stroke="#F3A6C2"
        strokeWidth={3.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}
