import { storage } from '#imports';

/** The screens of the setup guide (welcome.html), in order. */
export const SETUP_STEPS = ['hello', 'language', 'level', 'pin', 'tutor', 'try', 'done'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export interface SetupProgress {
  /** False from install until the learner reaches the end of the guide or skips it. */
  done: boolean;
  /** The screen the guide was left on, to resume there. */
  step: SetupStep;
}

/**
 * Progress through the setup guide. The fallback says "done" so people who installed before the
 * guide existed are never asked to finish it; a fresh install writes `done: false` (background.ts).
 */
export const setupProgress = storage.defineItem<SetupProgress>('local:setupProgress', {
  fallback: { done: true, step: 'hello' },
});
