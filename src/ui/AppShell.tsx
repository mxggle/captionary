import { useEffect, useState, type ReactNode } from 'react';
import { listVocab, watchVocab } from '@/lib/vocab';
import { BrandMark, IconBookmark, IconCards, IconDocument, IconSpark } from './icons';

export type AppPage =
  | 'vocab'
  | 'review'
  | 'reader'
  | 'tutor'
  | 'welcome'
  | 'general'
  | 'subtitles'
  | 'shortcuts'
  | 'ai'
  | 'ai-tasks'
  | 'ai-privacy'
  | 'prompts'
  | 'data';

export const SETTINGS_PAGES: { id: AppPage; label: string }[] = [
  { id: 'welcome', label: 'Get started' },
  { id: 'general', label: 'General' },
  { id: 'subtitles', label: 'Subtitles & playback' },
  { id: 'shortcuts', label: 'Keyboard shortcuts' },
  { id: 'ai', label: 'AI providers' },
  { id: 'ai-tasks', label: 'Models per task' },
  { id: 'ai-privacy', label: 'Privacy & cost' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'data', label: 'Data & backup' },
];

/** Number of saved words and phrases, kept live across tabs. */
export function useVocabCount(): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const load = () => void listVocab().then((items) => setCount(items.length));
    load();
    return watchVocab(load);
  }, []);
  return count;
}

/**
 * The one shell of every extension page (`AppNav` + main): the tools first, then the settings
 * sections, so moving between them never changes the layout. Stacks above the content under 760px.
 */
export function AppShell({ current, narrow, children }: { current: AppPage; narrow?: boolean; children: ReactNode }) {
  const count = useVocabCount();
  const item = (page: AppPage, href: string, label: string, icon?: ReactNode, n?: ReactNode) => (
    <a key={page} className="cap-nav__item" href={href} aria-current={page === current ? 'page' : undefined}>
      {icon}
      {label}
      {n !== undefined && n !== null && <span className="cap-nav__n">{n}</span>}
    </a>
  );
  return (
    <div className="cap-shell">
      <nav className="cap-nav" aria-label="Captionary">
        <div className="cap-nav__brand">
          <BrandMark />
          Captionary
        </div>
        {item('vocab', '/vocab.html', 'Saved words', <IconBookmark className="cap-ico" />, count || null)}
        {item('review', '/vocab.html#review', 'Review', <IconCards className="cap-ico" />)}
        {item('reader', '/reader.html', 'Reader', <IconDocument className="cap-ico" />)}
        {item('tutor', '/sidepanel.html#page', 'AI tutor', <IconSpark className="cap-ico" />)}
        <div className="cap-nav__group">Settings</div>
        {SETTINGS_PAGES.map((p) => item(p.id, `/options.html#${p.id}`, p.label))}
      </nav>
      <main className="cap-main">
        <div className={`cap-main__inner${narrow ? ' cap-main__inner--narrow' : ''}`}>{children}</div>
      </main>
    </div>
  );
}
