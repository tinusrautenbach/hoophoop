/**
 * Touch Target Constants - WCAG 2.5.5 Compliance
 * Minimum sizes for accessibility during fast-paced basketball scoring.
 */

export const TOUCH_TARGETS = {
  primary: 'min-h-[48px] min-w-[48px]',
  secondary: 'min-h-[44px] min-w-[44px]',
  icon: 'min-h-[32px] min-w-[32px] p-2',
  inline: 'min-h-[28px] min-w-[28px] p-1',
} as const;

export const VISUAL_SIZES = {
  periodPortrait: 'text-sm',
  periodLandscape: 'text-xs',
  clockPortrait: 'text-4xl',
  clockLandscape: 'text-3xl',
  gameLogAction: 20,
  connectionIndicatorPortrait: 'w-3 h-3',
  connectionIndicatorLandscape: 'w-2 h-2',
} as const;

export const ANIMATION_DURATIONS = {
  mutationFeedback: 100,
  debounceWindow: 300,
  successFlash: 500,
  errorToast: 10000,
} as const;

export const LANDSCAPE_THRESHOLDS = {
  narrowDevice: 600,
  tabletMin: 768,
} as const;