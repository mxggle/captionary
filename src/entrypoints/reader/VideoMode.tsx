import { useEffect, useRef, useState } from 'react';
import { normalizeLang } from '@/lib/languages';
import { parseSubtitleFile } from '@/lib/subtitles/parse';
import type { Cue, TrackInfo } from '@/lib/subtitles/types';
import { detectLanguage } from '@/lib/translate';
import { SessionController, type SiteAdapter } from '@/content/controller';
import { setSession } from '@/content/store';
import { Overlay } from '@/content/ui/Overlay';
import { Sidebar } from '@/content/ui/Sidebar';
import { LanguageSelect, useSettings } from '@/ui/form';

/** Plays a local video file with subtitle files the user picked. */
class LocalAdapter implements SiteAdapter {
  readonly site = 'local' as const;
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

export function VideoMode() {
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

  useEffect(() => {
    const controller = new SessionController(adapter.current);
    controllerRef.current = controller;
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

  const pickSub = async (file: File | undefined, which: 'original' | 'translation') => {
    if (!file) return;
    try {
      const sub = await readSubtitle(file, which === 'original' ? fallbackLang : settings.nativeLanguage);
      if (!sub.cues.length) throw new Error(`No subtitles found in ${file.name}`);
      if (which === 'original') setOriginal(sub);
      else setTranslation(sub);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <>
      <div className="lr-card">
        <div className="lr-row">
          <label className="lr-btn primary">
            {videoName ? 'Change video' : 'Choose video file'}
            <input
              type="file"
              accept="video/*,audio/*,.mkv"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setVideoUrl(URL.createObjectURL(file));
                setVideoName(file.name.replace(/\.[^.]+$/, ''));
              }}
            />
          </label>
          <label className="lr-btn">
            {original ? `Subtitles: ${original.name}` : 'Subtitles (.srt / .vtt)'}
            <input type="file" accept=".srt,.vtt,.ttml,.dfxp,.xml" hidden onChange={(e) => void pickSub(e.target.files?.[0], 'original')} />
          </label>
          {original && <LanguageSelect value={original.lang} onChange={(lang) => setOriginal({ ...original, lang })} />}
          <label className="lr-btn">
            {translation ? `Translation: ${translation.name}` : 'Translation subtitles (optional)'}
            <input
              type="file"
              accept=".srt,.vtt,.ttml,.dfxp,.xml"
              hidden
              onChange={(e) => void pickSub(e.target.files?.[0], 'translation')}
            />
          </label>
        </div>
        {error && (
          <div className="lr-error" style={{ marginTop: 8 }}>
            {error}
          </div>
        )}
        {!videoUrl && (
          <p className="lr-status" style={{ marginBottom: 0 }}>
            Files stay on your computer. Without a translation file, subtitles are translated on-device or with your AI provider.
          </p>
        )}
      </div>
      {videoUrl && controller && (
        <div className="lr-video-layout">
          <div className="lr-video-wrap" ref={wrapRef}>
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
          <Sidebar controller={controller} onClose={() => undefined} />
        </div>
      )}
    </>
  );
}
