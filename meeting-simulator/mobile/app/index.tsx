import { Redirect } from 'expo-router';
import React from 'react';

import { useAppState } from '../src/context/AppStateContext';
import { LoadingScreen } from '../src/screens/LoadingScreen';

export default function IndexScreen() {
  const { state, isReady } = useAppState();

  if (!isReady) {
    return <LoadingScreen label="正在准备 MeetingHero..." />;
  }

  return <Redirect href={state.userName ? '/feed' : '/onboarding'} />;
}
