const DEMO_CLASS_ROSTER = Array.from({ length: 27 }, (_, index) => `p${index + 1}`);

const SESSION_ENROLLMENTS: Record<string, readonly string[]> = {
  s1: DEMO_CLASS_ROSTER,
  s2: DEMO_CLASS_ROSTER,
  s3: DEMO_CLASS_ROSTER,
  s4: DEMO_CLASS_ROSTER,
  s5: DEMO_CLASS_ROSTER,
  s6: DEMO_CLASS_ROSTER,
  s7: DEMO_CLASS_ROSTER,
  s8: DEMO_CLASS_ROSTER,
  s9: DEMO_CLASS_ROSTER,
  s10: DEMO_CLASS_ROSTER,
  s11: DEMO_CLASS_ROSTER,
  s12: DEMO_CLASS_ROSTER,
};

export function getSessionIdsForPraktikan(praktikanId: string): string[] {
  return Object.entries(SESSION_ENROLLMENTS)
    .filter(([, praktikanIds]) => praktikanIds.includes(praktikanId))
    .map(([sessionId]) => sessionId);
}

export function getPraktikanIdsForSession(sessionId: string): string[] {
  return [...(SESSION_ENROLLMENTS[sessionId] ?? [])];
}
