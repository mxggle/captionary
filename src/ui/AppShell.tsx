import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
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

export type SettingsPageId = Exclude<AppPage, 'vocab' | 'review' | 'reader' | 'tutor'>;

export const SETTINGS_PAGES: { id: SettingsPageId; label: string }[] = [
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
 * sections, so moving between them never changes the layout. Under 760px the nav sits above the
 * content, each group one row that scrolls sideways.
 */
export function AppShell({ current, narrow, children }: { current: AppPage; narrow?: boolean; children: ReactNode }) {
  const count = useVocabCount();
  const { m } = useI18n();
  const navRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  // Centre the current page in its row when the row scrolls sideways. Only the row moves: scrollIntoView
  // would also scroll the page back up to the nav.
  useEffect(() => {
    const link = navRef.current?.querySelector('[aria-current="page"]');
    const row = link?.parentElement;
    if (!link || !row || row.scrollWidth <= row.clientWidth) return;
    const l = link.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    row.scrollLeft += l.left + l.width / 2 - (r.left + r.width / 2);
  }, [current]);
  const item = (page: AppPage, href: string, label: string, icon?: ReactNode, n?: ReactNode) => (
    <a key={page} className="cap-nav__item" href={href} aria-current={page === current ? 'page' : undefined}>
      {icon}
      {label}
      {n !== undefined && n !== null && <span className="cap-nav__n">{n}</span>}
    </a>
  );
  return (
    <div className="cap-shell">
      {/* Pages route on the hash, so the skip link moves focus itself instead of linking to #main. */}
      <a
        className="cap-skip"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          const main = mainRef.current;
          (main?.querySelector<HTMLElement>('h1[tabindex]') ?? main)?.focus();
        }}
      >
        {m.nav.skipToContent}
      </a>
      <nav className="cap-nav" aria-label="Captionary" ref={navRef}>
        <div className="cap-nav__brand">
          <BrandMark />
          Captionary
        </div>
        <div className="cap-nav__list">
          {item('vocab', '/vocab.html', m.nav.savedWords, <IconBookmark className="cap-ico" />, count || null)}
          {item('review', '/vocab.html#review', m.nav.review, <IconCards className="cap-ico" />)}
          {item('reader', '/reader.html', m.nav.reader, <IconDocument className="cap-ico" />)}
          {item('tutor', '/sidepanel.html#page', m.nav.aiTutor, <IconSpark className="cap-ico" />)}
        </div>
        <div className="cap-nav__group">{m.nav.settingsGroup}</div>
        <div className="cap-nav__list">{SETTINGS_PAGES.map((p) => item(p.id, `/options.html#${p.id}`, m.nav.pages[p.id]))}</div>
      </nav>
      <main className="cap-main" ref={mainRef} tabIndex={-1}>
        <div className={`cap-main__inner${narrow ? ' cap-main__inner--narrow' : ''}`}>{children}</div>
      </main>
    </div>
  );
}
