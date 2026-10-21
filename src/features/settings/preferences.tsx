import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
type Preferences = {
  theme: 'light' | 'dark' | 'system';
  density: 'comfortable' | 'compact';
  collapsed: boolean;
};
const defaults: Preferences = { theme: 'light', density: 'comfortable', collapsed: false };
const Context = createContext<{
  preferences: Preferences;
  update: (next: Partial<Preferences>) => void;
}>({ preferences: defaults, update: () => undefined });
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem('blog-admin-preferences') ?? '{}',
      ) as Partial<Preferences>;
      return {
        theme: ['light', 'dark', 'system'].includes(stored.theme ?? '') ? stored.theme! : 'light',
        density: stored.density === 'compact' ? 'compact' : 'comfortable',
        collapsed: stored.collapsed === true,
      };
    } catch {
      return defaults;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('blog-admin-preferences', JSON.stringify(preferences));
    } catch {
      /* Preferences still work in memory. */
    }
    const query = matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      document.documentElement.classList.toggle(
        'dark',
        preferences.theme === 'dark' || (preferences.theme === 'system' && query.matches),
      );
    apply();
    query.addEventListener('change', apply);
    document.documentElement.dataset.density = preferences.density;
    return () => query.removeEventListener('change', apply);
  }, [preferences]);
  return (
    <Context.Provider
      value={{
        preferences,
        update: (next) => setPreferences((previous) => ({ ...previous, ...next })),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const usePreferences = () => useContext(Context);
