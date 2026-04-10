import React from 'react';
import { render } from '@testing-library/react-native';

import { AppState, AppStateProvider } from '../context/AppStateContext';

export function renderWithAppState(ui: React.ReactElement, initialState?: Partial<AppState>) {
  return render(
    <AppStateProvider initialState={initialState} disablePersistence>
      {ui}
    </AppStateProvider>
  );
}
