import { useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { AppShell, SETTINGS_PAGES, type SettingsPageId } from '@/ui/AppShell';
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
  useEffect(() => {
    const onHash = () => {
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
      {SECTIONS[active]()}
    </AppShell>
  );
}
