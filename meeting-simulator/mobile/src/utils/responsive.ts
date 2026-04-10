import { useWindowDimensions } from 'react-native';

import { metrics } from '../theme/colors';

export type Breakpoint = 'compact' | 'medium' | 'expanded';

export function getBreakpoint(width: number): Breakpoint {
  if (width >= 900) return 'expanded';
  if (width >= 600) return 'medium';
  return 'compact';
}

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const breakpoint = getBreakpoint(width);
  const horizontalPadding = breakpoint === 'compact' ? 16 : breakpoint === 'medium' ? 24 : 32;
  const maxWidth =
    breakpoint === 'compact'
      ? metrics.compactMaxWidth
      : breakpoint === 'medium'
        ? metrics.mediumMaxWidth
        : metrics.expandedMaxWidth;

  return {
    width,
    height,
    breakpoint,
    horizontalPadding,
    contentWidth: Math.min(maxWidth, width - horizontalPadding * 2),
    isTablet: breakpoint !== 'compact',
  };
}
