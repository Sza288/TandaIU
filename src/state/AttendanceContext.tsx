import React, { createContext, useContext, useRef, useState } from 'react';
import { Attendance, ExcuseReason, MutationResult, PracticumSession, Role } from '../types';
import { initialSessions } from '../data/sessions';
import { initialAttendances } from '../data/attendances';
import {
  applyCheckIn,
  applyCloseSession,
  applyMarkExcused,
  applyOpenSession,
} from './attendanceMutations';

type AttendanceState = {
  sessions: PracticumSession[];
  attendances: Attendance[];
  activeRole: Role | null;
  activePraktikanId: string | null;
  setActiveRole: (role: Role | null) => void;
  setActivePraktikanId: (id: string | null) => void;
  openSession: (sessionId: string) => MutationResult;
  closeSession: (sessionId: string) => MutationResult;
  checkIn: (sessionId: string, praktikanId: string) => MutationResult;
  markExcused: (
    sessionId: string,
    praktikanId: string,
    excuseReason: ExcuseReason,
  ) => MutationResult;
};

const AttendanceContext = createContext<AttendanceState | undefined>(undefined);

export function AttendanceProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<PracticumSession[]>(initialSessions);
  const [attendances, setAttendances] = useState<Attendance[]>(initialAttendances);
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [activePraktikanId, setActivePraktikanId] = useState<string | null>(null);
  const sessionsRef = useRef<PracticumSession[]>(initialSessions);
  const attendancesRef = useRef<Attendance[]>(initialAttendances);

  const openSession = (sessionId: string): MutationResult => {
    const mutation = applyOpenSession(sessionsRef.current, sessionId);
    if (mutation.result.ok) {
      sessionsRef.current = mutation.sessions;
      setSessions(mutation.sessions);
    }
    return mutation.result;
  };

  const closeSession = (sessionId: string): MutationResult => {
    const mutation = applyCloseSession(sessionsRef.current, sessionId);
    if (mutation.result.ok) {
      sessionsRef.current = mutation.sessions;
      setSessions(mutation.sessions);
    }
    return mutation.result;
  };

  const checkIn = (sessionId: string, praktikanId: string): MutationResult => {
    const mutation = applyCheckIn(
      sessionsRef.current,
      attendancesRef.current,
      sessionId,
      praktikanId
    );
    if (mutation.result.ok) {
      attendancesRef.current = mutation.attendances;
      setAttendances(mutation.attendances);
    }
    return mutation.result;
  };

  const markExcused = (
    sessionId: string,
    praktikanId: string,
    excuseReason: ExcuseReason,
  ): MutationResult => {
    const mutation = applyMarkExcused(
      sessionsRef.current,
      attendancesRef.current,
      sessionId,
      praktikanId,
      excuseReason,
    );
    if (mutation.result.ok) {
      attendancesRef.current = mutation.attendances;
      setAttendances(mutation.attendances);
    }
    return mutation.result;
  };

  return (
    <AttendanceContext.Provider
      value={{
        sessions,
        attendances,
        activeRole,
        activePraktikanId,
        setActiveRole,
        setActivePraktikanId,
        openSession,
        closeSession,
        checkIn,
        markExcused,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const context = useContext(AttendanceContext);
  if (context === undefined) {
    throw new Error('useAttendance must be used within an AttendanceProvider');
  }
  return context;
}
