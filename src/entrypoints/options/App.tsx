import { useEffect, useState, type ReactNode } from 'react';
import { AIProvidersSection } from './AIProviders';
import { AIPrivacySection, AITasksSection, PromptsSection } from './AISections';
import { DataSection, GeneralSection, ShortcutsSection, SubtitlesSection, WelcomeSection } from './GeneralSections';

interface Section {
  id: string;
  label: string;
  group?: string;
  render: (go: (hash: string) => void) => ReactNode;
}

const SECTIONS: Section[] = [
  { id: 'welcome', label: 'Get started', render: (go) => <WelcomeSection go={go} /> },
  { id: 'general', label: 'General', group: 'Learning', render: () => <GeneralSection /> },
  { id: 'subtitles', label: 'Subtitles & playback', render: () => <SubtitlesSection /> },
  { id: 'shortcuts', label: 'Keyboard shortcuts', render: () => <ShortcutsSection /> },
  { id: 'ai', label: 'AI providers', group: 'AI', render: () => <AIProvidersSection /> },
  { id: 'ai-tasks', label: 'Models per task', render: () => <AITasksSection /> },
  { id: 'ai-privacy', label: 'Privacy & cost', render: () => <AIPrivacySection /> },
  { id: 'prompts', label: 'Prompts', render: () => <PromptsSection /> },
  { id: 'data', label: 'Data & backup', group: 'Other', render: () => <DataSection /> },
];

function currentHash(): string {
  const h = location.hash.replace(/^#/, '');
  return SECTIONS.some((s) => s.id === h) ? h : 'general';
}

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
  const go = (hash: string) => {
    location.hash = hash;
  };
  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[1];
  return (
    <div className="lr-page">
      <nav className="lr-nav">
        <div className="lr-brand">
          <span className="dot" /> Captionary
        </div>
        {SECTIONS.map((s) => (
          <div key={s.id} style={{ display: 'contents' }}>
            {s.group && <div className="group">{s.group}</div>}
            <a href={`#${s.id}`} className={s.id === active ? 'active' : undefined}>
              {s.label}
            </a>
          </div>
        ))}
        <div className="group">Tools</div>
        <a href="/vocab.html">Saved words</a>
        <a href="/reader.html">Reader</a>
      </nav>
      <main className="lr-main">{section.render(go)}</main>
    </div>
  );
}
