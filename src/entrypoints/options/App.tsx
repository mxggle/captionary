import { useEffect, useState, type ReactNode } from 'react';
import { AppShell, SETTINGS_PAGES, type AppPage } from '@/ui/AppShell';
import { AIProvidersSection } from './AIProviders';
import { AIPrivacySection, AITasksSection, PromptsSection } from './AISections';
import { DataSection, GeneralSection, ShortcutsSection, SubtitlesSection, WelcomeSection } from './GeneralSections';

const SECTIONS: Record<string, (go: (hash: string) => void) => ReactNode> = {
  welcome: (go) => <WelcomeSection go={go} />,
  general: () => <GeneralSection />,
  subtitles: () => <SubtitlesSection />,
  shortcuts: () => <ShortcutsSection />,
  ai: () => <AIProvidersSection />,
  'ai-tasks': () => <AITasksSection />,
  'ai-privacy': () => <AIPrivacySection />,
  prompts: () => <PromptsSection />,
  data: () => <DataSection />,
};

function currentHash(): AppPage {
  const h = location.hash.replace(/^#/, '');
  return (SETTINGS_PAGES.find((s) => s.id === h)?.id ?? 'general') as AppPage;
}

/** Settings: every section in the shared shell, one section per hash. */
export function App() {
  const [active, setActive] = useState(currentHash);
  useEffect(() => {
    const onHash = () => {
      setActive(currentHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    const label = SETTINGS_PAGES.find((s) => s.id === active)?.label;
    document.title = label ? `${label} · Captionary` : 'Captionary';
  }, [active]);
  const go = (hash: string) => {
    location.hash = hash;
  };
  return (
    <AppShell current={active} narrow>
      {SECTIONS[active](go)}
    </AppShell>
  );
}
