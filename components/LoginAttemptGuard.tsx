'use client';

import { useState, useEffect, useCallback } from 'react';
import { Lock, Timer } from 'lucide-react';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

type LoginAttemptGuardState = {
  attempts: number;
  locked: boolean;
  lockoutRemaining: number;
  recordFailedAttempt: () => void;
  resetAttempts: () => void;
  canSubmit: boolean;
};

export function useLoginAttemptGuard(): LoginAttemptGuardState {
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  useEffect(() => {
    if (!locked) return;
    const interval = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1000) {
          setLocked(false);
          setAttempts(0);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [locked]);

  const recordFailedAttempt = useCallback(() => {
    setAttempts((prev) => {
      const next = prev + 1;
      if (next >= MAX_ATTEMPTS) {
        setLocked(true);
        setLockoutRemaining(LOCKOUT_MS);
      }
      return next;
    });
  }, []);

  const resetAttempts = useCallback(() => {
    setAttempts(0);
    setLocked(false);
    setLockoutRemaining(0);
  }, []);

  return {
    attempts,
    locked,
    lockoutRemaining,
    recordFailedAttempt,
    resetAttempts,
    canSubmit: !locked,
  };
}

export function LockoutBanner({ remaining }: { remaining: number }) {
  if (remaining <= 0) return null;
  const seconds = Math.ceil(remaining / 1000);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <Lock className="h-4 w-4 shrink-0" />
      <span>
        Too many failed attempts. Form locked for{' '}
        <span className="font-bold flex items-center gap-1 inline-flex">
          <Timer className="h-3.5 w-3.5" />
          {seconds}s
        </span>
      </span>
    </div>
  );
}

export function AttemptCounter({ attempts }: { attempts: number }) {
  if (attempts === 0) return null;
  const remaining = MAX_ATTEMPTS - attempts;
  return (
    <p className="text-xs text-muted-foreground">
      {remaining} attempt{remaining !== 1 ? 's' : ''} remaining before lockout.
    </p>
  );
}
