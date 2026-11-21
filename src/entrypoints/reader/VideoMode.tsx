import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { languageName, normalizeLang } from '@/lib/languages';
import { parseSubtitleFile } from '@/lib/subtitles/parse';
import type { Cue, TrackInfo } from '@/lib/subtitles/types';
import { detectLanguage } from '@/lib/translate';
import { keyName, SessionController, type SiteAdapter } from '@/content/controller';
import { setSession, useSession } from '@/content/store';
import { Overlay } from '@/content/ui/Overlay';
import { SubtitlePanel } from '@/content/ui/SubtitlePanel';
import { Note } from '@/ui/controls';
import { LanguageSelect, useSettings } from '@/ui/form';
import { BrandMark, IconCaptions, IconFilm, IconNext, IconPrev, IconRepeat, IconSettings, IconSpark } from '@/ui/icons';
import { ModeSwitch, type ReaderMode } from './mode';

/** Plays a local video file with subtitle files the user picked. */
class LocalAdapter implements SiteAdapter {
  readonly site = 'local' as const;
  /** Chrome's own control bar with its timeline. */
  readonly nativeControlsHeight = 72;
  video: HTMLVideoElement | null = null;
  tracks = new Map<string, Cue[]>();
  getVideo() {
    return this.video;
  }
  seek(seconds: number) {
    if (this.video) this.video.currentTime = seconds;
  }
  play() {
    void this.video?.play().catch(() => undefined);
  }
  pause() {
    this.video?.pause();
  }
  async loadTrack(trackId: string) {
    return this.tracks.get(trackId) ?? [];
  }
  setNativeSubtitlesHidden() {}
}

interface SubFile {
  name: string;
  cues: Cue[];
  lang: string;
}

async function readSubtitle(file: File, fallbackLang: string): Promise<SubFile> {
  const cues = parseSubtitleFile(file.name, await file.text());
  const sample = cues
    .slice(0, 40)
    .map((c) => c.text)
    .join(' ');
  const lang = (await detectLanguage(sample)) ?? fallbackLang;
  return { name: file.name, cues, lang: normalizeLang(lang) };
}

/** The reader's local video: the same captions, list, keys and look-ups as on the video sites. */
export function VideoMode({ onMode, titleRef }: { onMode: (m: ReaderMode) => void; titleRef: React.Ref<HTMLHeadingElement> }) {
  const { m, locale } = useI18n();
  const [settings] = useSettings();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState('');
  const [original, setOriginal] = useState<SubFile | null>(null);
  const [translation, setTranslation] = useState<SubFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const adapter = useRef(new LocalAdapter());
  const controllerRef = useRef<SessionController | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const autoPause = useSession((s) => s.settings.playback.autoPause);
  const listOpen = useSession((s) => s.settings.sidebar.open);

  useEffect(() => {
    const controller = new SessionController(adapter.current);
    controllerRef.current = controller;
    // Captions on the reader's video use the page's fonts and theme.
    setSession({ hostFont: 'var(--font-sans)', theme: undefined });
    void controller.init().then(() => setReady(true));
    return () => {
      controller.destroy();
      setSession({ media: null, cues: [], translations: [], tracks: [], status: 'idle', popup: null });
    };
  }, []);

  useEffect(() => () => void (videoUrl && URL.revokeObjectURL(videoUrl)), [videoUrl]);

  // Load subtitles into the session whenever files change.
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !ready || !original) return;
    const tracks: TrackInfo[] = [{ id: 'original', lang: original.lang, label: original.name }];
    adapter.current.tracks.set('original', original.cues);
    if (translation) {
      tracks.push({ id: 'translation', lang: translation.lang, label: translation.name });
      adapter.current.tracks.set('translation', translation.cues);
    }
    void controller.startMedia({ id: videoName || original.name, title: videoName || original.name, url: '' }, tracks, 'original');
  }, [original, translation, ready, videoName]);

  // Fullscreen the wrapper (with our subtitles) instead of the bare <video>.
  useEffect(() => {
    const onFs = () => {
      const video = adapter.current.video;
      if (video && document.fullscreenElement === video && wrapRef.current) {
        void document.exitFullscreen().then(() => wrapRef.current?.requestFullscreen());
      }
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  if (!settings) return null;
  const fallbackLang = settings.targetLanguage !== 'auto' ? settings.targetLanguage : 'en';
  const controller = controllerRef.current;
  const keys = settings.shortcuts;

  const pickSub = async (file: File | undefined, which: 'original' | 'translation') => {
    if (!file) return;
    try {
      const sub = await readSubtitle(file, which === 'original' ? fallbackLang : settings.nativeLanguage);
      if (!sub.cues.length) throw new Error(m.reader.video.noSubtitlesInFile(file.name));
      if (which === 'original') setOriginal(sub);
      else setTranslation(sub);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const k = (key: string) => keyName(key) && <span className="cap-kbd">{keyName(key)}</span>;

  // Cleared after reading, so picking the same file again still loads it.
  const takeFile = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = '';
    return file;
  };

  // A full-width page without the app's side navigation: next to it the video would lose about a third of its width.
  return (
    <main className="cap-video-page">
      <div className="cap-row cap-video-page__head">
        <div className="cap-row cap-video-page__brand">
          <BrandMark />
          <h1 className="cap-video-page__title" ref={titleRef} tabIndex={-1}>
            {m.reader.title}
          </h1>
        </div>
        <ModeSwitch mode="video" onMode={onMode} />
        <span className="cap-spacer" />
        <a className="cap-btn cap-btn--ghost" href="/vocab.html">
          {m.nav.savedWords}
        </a>
        <a className="cap-iconbtn" href="/options.html#subtitles" aria-label={m.common.settings} title={m.common.settings}>
          <IconSettings className="cap-ico" />
        </a>
      </div>

      <div className="cap-card" style={{ padding: '12px 14px' }}>
        <div className="cap-row" style={{ gap: 10 }}>
          <label className="cap-btn cap-file-btn" title={videoName || undefined}>
            <IconFilm className="cap-ico" />
            <span className="cap-file-btn__name">{videoName || m.reader.video.chooseVideoFile}</span>
            <input
              type="file"
              accept="video/*,audio/*,.mkv"
              onChange={(e) => {
                const file = takeFile(e.target);
                if (!file) return;
                setVideoUrl(URL.createObjectURL(file));
                setVideoName(file.name.replace(/\.[^.]+$/, ''));
              }}
            />
          </label>
          <label className="cap-btn cap-file-btn" title={original?.name}>
            <IconCaptions className="cap-ico" />
            <span className="cap-file-btn__name">{original ? original.name : m.reader.video.subtitlesFile}</span>
            <input type="file" accept=".srt,.vtt,.ttml,.dfxp,.xml" onChange={(e) => void pickSub(takeFile(e.target), 'original')} />
          </label>
          {original && (
            <LanguageSelect
              variant="button"
              className="cap-btn--sm"
              label={m.reader.video.languageOfSubtitles}
              value={original.lang}
              onChange={(lang) => setOriginal({ ...original, lang })}
              style={{ height: 36 }}
            />
          )}
          <label className="cap-btn cap-btn--ghost cap-file-btn" title={translation?.name}>
            <IconCaptions className="cap-ico" />
            <span className="cap-file-btn__name">{translation ? translation.name : m.reader.video.translationSubtitlesOptional}</span>
            <input type="file" accept=".srt,.vtt,.ttml,.dfxp,.xml" onChange={(e) => void pickSub(takeFile(e.target), 'translation')} />
          </label>
          <span className="cap-spacer" />
          <span className="cap-help">{m.reader.video.localVideoHelp(languageName(settings.nativeLanguage, locale))}</span>
        </div>
      </div>
      {error && <Note tone="danger">{error}</Note>}

      {videoUrl && controller ? (
        <div className="cap-video-layout">
          <div className="cap-video-stage">
            <div className="cap-video-frame" ref={wrapRef}>
              <video
                src={videoUrl}
                controls
                ref={(el) => {
                  adapter.current.video = el;
                  controller.attachVideo(el);
                }}
              />
              <Overlay controller={controller} />
            </div>
            <div className="cap-row" style={{ marginTop: 12, gap: 8 }}>
              <button className="cap-btn" onClick={() => controller.prev()}>
                <IconPrev className="cap-ico" />
                {m.reader.video.previous}
                {k(keys.prevLine)}
              </button>
              <button className="cap-btn" onClick={() => controller.repeat()}>
                <IconRepeat className="cap-ico" />
                {m.reader.video.repeat}
                {k(keys.repeatLine)}
              </button>
              <button className="cap-btn" onClick={() => controller.next()}>
                <IconNext className="cap-ico" />
                {m.reader.video.next}
                {k(keys.nextLine)}
              </button>
              <button
                className="cap-chip cap-chip--sm"
                aria-pressed={autoPause}
                style={{ height: 36 }}
                onClick={() => controller.runAction('toggleAutoPause')}
              >
                {m.reader.video.pauseAfterEachLine}
                {keyName(keys.toggleAutoPause) && <span className="cap-chip__n">{keyName(keys.toggleAutoPause)}</span>}
              </button>
              <span className="cap-spacer" />
              <button className="cap-btn cap-btn--primary" onClick={() => controller.explainCurrentLine()}>
                <IconSpark className="cap-ico" />
                {m.reader.video.breakDownLine}
                {k(keys.explainLine)}
              </button>
            </div>
          </div>
          {listOpen && (
            <div className="cap-video-side">
              <SubtitlePanel
                controller={controller}
                variant="page"
                subtitle={original ? m.reader.video.linesCount(original.name, original.cues.length) : undefined}
              />
            </div>
          )}
        </div>
      ) : (
        <p className="cap-help" style={{ margin: 0 }}>
          {m.reader.video.emptyPrompt}
        </p>
      )}
    </main>
  );
}
