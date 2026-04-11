import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type AppState = {
  userId: string | null;
  userName: string | null;
  currentRoomId: string | null;
  currentChatSessionId: string | null;
  chatDialogueScript: unknown[];
  chatProgress: number;
  userTurnCount: number;
  settlementData: unknown;
  feedScrollIndex: number;
  cardsSinceLastChat: number;
  dmBannerShown: number;
  completedRoomIds: string[];
};

const PERSIST_KEYS: Array<keyof AppState> = ['userId', 'userName', 'completedRoomIds'];
const JSON_KEYS: Array<keyof AppState> = ['completedRoomIds'];

const DEFAULT_STATE: AppState = {
  userId: null,
  userName: null,
  currentRoomId: null,
  currentChatSessionId: null,
  chatDialogueScript: [],
  chatProgress: 0,
  userTurnCount: 0,
  settlementData: null,
  feedScrollIndex: 0,
  cardsSinceLastChat: 0,
  dmBannerShown: 0,
  completedRoomIds: [],
};

function generateUuid() {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type AppStateContextValue = {
  state: AppState;
  isReady: boolean;
  updateState: (updates: Partial<AppState>) => void;
  resetState: () => void;
  clearAll: () => Promise<void>;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

type AppStateProviderProps = {
  children: React.ReactNode;
  initialState?: Partial<AppState>;
  disablePersistence?: boolean;
};

export function AppStateProvider({ children, initialState, disablePersistence = false }: AppStateProviderProps) {
  const [state, setState] = useState<AppState>(() => {
    if (!disablePersistence) {
      return DEFAULT_STATE;
    }

    return {
      ...DEFAULT_STATE,
      ...initialState,
      userId: initialState?.userId || generateUuid(),
      completedRoomIds: initialState?.completedRoomIds || [],
    };
  });
  const [isReady, setIsReady] = useState(disablePersistence);

  useEffect(() => {
    if (disablePersistence) {
      return undefined;
    }

    let mounted = true;

    async function hydrate() {
      const persisted: Partial<AppState> = {};

      for (const key of PERSIST_KEYS) {
        const raw = await AsyncStorage.getItem(`app_${key}`);
        if (raw !== null) {
          persisted[key] = JSON_KEYS.includes(key) ? JSON.parse(raw) : raw;
        }
      }

      if (!persisted.userId) {
        persisted.userId = generateUuid();
        await AsyncStorage.setItem('app_userId', persisted.userId);
      }

      if (mounted) {
        setState({ ...DEFAULT_STATE, ...persisted });
        setIsReady(true);
      }
    }

    hydrate().catch(() => setIsReady(true));

    return () => {
      mounted = false;
    };
  }, [disablePersistence]);

  useEffect(() => {
    if (!isReady || disablePersistence) return;

    PERSIST_KEYS.forEach((key) => {
      const value = state[key];
      if (value === null || value === undefined) {
        AsyncStorage.removeItem(`app_${key}`).catch(() => undefined);
        return;
      }

      const serialized = JSON_KEYS.includes(key) ? JSON.stringify(value) : String(value);
      AsyncStorage.setItem(`app_${key}`, serialized).catch(() => undefined);
    });
  }, [isReady, state]);

  const updateState = useCallback((updates: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetState = useCallback(() => {
    setState((prev) => ({
      ...DEFAULT_STATE,
      userId: prev.userId,
      userName: prev.userName,
      completedRoomIds: prev.completedRoomIds,
    }));
  }, []);

  const clearAll = useCallback(async () => {
    await Promise.all(PERSIST_KEYS.map((key) => AsyncStorage.removeItem(`app_${key}`)));
    const newUserId = generateUuid();
    await AsyncStorage.setItem('app_userId', newUserId);
    setState({ ...DEFAULT_STATE, userId: newUserId });
  }, []);

  const value = useMemo<AppStateContextValue>(
    () => ({
      state,
      isReady,
      updateState,
      resetState,
      clearAll,
    }),
    [clearAll, isReady, resetState, state, updateState]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }

  return context;
}
