import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const mascotImage = require('../../../assets/images/tandaiu-mascot.png');

const TRANSITION_DURATION = 900;
const TARGET_MEASURE_TIMEOUT = 500;
const LANDING_ZOOM_BUMP = 0.45;
const PULSE_START_SCALE = 0.78;
const PULSE_ZOOM_BUMP = 0.35;
const PULSE_FADE_IN_END = 0.12;

export type RoleLogoRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TransitionPhase = 'idle' | 'preparing' | 'animating';

type RoleTransitionContextValue = {
  phase: TransitionPhase;
  rootOffset: { x: number; y: number };
  startFromLanding: (rect: RoleLogoRect) => void;
  startMascotPulse: () => void;
  registerTarget: (rect: RoleLogoRect) => void;
};

const RoleTransitionContext = createContext<RoleTransitionContextValue | null>(null);

export function RoleTransitionProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<TransitionPhase>('idle');
  const [source, setSource] = useState<RoleLogoRect | null>(null);
  const [target, setTarget] = useState<RoleLogoRect | null>(null);
  const [rootOffset, setRootOffset] = useState({ x: 0, y: 0 });
  const rootRef = useRef<ComponentRef<typeof View>>(null);
  const progress = useSharedValue(0);

  const measureRoot = useCallback(() => {
    rootRef.current?.measureInWindow?.((x, y) => {
      setRootOffset((previous) =>
        previous.x === x && previous.y === y ? previous : { x, y }
      );
    });
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(measureRoot);
    return () => cancelAnimationFrame(frame);
  }, [measureRoot]);

  const finish = useCallback(() => {
    setPhase('idle');
    setSource(null);
    setTarget(null);
  }, []);

  const startFromLanding = useCallback(
    (rect: RoleLogoRect) => {
      // Reanimated shared values are intentionally mutable.
      // eslint-disable-next-line react-hooks/immutability
      progress.value = 0;
      setSource(rect);
      setTarget(null);
      setPhase('preparing');
    },
    [progress]
  );

  const startMascotPulse = useCallback(() => {
    // A pulse starts on the destination page, so no source rect is needed.
    // eslint-disable-next-line react-hooks/immutability
    progress.value = 0;
    setSource(null);
    setTarget(null);
    setPhase('preparing');
  }, [progress]);

  const registerTarget = useCallback(
    (rect: RoleLogoRect) => {
      if (phase !== 'preparing') return;
      setTarget(rect);
      setPhase('animating');
    },
    [phase]
  );

  useEffect(() => {
    if (phase !== 'animating' || !target) return;

    // Reanimated shared values are intentionally mutable.
    // eslint-disable-next-line react-hooks/immutability
    progress.value = 0;
    progress.value = withTiming(
      1,
      {
        duration: TRANSITION_DURATION,
        easing: Easing.inOut(Easing.cubic),
      },
      (completed) => {
        if (completed) {
          runOnJS(finish)();
        }
      }
    );
  }, [finish, phase, progress, target]);

  // If the target screen never measures its logo, don't leave the overlay stuck.
  useEffect(() => {
    if (phase !== 'preparing') return;
    const timeout = setTimeout(finish, TARGET_MEASURE_TIMEOUT);
    return () => clearTimeout(timeout);
  }, [finish, phase]);

  const value = useMemo(
    () => ({
      phase,
      rootOffset,
      startFromLanding,
      startMascotPulse,
      registerTarget,
    }),
    [phase, registerTarget, rootOffset, startFromLanding, startMascotPulse]
  );

  return (
    <RoleTransitionContext.Provider value={value}>
      <View ref={rootRef} onLayout={measureRoot} style={styles.root}>
        {children}
        {phase === 'animating' && target ? (
          <RoleLogoOverlay source={source} target={target} progress={progress} />
        ) : null}
      </View>
    </RoleTransitionContext.Provider>
  );
}

export function useRoleTransition() {
  const value = useContext(RoleTransitionContext);
  if (!value) {
    throw new Error('useRoleTransition must be used inside RoleTransitionProvider');
  }
  return value;
}

function RoleLogoOverlay({
  source,
  target,
  progress,
}: {
  source: RoleLogoRect | null;
  target: RoleLogoRect | null;
  progress: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    if (!target) {
      const base = source ?? { x: 0, y: 0, width: 0, height: 0 };
      return {
        width: base.width,
        height: base.height,
        opacity: source ? 1 : 0,
        transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
      };
    }

    const base = source ?? target;
    const p = progress.value;
    const startScale = source ? 1 : PULSE_START_SCALE;
    const endScale = source ? target.width / source.width : 1;
    const bump = source ? LANDING_ZOOM_BUMP : PULSE_ZOOM_BUMP;

    // One continuous scale curve: grow first, then settle into the target.
    const scale =
      startScale + (endScale - startScale) * p + Math.sin(Math.PI * p) * bump;

    let translateX = 0;
    let translateY = 0;
    if (source) {
      const sourceCenterX = source.x + source.width / 2;
      const sourceCenterY = source.y + source.height / 2;
      const targetCenterX = target.x + target.width / 2;
      const targetCenterY = target.y + target.height / 2;
      translateX = interpolate(p, [0, 1], [0, targetCenterX - sourceCenterX]);
      translateY = interpolate(p, [0, 1], [0, targetCenterY - sourceCenterY]);
    }

    return {
      width: base.width,
      height: base.height,
      opacity: source
        ? 1
        : interpolate(p, [0, PULSE_FADE_IN_END, 1], [0, 1, 1]),
      transform: [{ translateX }, { translateY }, { scale }],
    };
  }, [progress, source, target]);

  if (!source && !target) return null;
  const base = source ?? target;

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.overlayLogo,
        { left: base!.x, top: base!.y },
        animatedStyle,
      ]}
    >
      <Image
        source={mascotImage}
        style={styles.overlayImage}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlayLogo: {
    position: 'absolute',
    zIndex: 1000,
    elevation: 1000,
  },
  overlayImage: {
    width: '100%',
    height: '100%',
  },
});
