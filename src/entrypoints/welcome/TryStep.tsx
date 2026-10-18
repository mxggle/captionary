import { useEffect, useState } from 'react';
import { baseLang, sameLang } from '@/lib/languages';
import { chromeTranslatorState, translateWithChrome } from '@/lib/translate';
import { removeVocab, saveVocab, vocabKey } from '@/lib/vocab';
import type { PopupTarget } from '@/content/store';
import { Note } from '@/ui/controls';
import { PaperLookup } from '@/ui/PaperLookup';
import { TokenizedText, type WordSelection } from '@/ui/TokenizedText';
import { useVocabMap } from '@/ui/useVocab';
import { useVocabIndex } from '@/ui/vocab-index';
import { Foot, shortLanguageName, Step, useTutorStatus, type StepProps } from './parts';

interface Sample {
  lang: string;
  text: string;
  /** Hand translations, by base language code. */
  tr: Record<string, string>;
}

/** One everyday subtitle line per language, for the practice screen. */
const SAMPLES: Sample[] = [
  { lang: 'es', text: '¿Quieres tomar un café antes de la película?', tr: { en: 'Do you want to get a coffee before the movie?' } },
  { lang: 'fr', text: 'On se retrouve devant le cinéma à huit heures ?', tr: { en: 'Shall we meet outside the cinema at eight?' } },
  { lang: 'de', text: 'Ich habe keine Ahnung, wo ich meine Schlüssel gelassen habe.', tr: { en: 'I have no idea where I left my keys.' } },
  {
    lang: 'it',
    text: 'Non vedo l’ora di andare al mare questo fine settimana.',
    tr: { en: 'I can’t wait to go to the beach this weekend.' },
  },
  {
    lang: 'pt',
    text: 'Você já experimentou o pão de queijo daquela padaria?',
    tr: { en: 'Have you tried the cheese bread from that bakery yet?' },
  },
  {
    lang: 'ja',
    text: '明日は雨が降るかもしれないから、傘を持っていこう。',
    tr: { en: 'It might rain tomorrow, so let’s take an umbrella.' },
  },
  { lang: 'ko', text: '오늘 저녁에 같이 영화 보러 갈래요?', tr: { en: 'Do you want to go and see a film together this evening?' } },
  { lang: 'zh-CN', text: '我们周末去公园散步吧。', tr: { en: 'Let’s go for a walk in the park this weekend.' } },
  { lang: 'zh-TW', text: '我們週末去公園散步吧。', tr: { en: 'Let’s go for a walk in the park this weekend.' } },
  { lang: 'ru', text: 'Я давно не видел такого красивого заката.', tr: { en: 'I haven’t seen such a beautiful sunset in a long time.' } },
  { lang: 'nl', text: 'Zullen we vanavond pizza bestellen?', tr: { en: 'Shall we order pizza tonight?' } },
  { lang: 'tr', text: 'Bu akşam ne yapmak istersin?', tr: { en: 'What would you like to do this evening?' } },
  {
    lang: 'en',
    text: 'I can’t believe we missed the last train home.',
    tr: {
      zh: '真不敢相信我们错过了回家的末班车。',
      es: 'No puedo creer que perdimos el último tren a casa.',
      fr: 'Je n’arrive pas à croire qu’on a raté le dernier train.',
      de: 'Ich kann nicht glauben, dass wir den letzten Zug nach Hause verpasst haben.',
      it: 'Non ci posso credere che abbiamo perso l’ultimo treno per casa.',
      pt: 'Não acredito que perdemos o último trem para casa.',
      ja: '終電を逃したなんて信じられない。',
      ko: '집에 가는 막차를 놓쳤다니 믿을 수가 없어.',
      ru: 'Не могу поверить, что мы опоздали на последний поезд домой.',
    },
  },
];

/** The line for the learner's language; without one, English (or Spanish for English speakers). */
function pickSample(target: string, native: string): { sample: Sample; substitute: boolean } {
  const own = target !== 'auto' ? SAMPLES.find((x) => sameLang(x.lang, target)) : undefined;
  if (own) return { sample: own, substitute: false };
  const fallback = SAMPLES.find((x) => x.lang === (baseLang(native) === 'en' ? 'es' : 'en'))!;
  return { sample: fallback, substitute: target !== 'auto' };
}

/** The line's translation in the learner's language: written by hand, else from Chrome's translator when it is ready. */
function useTranslation(sample: Sample, native: string): string | undefined {
  const hand = sample.tr[baseLang(native)];
  const [machine, setMachine] = useState<string | undefined>();
  useEffect(() => {
    setMachine(undefined);
    if (hand || sameLang(sample.lang, native)) return;
    let alive = true;
    void chromeTranslatorState(sample.lang, native)
      .then((state) => (state === 'available' ? translateWithChrome(sample.text, sample.lang, native) : undefined))
      .then((text) => alive && setMachine(text))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [sample, native, hand]);
  return hand ?? machine;
}

export function TryStep({ s, go }: StepProps) {
  const { sample, substitute } = pickSample(s.targetLanguage, s.nativeLanguage);
  const translation = useTranslation(sample, s.nativeLanguage);
  const vocab = useVocabMap();
  const index = useVocabIndex(vocab, sample.lang);
  const [tutor] = useTutorStatus();
  const [target, setTarget] = useState<PopupTarget | null>(null);
  const [tried, setTried] = useState(false);

  const open = (sel: WordSelection) => {
    setTried(true);
    setTarget({
      kind: 'word',
      text: sel.text,
      lang: sample.lang,
      cueIndex: 0,
      sentence: sample.text,
      translation,
      before: [],
      after: [],
      rect: sel.rect,
      surface: 'reader',
      tokenRange: sel.range,
      base: sel.base,
    });
  };

  return (
    <Step
      title="Try it: click a word"
      lead="This is what a video looks like with Captionary. Click any word in the top line of the subtitle."
      foot={<Foot onBack={() => go('tutor')} onNext={() => go('done')} nextLabel={tried ? 'Continue' : 'Skip'} quiet={!tried} />}
    >
      {substitute && (
        <Note tone="plain">
          There’s no practice line in {shortLanguageName(s.targetLanguage)} yet, so here’s one in {shortLanguageName(sample.lang)}. It works
          the same way.
        </Note>
      )}
      <div className={`cap-wizard__frame cap-wizard__frame--demo${target ? '' : ' is-waiting'}`}>
        <div className="cap-captions">
          <div className="cap-cap" lang={sample.lang}>
            <TokenizedText
              text={sample.text}
              lang={sample.lang}
              index={index}
              highlight={s.subtitles.highlight}
              selected={target?.tokenRange}
              onSelect={open}
            />
          </div>
          {translation && (
            <div className="cap-cap cap-cap--tr" lang={s.nativeLanguage}>
              {translation}
            </div>
          )}
        </div>
      </div>
      <div aria-live="polite">
        {tried && <Note tone="success">That’s all there is to it. It works the same way on YouTube, Netflix and Apple TV+.</Note>}
      </div>
      {target ? (
        <PaperLookup
          key={`${target.text}:${target.tokenRange?.join('-')}`}
          docked
          target={target}
          settings={s}
          aiStatus={tutor}
          vocab={vocab}
          mediaTitle="Captionary practice"
          onSave={(status, entry) => {
            if (!status) return void removeVocab(vocabKey(entry.text, target.lang).id);
            void saveVocab({
              lang: target.lang,
              ...entry,
              status,
              context: { sentence: target.sentence, translation: target.translation, title: 'Captionary practice', site: 'reader' },
            });
          }}
          onSelectWord={(sel) => setTarget({ ...target, text: sel.text, rect: sel.rect, tokenRange: sel.range, base: sel.base })}
          onSetUpTutor={() => go('tutor')}
        />
      ) : (
        <p className="cap-wizard__nudge">The word’s meaning appears here.</p>
      )}
      <ul className="cap-wizard__tips">
        <li>
          <strong>Save as learning</strong> keeps the word. Wherever you meet it again, it has a dotted underline.
        </li>
        <li>To look up a few words together, drag across them, or click one and Shift+click another.</li>
        {tutor?.configured && (
          <li>
            <strong>Explain in context</strong> asks your tutor how the word works in this sentence.
          </li>
        )}
      </ul>
    </Step>
  );
}
