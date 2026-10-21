import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { AppShell, SETTINGS_PAGES, type SettingsPageId } from '@/ui/AppShell';
import { PageTitleFocus } from '@/ui/controls';
import { AIProvidersSection } from './AIProviders';
import { AIPrivacySection, AITasksSection, PromptsSection } from './AISections';
import { DataSection, GeneralSection, ShortcutsSection, SubtitlesSection, WelcomeSection } from './GeneralSections';

const SECTIONS: Record<SettingsPageId, () => ReactNode> = {
  welcome: () => <WelcomeSection />,
  general: () => <GeneralSection />,
  subtitles: () => <SubtitlesSection />,
  shortcuts: () => <ShortcutsSection />,
  ai: () => <AIProvidersSection />,
  'ai-tasks': () => <AITasksSection />,
  'ai-privacy': () => <AIPrivacySection />,
  prompts: () => <PromptsSection />,
  data: () => <DataSection />,
};

function currentHash(): SettingsPageId {
  const h = location.hash.replace(/^#/, '');
  return SETTINGS_PAGES.find((s) => s.id === h)?.id ?? 'general';
}

/** Settings: every section in the shared shell, one section per hash. */
export function App() {
  const [active, setActive] = useState(currentHash);
  const { m } = useI18n();
  // A section change in place says nothing to a screen reader; the new section's title takes focus instead.
  const focusTitle = useRef(false);
  useEffect(() => {
    const onHash = () => {
      focusTitle.current = true;
      setActive(currentHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    const label = m.nav.pages[active];
    document.title = label ? `${label} · Captionary` : 'Captionary';
  }, [active, m]);
  return (
    <AppShell current={active} narrow>
      <PageTitleFocus.Provider value={focusTitle}>{SECTIONS[active]()}</PageTitleFocus.Provider>
    </AppShell>
  );
}
