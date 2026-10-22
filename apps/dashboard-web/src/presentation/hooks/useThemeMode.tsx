import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'aynalytics:theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

interface ThemeModeContextValue {
  /** Choix de l'utilisateur. */
  mode: ThemeMode;
  /** Theme effectivement applique (`system` resolu). */
  dark: boolean;
  setMode: (mode: ThemeMode) => void;
}

function loadMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

/** Suit le theme du systeme (clair/sombre), en direct. */
function usePrefersDark(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia(DARK_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return dark;
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(loadMode);
  const prefersDark = usePrefersDark();
  const dark = mode === 'system' ? prefersDark : mode === 'dark';

  useEffect(() => {
    // Barres de defilement et controles natifs dans le bon theme.
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [dark]);

  const value = useMemo<ThemeModeContextValue>(
    () => ({
      mode,
      dark,
      setMode: (next) => {
        setModeState(next);
        try {
          if (next === 'system') localStorage.removeItem(STORAGE_KEY);
          else localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // stockage indisponible : choix non memorise
        }
      },
    }),
    [mode, dark],
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode(): ThemeModeContextValue {
  const context = useContext(ThemeModeContext);
  if (!context) throw new Error('useThemeMode doit etre utilise dans <ThemeModeProvider>');
  return context;
}
