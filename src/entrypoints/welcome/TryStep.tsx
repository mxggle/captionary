import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { baseLang, normalizeLang, sameLang } from '@/lib/languages';
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
  /** Hand translations, by language or base language code. */
  tr: Record<string, string>;
}

/** One everyday subtitle line per language, for the practice screen. */
const SAMPLES: Sample[] = [
  {
    lang: 'es',
    text: '¿Quieres tomar un café antes de la película?',
    tr: {
      en: 'Do you want to get a coffee before the movie?',
      zh: '看电影前你想喝杯咖啡吗？',
      'zh-TW': '看電影前你想喝杯咖啡嗎？',
      ja: '映画の前にコーヒーでも飲む？',
    },
  },
  {
    lang: 'fr',
    text: 'On se retrouve devant le cinéma à huit heures ?',
    tr: {
      en: 'Shall we meet outside the cinema at eight?',
      zh: '我们八点在电影院门口见好吗？',
      'zh-TW': '我們八點在電影院門口見好嗎？',
      ja: '8時に映画館の前で待ち合わせようか？',
    },
  },
  {
    lang: 'de',
    text: 'Ich habe keine Ahnung, wo ich meine Schlüssel gelassen habe.',
    tr: {
      en: 'I have no idea where I left my keys.',
      zh: '我完全不知道把钥匙放哪儿了。',
      'zh-TW': '我完全不知道把鑰匙放哪裡了。',
      ja: '鍵をどこに置いたのか全く見当がつかない。',
    },
  },
  {
    lang: 'it',
    text: 'Non vedo l’ora di andare al mare questo fine settimana.',
    tr: {
      en: 'I can’t wait to go to the beach this weekend.',
      zh: '我迫不及待想这个周末去海边了。',
      'zh-TW': '我迫不及待想這個週末去海邊了。',
      ja: '今週末、海に行くのが待ちきれない。',
    },
  },
  {
    lang: 'pt',
    text: 'Você já experimentou o pão de queijo daquela padaria?',
    tr: {
      en: 'Have you tried the cheese bread from that bakery yet?',
      zh: '你尝过那家面包店的芝士面包球了吗？',
      'zh-TW': '你嚐過那家麵包店的起司麵包球了嗎？',
      ja: 'あのパン屋のポン・デ・ケージョ、もう食べてみた？',
    },
  },
  {
    lang: 'ja',
    text: '明日は雨が降るかもしれないから、傘を持っていこう。',
    tr: {
      en: 'It might rain tomorrow, so let’s take an umbrella.',
      zh: '明天可能会下雨，带把伞去吧。',
      'zh-TW': '明天可能會下雨，帶把傘去吧。',
    },
  },
  {
    lang: 'ko',
    text: '오늘 저녁에 같이 영화 보러 갈래요?',
    tr: {
      en: 'Do you want to go and see a film together this evening?',
      zh: '今天晚上一起去看电影好吗？',
      'zh-TW': '今天晚上一起去看電影好嗎？',
      ja: '今日の夜、一緒に映画を見に行きませんか？',
    },
  },
  {
    lang: 'zh-CN',
    text: '我们周末去公园散步吧。',
    tr: {
      en: 'Let’s go for a walk in the park this weekend.',
      ja: '週末は公園へ散歩に行こうよ。',
    },
  },
  {
    lang: 'zh-TW',
    text: '我們週末去公園散步吧。',
    tr: {
      en: 'Let’s go for a walk in the park this weekend.',
      ja: '週末は公園へ散歩に行こうよ。',
    },
  },
  {
    lang: 'ru',
    text: 'Я давно не видел такого красивого заката.',
    tr: {
      en: 'I haven’t seen such a beautiful sunset in a long time.',
      zh: '我好久没见过这么美的日落了。',
      'zh-TW': '我好久沒見過這麼美的日落了。',
      ja: 'こんなに美しい夕日を見たのは久しぶりだ。',
    },
  },
  {
    lang: 'nl',
    text: 'Zullen we vanavond pizza bestellen?',
    tr: {
      en: 'Shall we order pizza tonight?',
      zh: '我们今晚点披萨好吗？',
      'zh-TW': '我們今晚點披薩好嗎？',
      ja: '今夜はピザを頼もうか？',
    },
  },
  {
    lang: 'tr',
    text: 'Bu akşam ne yapmak istersin?',
    tr: {
      en: 'What would you like to do this evening?',
      zh: '你今晚想做什么？',
      'zh-TW': '你今晚想做什麼？',
      ja: '今夜は何をしたい？',
    },
  },
  {
    lang: 'en',
    text: 'I can’t believe we missed the last train home.',
    tr: {
      zh: '真不敢相信我们错过了回家的末班车。',
      'zh-TW': '真不敢相信我們錯過了回家的末班車。',
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
  const norm = normalizeLang(native);
  const hand = sample.tr[norm] ?? sample.tr[baseLang(native)];
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
  const { m, locale } = useI18n(s);
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
      title={m.welcome.tryStep.title}
      lead={m.welcome.tryStep.lead}
      foot={
        <Foot onBack={() => go('tutor')} onNext={() => go('done')} nextLabel={tried ? m.common.continue : m.common.skip} quiet={!tried} />
      }
    >
      {substitute && (
        <Note tone="plain">
          {m.welcome.tryStep.substituteNote(shortLanguageName(s.targetLanguage, locale), shortLanguageName(sample.lang, locale))}
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
      <div aria-live="polite">{tried && <Note tone="success">{m.welcome.tryStep.triedSuccess}</Note>}</div>
      {target ? (
        <PaperLookup
          key={`${target.text}:${target.tokenRange?.join('-')}`}
          docked
          target={target}
          settings={s}
          aiStatus={tutor}
          vocab={vocab}
          mediaTitle={m.welcome.tryStep.practiceTitle}
          onSave={(status, entry) => {
            if (!status) return removeVocab(vocabKey(entry.text, target.lang).id);
            return saveVocab({
              lang: target.lang,
              ...entry,
              status,
              context: {
                sentence: target.sentence,
                translation: target.translation,
                title: m.welcome.tryStep.practiceTitle,
                site: 'reader',
              },
            });
          }}
          onSelectWord={(sel) => setTarget({ ...target, text: sel.text, rect: sel.rect, tokenRange: sel.range, base: sel.base })}
          onSetUpTutor={() => go('tutor')}
        />
      ) : (
        <p className="cap-wizard__nudge">{m.welcome.tryStep.nudge}</p>
      )}
      <ul className="cap-wizard__tips">
        <li>
          <strong>{m.welcome.tryStep.tip1Strong}</strong>
          {m.welcome.tryStep.tip1After}
        </li>
        <li>{m.welcome.tryStep.tip2}</li>
        {tutor?.configured && (
          <li>
            <strong>{m.welcome.tryStep.tip3Strong}</strong>
            {m.welcome.tryStep.tip3After}
          </li>
        )}
      </ul>
    </Step>
  );
}
