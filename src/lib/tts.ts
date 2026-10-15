import { baseLang, normalizeLang } from './languages';

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;

function voices(): Promise<SpeechSynthesisVoice[]> {
  if (!('speechSynthesis' in globalThis)) return Promise.resolve([]);
  voicesReady ??= new Promise((resolve) => {
    const list = speechSynthesis.getVoices();
    if (list.length) return resolve(list);
    const done = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
  return voicesReady;
}

/** Pick the best voice for a language: exact locale, then same language, preferring natural/online voices. */
export function pickVoice(list: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const norm = normalizeLang(lang).toLowerCase();
  const base = baseLang(lang).toLowerCase();
  const score = (v: SpeechSynthesisVoice) => {
    const vl = v.lang.toLowerCase().replace('_', '-');
    let s = 0;
    if (vl === norm) s += 4;
    else if (vl.split('-')[0] === base) s += 2;
    else return -1;
    if (/natural|neural|google|online|premium|enhanced/i.test(v.name)) s += 1;
    return s;
  };
  return list
    .map((v) => [v, score(v)] as const)
    .filter(([, s]) => s >= 0)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
}

export async function speak(text: string, lang: string, rate = 0.9): Promise<void> {
  if (!('speechSynthesis' in globalThis) || !text.trim()) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = normalizeLang(lang);
  utterance.rate = rate;
  const voice = pickVoice(await voices(), lang);
  if (voice) utterance.voice = voice;
  speechSynthesis.speak(utterance);
}

export function canSpeak(): boolean {
  return 'speechSynthesis' in globalThis;
}
