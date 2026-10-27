import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

type TopLeftAccentProps = {
  width: number;
};

export function TopLeftAccent({ width }: TopLeftAccentProps) {
  return (
    <Svg
      width={width}
      height={width}
      viewBox="0 0 340 340"
      fill="none"
      preserveAspectRatio="xMinYMin meet"
    >
      <Path
        d="M0 0 H276 C270 56 236 92 176 116 C112 142 66 176 46 220 C32 250 26 274 22 300 L0 300 Z"
        fill="#F6B7CB"
      />
      <Path
        d="M0 310 C80 262 150 218 224 188 C282 164 312 110 326 36"
        stroke="#FFFFFF"
        strokeWidth={2.5}
        strokeLinecap="round"
        opacity={0.85}
      />
      <Path
        d="M0 332 C88 284 164 242 238 212 C298 188 328 134 338 58"
        stroke="#F4B9CE"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

type CampusIllustrationProps = {
  height: number;
};

export function CampusIllustration({ height }: CampusIllustrationProps) {
  return (
    <Svg
      width="100%"
      height={height}
      viewBox="0 0 1024 600"
      fill="none"
      preserveAspectRatio="xMidYMax slice"
    >
      <Path
        d="M0 430 C170 360 300 378 464 418 C652 466 826 396 1024 326 L1024 600 L0 600 Z"
        fill="#FDEEF4"
      />
      <Path
        d="M0 500 C150 458 300 472 486 508 C668 544 842 488 1024 438 L1024 600 L0 600 Z"
        fill="#F9D4E2"
      />

      <G>
        <Rect x={286} y={352} width={120} height={138} rx={4} fill="#FBE0E9" />
        <Rect x={618} y={352} width={120} height={138} rx={4} fill="#FBE0E9" />
        <Rect x={396} y={316} width={232} height={174} rx={4} fill="#FCE7EE" />
        <Path d="M366 324 L512 242 L658 324 Z" fill="#F6C3D4" />
        <Rect x={378} y={318} width={268} height={12} rx={6} fill="#F8D2DF" />

        <Rect x={308} y={378} width={24} height={30} rx={3} fill="#FFF7FA" />
        <Rect x={350} y={378} width={24} height={30} rx={3} fill="#FFF7FA" />
        <Rect x={308} y={426} width={24} height={30} rx={3} fill="#FFF7FA" />
        <Rect x={350} y={426} width={24} height={30} rx={3} fill="#FFF7FA" />

        <Rect x={650} y={378} width={24} height={30} rx={3} fill="#FFF7FA" />
        <Rect x={692} y={378} width={24} height={30} rx={3} fill="#FFF7FA" />
        <Rect x={650} y={426} width={24} height={30} rx={3} fill="#FFF7FA" />
        <Rect x={692} y={426} width={24} height={30} rx={3} fill="#FFF7FA" />

        <Rect x={420} y={348} width={22} height={28} rx={3} fill="#FFF7FA" />
        <Rect x={466} y={348} width={22} height={28} rx={3} fill="#FFF7FA" />
        <Rect x={536} y={348} width={22} height={28} rx={3} fill="#FFF7FA" />
        <Rect x={582} y={348} width={22} height={28} rx={3} fill="#FFF7FA" />

        <Rect x={420} y={390} width={22} height={28} rx={3} fill="#FFF7FA" />
        <Rect x={466} y={390} width={22} height={28} rx={3} fill="#FFF7FA" />
        <Rect x={536} y={390} width={22} height={28} rx={3} fill="#FFF7FA" />
        <Rect x={582} y={390} width={22} height={28} rx={3} fill="#FFF7FA" />

        <Path
          d="M466 490 L466 452 C466 432 485 420 512 420 C539 420 558 432 558 452 L558 490 Z"
          fill="#F8C9D9"
        />
        <Path
          d="M484 490 L484 458 C484 446 496 438 512 438 C528 438 540 446 540 458 L540 490 Z"
          fill="#FFF7FA"
        />

        <Rect x={510} y={168} width={4} height={78} rx={2} fill="#F3B2C8" />
        <Path d="M514 174 L562 188 L514 202 Z" fill="#EE8FB2" />
        <Circle cx={512} cy={238} r={5} fill="#F6C3D4" />
      </G>

      <G>
        <Rect x={238} y={416} width={8} height={68} rx={4} fill="#F5C0D2" />
        <Circle cx={224} cy={420} r={24} fill="#FAD9E4" />
        <Circle cx={246} cy={404} r={28} fill="#FAD9E4" />
        <Circle cx={264} cy={428} r={22} fill="#FAD9E4" />
      </G>
      <G>
        <Rect x={788} y={416} width={8} height={68} rx={4} fill="#F5C0D2" />
        <Circle cx={774} cy={420} r={24} fill="#FAD9E4" />
        <Circle cx={796} cy={404} r={28} fill="#FAD9E4" />
        <Circle cx={814} cy={428} r={22} fill="#FAD9E4" />
      </G>

      <Path
        d="M0 540 C150 492 300 512 480 545 C680 582 848 532 1024 488 L1024 600 L0 600 Z"
        fill="#F6B8CD"
      />
      <Path
        d="M0 574 C130 552 270 566 430 586 C620 610 760 576 904 556 C950 550 990 544 1024 538 L1024 600 L0 600 Z"
        fill="#F19AB8"
      />
      <Path d="M0 600 L0 562 C70 572 146 590 226 600 Z" fill="#EE86AC" />
    </Svg>
  );
}
