/**
 * Shared framer-motion config for consistent, performant animations.
 * Short durations and tween transitions to avoid jank.
 */
export const motionConfig = {
  /** Card hover: subtle lift and shadow */
  cardHover: {
    y: -2,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  /** Nav item hover: subtle shift */
  navHover: {
    x: 2,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  /** Section entrance */
  sectionEntrance: {
    duration: 0.45,
    ease: [0.22, 1, 0.36, 1] as const, // easeOutExpo
  },
  /** Progress transitions */
  progress: {
    duration: 0.6,
    ease: 'easeInOut' as const,
  },
  /** Step change fade */
  stepChange: {
    duration: 0.25,
    ease: 'easeOut' as const,
  },
} as const
