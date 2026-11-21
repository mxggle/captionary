// Localization for Captionary site (index.html and privacy.html): en, zh-CN, zh-TW, ja.
(() => {
  'use strict';

  const SUPPORTED = ['en', 'zh-CN', 'zh-TW', 'ja'];
  const OG_LOCALES = { en: 'en_US', 'zh-CN': 'zh_CN', 'zh-TW': 'zh_TW', ja: 'ja_JP' };
  const STORAGE_KEY = 'captionary-site-lang';

  // The inline script in each page's <head> runs this same detection before the first paint;
  // change both together.

  function normalizeLang(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const s = raw.trim().toLowerCase();
    if (s === 'en' || s.startsWith('en-')) return 'en';
    if (s === 'ja' || s.startsWith('ja-')) return 'ja';
    if (s === 'zh-tw' || s === 'zh-hk' || s === 'zh-mo' || s.startsWith('zh-hant') || s.includes('-tw') || s.includes('-hk')) {
      return 'zh-TW';
    }
    if (s === 'zh' || s === 'zh-cn' || s === 'zh-sg' || s.startsWith('zh-hans') || s.startsWith('zh-')) {
      return 'zh-CN';
    }
    return null;
  }

  function detectLang() {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = normalizeLang(params.get('lang'));
      if (fromUrl) return fromUrl;
    } catch (_) {}

    try {
      const saved = normalizeLang(localStorage.getItem(STORAGE_KEY));
      if (saved) return saved;
    } catch (_) {}

    const navs = Array.isArray(navigator.languages) && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
    for (const n of navs) {
      const m = normalizeLang(n);
      if (m) return m;
    }
    return 'en';
  }

  const W = (t, pos, tr, ex, extra = {}) => ({ t, pos, tr, ex, ...extra });

  const DEMO_TRANSLATIONS = {
    en: {
      ui: {
        listen: 'Listen',
        close: 'Close (Esc)',
        lookupTitle: (text) => `Look up “${text}” instead`,
        phraseBadge: 'Phrase',
        learning: 'Learning',
        save: 'Save',
        known: 'Known',
        explain: 'Explain',
        savedAs: (baseHtml) => `Saved as ${baseHtml}, its dictionary form.`,
        sampleAnswer: 'Sample answer. In Captionary, the AI you connect writes this.',
        lookupAria: (text) => `Look-up: ${text}`,
        otherEx:
          'That’s a word-by-word gloss. This page only knows a few phrases; in the extension, your tutor explains any selection in the context of the line.',
      },
      es: {
        lang: 'es',
        speech: 'es-ES',
        hint: 'Try it. Click a word in the top line, or drag across “se dio cuenta”.',
        translation: 'In the end, my brother realized I was right.',
        start: 6,
        line: [
          W('Al', 'contraction', 'to the; at the', 'A contraction of *a* + *el*. With *final* it makes *al final*, “in the end”.', {
            chunk: 'alfinal',
          }),
          ' ',
          W('final', 'noun', 'end', '*Final* is “end”. *Al final* is a set phrase: “in the end”, “eventually”.', { chunk: 'alfinal' }),
          ', ',
          W('mi', 'determiner', 'my', '*Mi* means “my”.', { warn: 'Without an accent. *Mí*, with one, means “me” after a preposition.' }),
          ' ',
          W('hermano', 'noun', 'brother', '*Hermano* is “brother”. *Hermana* is “sister”, and *hermanos* can mean “siblings”.'),
          ' ',
          W(
            'se',
            'pronoun',
            'himself (reflexive)',
            'Here *se* belongs to *darse cuenta*: the verb is used reflexively, so word by word it reads “he gave himself account”.',
            { chunk: 'cuenta' },
          ),
          ' ',
          W('dio', 'verb', 'gave', '*Dio* is the past tense of *dar*, “to give”. With *se* and *cuenta* it means “realized”.', {
            chunk: 'cuenta',
          }),
          ' ',
          W(
            'cuenta',
            'noun',
            'bill; account',
            'On its own *cuenta* is a bill or an account. In this line it’s part of *darse cuenta*, “to realize”.',
            {
              chunk: 'cuenta',
              warn: 'Don’t read it as “bill” here.',
            },
          ),
          ' ',
          W(
            'de',
            'preposition',
            'of; from',
            '*Darse cuenta de algo* is “to realize something”, so this *de* belongs to the phrase before it.',
            { chunk: 'cuenta' },
          ),
          ' ',
          W('que', 'conjunction', 'that', '*Que* is “that”. It introduces what he realized.'),
          ' ',
          W('yo', 'pronoun', 'I', '*Yo* is “I”. Spanish usually leaves it out; here it adds stress: _I_ was the one who was right.'),
          ' ',
          W('tenía', 'verb', 'had', '*Tenía* is the imperfect of *tener*, “to have”. With *razón* it means “was right”.', {
            chunk: 'razon',
          }),
          ' ',
          W('razón', 'noun', 'reason', '*Razón* is “reason”. *Tener razón* means “to be right”.', {
            chunk: 'razon',
            warn: 'Spanish says you “have reason”; English says you “are right”.',
          }),
          '.',
        ],
        phrases: {
          alfinal: {
            range: [0, 1],
            base: 'al final',
            pos: 'phrase',
            tr: 'in the end',
            meaning: 'in the end, eventually',
            ex: '*Al final* means “in the end” or “eventually”. It’s a set phrase, so read it as one unit.',
          },
          cuenta: {
            range: [4, 6],
            base: 'darse cuenta',
            pos: 'phrase',
            tr: 'realized',
            meaning: 'to realize, to notice',
            ex: '*Darse cuenta (de)* means “to realize” or “to notice”. *Se dio cuenta* is the past: “he realized”. The same pattern gives *me di cuenta*, “I realized”.',
            warn: 'No single word in it means “realize”.',
          },
          razon: {
            range: [10, 11],
            base: 'tener razón',
            pos: 'phrase',
            tr: 'was right',
            meaning: 'to be right',
            ex: '*Tener razón* means “to be right”. *Tenía razón* is the imperfect: “I was right”.',
          },
        },
      },
      ja: {
        lang: 'ja',
        speech: 'ja-JP',
        hint: 'Try it. Click a word in the top line, or drag across “気がついたら”.',
        translation: 'Before I knew it, it was already morning.',
        start: 0,
        line: [
          W(
            '気',
            'noun',
            'mind; attention',
            '*気* (ki) is “mind” or “attention”. *気がつく*, literally “attention attaches”, means “to notice”.',
            { chunk: 'kigatsuku' },
          ),
          W('が', 'particle', 'subject marker', '*が* marks *気* as the subject of *つく*.', { chunk: 'kigatsuku' }),
          W(
            'ついたら',
            'verb',
            'when it attached',
            '*ついたら* is *つく* (“to attach”) with *～たら* (“when”). After *気が* it means “when I noticed”.',
            {
              chunk: 'kigatsuku',
            },
          ),
          '、',
          W('もう', 'adverb', 'already', '*もう* means “already”. With a past verb it stresses that the change has already happened.'),
          W('朝', 'noun', 'morning', '*朝* (asa) is “morning”. *朝になる*, “to become morning”, is how Japanese says morning comes.', {
            chunk: 'asa',
          }),
          W('に', 'particle', 'into; to', '*に* marks what something turns into, as in *朝になる*.', { chunk: 'asa' }),
          W(
            'なっていた',
            'verb',
            'had become',
            '*なっていた* is *なる* (“to become”) in the *～ていた* form: a state that was already in place.',
            { chunk: 'asa' },
          ),
          '。',
        ],
        phrases: {
          kigatsuku: {
            range: [0, 2],
            base: '気がつく',
            pos: 'phrase',
            tr: 'before I knew it',
            meaning: 'to notice',
            ex: '*気がつく* means “to notice” or “to come to”. With *～たら*, *気がついたら* is a set way to say “before I knew it”.',
          },
          asa: {
            range: [4, 6],
            base: '朝になる',
            pos: 'phrase',
            tr: 'it had become morning',
            meaning: 'morning comes',
            ex: '*朝になる* means “morning comes”. *になっていた* says it was already morning by the time I noticed.',
          },
        },
      },
    },
    'zh-CN': {
      ui: {
        listen: '朗读',
        close: '关闭 (Esc)',
        lookupTitle: (text) => `改查词组“${text}”`,
        phraseBadge: '词组',
        learning: '学习中',
        save: '收藏',
        known: '已掌握',
        explain: '解析',
        savedAs: (baseHtml) => `已按词典原形存为 ${baseHtml}。`,
        sampleAnswer: '以上为示例回答。在扩展中，这段解析由你接入的 AI 生成。',
        lookupAria: (text) => `查词：${text}`,
        otherEx: '这是逐词拼接的释义。演示页只内置了几个固定词组；在扩展中，AI 助教会结合整句语境为你讲解任意划选片段。',
      },
      es: {
        lang: 'es',
        speech: 'es-ES',
        hint: '试一试：点击第一行字幕中的单词，或拖选“se dio cuenta”。',
        translation: '到最后，我哥哥意识到我是对的。',
        start: 6,
        line: [
          W('Al', '缩合词', '向；在……时', '由介词 *a* 与冠词 *el* 缩合而成。与 *final* 连用构成 *al final*，意思是“到最后、终于”。', {
            chunk: 'alfinal',
          }),
          ' ',
          W('final', '名词', '末尾；结局', '*Final* 意为“末尾”。*Al final* 是固定词组，表示“到最后、终究”。', { chunk: 'alfinal' }),
          ', ',
          W('mi', '限定词', '我的', '*Mi* 的意思是“我的”。', { warn: '不带重音符号。带重音的 *mí* 用在介词后，表示“我”。' }),
          ' ',
          W('hermano', '名词', '哥哥；弟弟', '*Hermano* 指“兄弟”（哥或弟）。*Hermana* 是“姐妹”，复数 *hermanos* 可统称“兄弟姐妹”。'),
          ' ',
          W('se', '代词', '他自己（自复）', '这里的 *se* 属于自复动词词组 *darse cuenta*，逐字直译就像“给自己记了一笔账”。', {
            chunk: 'cuenta',
          }),
          ' ',
          W('dio', '动词', '给了', '*Dio* 是 *dar*（给）的简单过去时。与 *se* 和 *cuenta* 搭配时，意思是“意识到”。', { chunk: 'cuenta' }),
          ' ',
          W(
            'cuenta',
            '名词',
            '账单；账户',
            '单独看，*cuenta* 是“账单”或“账户”。在这句话里，它是固定搭配 *darse cuenta*（意识到）的一部分。',
            {
              chunk: 'cuenta',
              warn: '这里不要按字面读作“账单”。',
            },
          ),
          ' ',
          W('de', '介词', '……的；关于', '*Darse cuenta de algo* 表示“意识到某事”，这里的 *de* 紧接前面的词组，引出所意识到的内容。', {
            chunk: 'cuenta',
          }),
          ' ',
          W('que', '连词', '（引导从句）', '*Que* 引导宾语从句，带出他意识到的具体事实。'),
          ' ',
          W('yo', '代词', '我', '*Yo* 是“我”。西班牙语通常省略主语代词；这里特意说出是为了强调“对的人是我”。'),
          ' ',
          W('tenía', '动词', '有（过去未完成时）', '*Tenía* 是 *tener*（有）的过去未完成时。与 *razón* 搭配意思是“说得对、有道理”。', {
            chunk: 'razon',
          }),
          ' ',
          W('razón', '名词', '道理；理由', '*Razón* 是“道理、理由”。*Tener razón* 是固定搭配，意为“有道理、是对的”。', {
            chunk: 'razon',
            warn: '西语习惯说“有道理”（tener razón），对应汉语的“是对的”。',
          }),
          '.',
        ],
        phrases: {
          alfinal: {
            range: [0, 1],
            base: 'al final',
            pos: '词组',
            tr: '到最后',
            meaning: '到最后，终究',
            ex: '*Al final* 表示“到最后、终究”，是固定搭配，阅读时当作一个整体即可。',
          },
          cuenta: {
            range: [4, 6],
            base: 'darse cuenta',
            pos: '词组',
            tr: '意识到',
            meaning: '意识到，察觉到',
            ex: '*Darse cuenta (de)* 意为“意识到、发觉”。*Se dio cuenta* 是过去时：“他意识到了”。换成第一人称则是 *me di cuenta*（我意识到了）。',
            warn: '拆开看，里面没有哪个词单独表示“意识到”。',
          },
          razon: {
            range: [10, 11],
            base: 'tener razón',
            pos: '词组',
            tr: '是对的',
            meaning: '是对的，有道理',
            ex: '*Tener razón* 表示“有道理、是对的”。*Tenía razón* 用过去未完成时，表示当时“我是对的”。',
          },
        },
      },
      ja: {
        lang: 'ja',
        speech: 'ja-JP',
        hint: '试一试：点击第一行字幕中的词，或拖选“気がついたら”。',
        translation: '回过神来，已经天亮了。',
        start: 0,
        line: [
          W('気', '名词', '心思；注意力', '*気*（ki）指“精神、注意力”。*気がつく* 字面是“注意力落到了某处”，意思是“察觉到、意识到”。', {
            chunk: 'kigatsuku',
          }),
          W('が', '助词', '主格助词', '*が* 标示 *気* 是动词 *つく* 的主语。', { chunk: 'kigatsuku' }),
          W(
            'ついたら',
            '动词',
            '附着时；察觉时',
            '*ついたら* 是 *つく*（附着）加上假定形 *～たら*（……的时候/之后）。接在 *気が* 后面意为“等察觉到的时候”。',
            {
              chunk: 'kigatsuku',
            },
          ),
          '、',
          W('もう', '副词', '已经', '*もう* 表示“已经”，与过去状态连用，强调变化早已发生。'),
          W('朝', '名词', '早晨', '*朝*（asa）是“早晨”。日语用 *朝になる*（变成早晨）来表达“天亮了”。', { chunk: 'asa' }),
          W('に', '助词', '变成……（结果）', '*に* 标示变化的结果，如 *朝になる*（变成早晨）。', { chunk: 'asa' }),
          W('なっていた', '动词', '已经变成', '*なっていた* 是 *なる*（变成）的 *～ていた* 形式，表示当时已经处于某种结果状态。', {
            chunk: 'asa',
          }),
          '。',
        ],
        phrases: {
          kigatsuku: {
            range: [0, 2],
            base: '気がつく',
            pos: '词组',
            tr: '回过神来；不知不觉',
            meaning: '察觉到，意识到',
            ex: '*気がつく* 意为“察觉到、清醒过来”。接上 *～たら* 组成的 *気がついたら* 是常用表达，相当于“回过神来才发现、不知不觉间”。',
          },
          asa: {
            range: [4, 6],
            base: '朝になる',
            pos: '词组',
            tr: '已经天亮了',
            meaning: '天亮，到早晨',
            ex: '*朝になる* 表示“到早晨、天亮”。*になっていた* 说明在察觉到的那一刻，天早就亮了。',
          },
        },
      },
    },
    'zh-TW': {
      ui: {
        listen: '朗讀',
        close: '關閉 (Esc)',
        lookupTitle: (text) => `改查片語「${text}」`,
        phraseBadge: '片語',
        learning: '學習中',
        save: '儲存',
        known: '已掌握',
        explain: '解析',
        savedAs: (baseHtml) => `已依字典原形存為 ${baseHtml}。`,
        sampleAnswer: '以上為範例回答。在擴充功能中，這段解析由你連接的 AI 撰寫。',
        lookupAria: (text) => `查詢：${text}`,
        otherEx: '這是逐字拆解的字面意思。這個示範頁只內建了幾個片語；在擴充功能裡，AI 助教會根據整句語境為你解釋任何選取的片段。',
      },
      es: {
        lang: 'es',
        speech: 'es-ES',
        hint: '試試看：點擊第一行字幕中的單字，或拖曳選取「se dio cuenta」。',
        translation: '到最後，我哥哥意識到我是對的。',
        start: 6,
        line: [
          W('Al', '縮合詞', '向；在……時', '介詞 *a* 與冠詞 *el* 的縮合。與 *final* 連用構成 *al final*，意思是「到最後、終於」。', {
            chunk: 'alfinal',
          }),
          ' ',
          W('final', '名詞', '末尾；結局', '*Final* 意為「末尾」。*Al final* 是固定片語，表示「到最後、終究」。', { chunk: 'alfinal' }),
          ', ',
          W('mi', '限定詞', '我的', '*Mi* 的意思是「我的」。', { warn: '不帶重音符號。帶重音的 *mí* 用在介詞後面，代表「我」。' }),
          ' ',
          W(
            'hermano',
            '名詞',
            '哥哥；弟弟',
            '*Hermano* 指「兄弟」（哥哥或弟弟）。*Hermana* 是「姊妹」，複數 *hermanos* 可統稱「兄弟姊妹」。',
          ),
          ' ',
          W('se', '代詞', '他自己（反身）', '這裡的 *se* 屬於反身動詞片語 *darse cuenta*，逐字直譯就像「給自己記了一筆帳」。', {
            chunk: 'cuenta',
          }),
          ' ',
          W('dio', '動詞', '給了', '*Dio* 是 *dar*（給）的簡單過去式。與 *se* 和 *cuenta* 搭配時，意思是「意識到」。', { chunk: 'cuenta' }),
          ' ',
          W(
            'cuenta',
            '名詞',
            '帳單；帳戶',
            '單獨看，*cuenta* 是「帳單」或「帳戶」。在這句話裡，它是固定片語 *darse cuenta*（意識到）的一部分。',
            {
              chunk: 'cuenta',
              warn: '這裡不要照字面讀成「帳單」。',
            },
          ),
          ' ',
          W('de', '介詞', '……的；關於', '*Darse cuenta de algo* 表示「意識到某事」，這個 *de* 隸屬前面的片語，用來引出意識到的內容。', {
            chunk: 'cuenta',
          }),
          ' ',
          W('que', '連接詞', '（引導子句）', '*Que* 引導名詞子句，帶出他所意識到的事實。'),
          ' ',
          W('yo', '代詞', '我', '*Yo* 是「我」。西班牙語通常省略主詞代名詞；這裡特別講出來是為了強調「對的人是我」。'),
          ' ',
          W('tenía', '動詞', '有（過去未完成式）', '*Tenía* 是 *tener*（有）的過去未完成式。與 *razón* 搭配意思是「說得對、有道理」。', {
            chunk: 'razon',
          }),
          ' ',
          W('razón', '名詞', '道理；理由', '*Razón* 是「道理、理由」。*Tener razón* 是固定片語，意為「有道理、是對的」。', {
            chunk: 'razon',
            warn: '西語習慣說「有道理」（tener razón），相當於中文說「是對的」。',
          }),
          '.',
        ],
        phrases: {
          alfinal: {
            range: [0, 1],
            base: 'al final',
            pos: '片語',
            tr: '到最後',
            meaning: '到最後，終究',
            ex: '*Al final* 表示「到最後、終究」，是固定片語，閱讀時當成一個整體即可。',
          },
          cuenta: {
            range: [4, 6],
            base: 'darse cuenta',
            pos: '片語',
            tr: '意識到',
            meaning: '意識到，察覺到',
            ex: '*Darse cuenta (de)* 意為「意識到、發覺」。*Se dio cuenta* 是過去式：「他意識到了」。換成第一人稱則是 *me di cuenta*（我意識到了）。',
            warn: '拆開來看，裡面沒有任何一個單字本身代表「意識到」。',
          },
          razon: {
            range: [10, 11],
            base: 'tener razón',
            pos: '片語',
            tr: '是對的',
            meaning: '是對的，有道理',
            ex: '*Tener razón* 表示「有道理、是對的」。*Tenía razón* 用過去未完成式，表示當時「我是對的」。',
          },
        },
      },
      ja: {
        lang: 'ja',
        speech: 'ja-JP',
        hint: '試試看：點擊第一行字幕中的詞，或拖曳選取「気がついたら」。',
        translation: '回過神來，已經天亮了。',
        start: 0,
        line: [
          W('気', '名詞', '心思；注意力', '*気*（ki）指「精神、注意力」。*気がつく* 字面是「注意力附著上去」，意思是「察覺到、意識到」。', {
            chunk: 'kigatsuku',
          }),
          W('が', '助詞', '主格助詞', '*が* 標示 *気* 是動詞 *つく* 的主語。', { chunk: 'kigatsuku' }),
          W(
            'ついたら',
            '動詞',
            '附著時；察覺時',
            '*ついたら* 是 *つく*（附著）加上假定形 *～たら*（……的時候／之後）。接在 *気が* 後面意為「等察覺到的時候」。',
            {
              chunk: 'kigatsuku',
            },
          ),
          '、',
          W('もう', '副詞', '已經', '*もう* 表示「已經」，與過去狀態連用，強調變化早已發生。'),
          W('朝', '名詞', '早晨', '*朝*（asa）是「早晨」。日文用 *朝になる*（變成早晨）來表達「天亮了」。', { chunk: 'asa' }),
          W('に', '助詞', '變成……（結果）', '*に* 標示變化的結果，如 *朝になる*（變成早晨）。', { chunk: 'asa' }),
          W('なっていた', '動詞', '已經變成', '*なっていた* 是 *なる*（變成）的 *～ていた* 形式，表示當時已經處於某個結果狀態。', {
            chunk: 'asa',
          }),
          '。',
        ],
        phrases: {
          kigatsuku: {
            range: [0, 2],
            base: '気がつく',
            pos: '片語',
            tr: '回過神來；不知不覺',
            meaning: '察覺到，意識到',
            ex: '*気がつく* 意為「察覺到、清醒過來」。接上 *～たら* 組成的 *気がついたら* 是慣用說法，相當於「回過神來才發現、不知不覺間」。',
          },
          asa: {
            range: [4, 6],
            base: '朝になる',
            pos: '片語',
            tr: '已經天亮了',
            meaning: '天亮，到早晨',
            ex: '*朝になる* 表示「到早晨、天亮」。*になっていた* 說明在察覺到的那一刻，天早就亮了。',
          },
        },
      },
    },
    ja: {
      ui: {
        listen: '発音を聞く',
        close: '閉じる (Esc)',
        lookupTitle: (text) => `フレーズ「${text}」を調べる`,
        phraseBadge: 'フレーズ',
        learning: '学習中',
        save: '保存',
        known: '既知',
        explain: '解説',
        savedAs: (baseHtml) => `辞書形の ${baseHtml} として保存しました。`,
        sampleAnswer: 'これはサンプル回答です。拡張機能では、接続した AI が解説を作成します。',
        lookupAria: (text) => `辞書検索: ${text}`,
        otherEx:
          'ここは単語ごとの直訳です。このデモページには一部のフレーズのみ収録されていますが、拡張機能では選択したどの部分でも AI チューターが文脈に沿って解説します。',
      },
      es: {
        lang: 'es',
        speech: 'es-ES',
        hint: '試してみてください。上の行の単語をクリックするか、「se dio cuenta」をドラッグして選択します。',
        translation: '結局、兄は私が正しかったことに気づいた。',
        start: 6,
        line: [
          W(
            'Al',
            '縮約形',
            '〜へ；〜に',
            '前置詞 *a* と定冠詞 *el* の縮約形。*final* と合わせて *al final*（結局、ついには）という決まり文句になります。',
            { chunk: 'alfinal' },
          ),
          ' ',
          W('final', '名詞', '終わり；最後', '*Final* は「終わり」。*Al final* で「結局、最終的に」という熟語になります。', {
            chunk: 'alfinal',
          }),
          ', ',
          W('mi', '限定詞', '私の', '*Mi* は「私の」を表します。', {
            warn: 'アクセント記号なし。アクセント付きの *mí* は前置詞の後ろで「私を・私に」を意味します。',
          }),
          ' ',
          W(
            'hermano',
            '名詞',
            '兄；弟',
            '*Hermano* は「兄」または「弟」。*Hermana* は「姉・妹」、複数形 *hermanos* は「きょうだい」全体も指せます。',
          ),
          ' ',
          W(
            'se',
            '代名詞',
            '自身に（再帰）',
            'この *se* は再帰動詞句 *darse cuenta* の一部です。直訳すると「自分自身に勘定を与えた」という形になります。',
            { chunk: 'cuenta' },
          ),
          ' ',
          W(
            'dio',
            '動詞',
            '与えた',
            '*Dio* は *dar*（与える）の点過去形。*se* と *cuenta* と結びついて「気づいた」という意味になります。',
            { chunk: 'cuenta' },
          ),
          ' ',
          W(
            'cuenta',
            '名詞',
            '会計；勘定',
            '単体では「お会計、勘定、口座」ですが、この文では熟語 *darse cuenta*（気づく）の一部として使われています。',
            {
              chunk: 'cuenta',
              warn: 'ここでは「請求書・お会計」と訳さないよう注意。',
            },
          ),
          ' ',
          W(
            'de',
            '前置詞',
            '〜の；〜について',
            '*Darse cuenta de algo* で「〜に気づく」。この *de* は直前のフレーズに続き、気づいた内容を導きます。',
            { chunk: 'cuenta' },
          ),
          ' ',
          W('que', '接続詞', '〜ということ', '*Que* は従属節を導く接続詞で、兄が気づいた内容を後ろに続けます。'),
          ' ',
          W(
            'yo',
            '代名詞',
            '私が',
            '*Yo* は「私」。スペイン語では主語代名詞をよく省略しますが、ここでは「（他の誰でもなく）私が正しかった」と強調するために置かれています。',
          ),
          ' ',
          W('tenía', '動詞', '持っていた', '*Tenía* は *tener*（持つ）の線過去形。*razón* と合わせて「正しかった」という意味になります。', {
            chunk: 'razon',
          }),
          ' ',
          W('razón', '名詞', '道理；理由', '*Razón* は「道理、理由」。*Tener razón* で「正しい、もっともだ」という熟語になります。', {
            chunk: 'razon',
            warn: 'スペイン語では「道理を持っている（tener razón）」と言い、日本語の「正しい」にあたります。',
          }),
          '.',
        ],
        phrases: {
          alfinal: {
            range: [0, 1],
            base: 'al final',
            pos: 'フレーズ',
            tr: '結局',
            meaning: '結局、ついには',
            ex: '*Al final* は「結局、最後には」という意味の定型表現です。1つのまとまりとして読みます。',
          },
          cuenta: {
            range: [4, 6],
            base: 'darse cuenta',
            pos: 'フレーズ',
            tr: '気づいた',
            meaning: '気づく、悟る',
            ex: '*Darse cuenta (de)* は「〜に気づく」。*Se dio cuenta* は過去形で「彼は気づいた」。主語が「私」なら *me di cuenta*（私は気づいた）となります。',
            warn: 'どの単語も単体では「気づく」という意味を持ちません。',
          },
          razon: {
            range: [10, 11],
            base: 'tener razón',
            pos: 'フレーズ',
            tr: '正しかった',
            meaning: '正しい、理がある',
            ex: '*Tener razón* は「正しい、言う通りだ」。*Tenía razón* は線過去形で「私は正しかった」となります。',
          },
        },
      },
      ja: {
        lang: 'ja',
        speech: 'ja-JP',
        hint: '試してみてください。上の行の言葉をクリックするか、「気がついたら」をドラッグして選択します。',
        translation: 'In the end, before I knew it, morning had already come. （ふと気づくと、もう朝になっていた。）',
        start: 0,
        line: [
          W(
            '気',
            '名詞',
            '意識；注意 (mind)',
            '*気*（き）は「意識、注意」。*気がつく*（文字通りには「注意が向く」）で「気づく、意識が戻る」という意味になります。',
            { chunk: 'kigatsuku' },
          ),
          W('が', '助詞', '格助詞（主語）', '*が* は *気* が *つく* の主語であることを示します。', { chunk: 'kigatsuku' }),
          W(
            'ついたら',
            '動詞',
            'ついた時には',
            '*つく* に条件の *〜たら* がついた形。*気が* に続いて「気づいた時には、ふと気づくと」という意味になります。',
            {
              chunk: 'kigatsuku',
            },
          ),
          '、',
          W(
            'もう',
            '副詞',
            'すでに (already)',
            '*もう* は「すでに」。過去の状態を表す表現と呼応して、変化が完了していることを強調します。',
          ),
          W('朝', '名詞', '朝 (morning)', '*朝*（あさ）。日本語では「夜が明ける」ことを *朝になる* と表現します。', { chunk: 'asa' }),
          W('に', '助詞', '〜へ（変化の結果）', '変化の結果を表す格助詞 *に* です（*朝になる*）。', { chunk: 'asa' }),
          W(
            'なっていた',
            '動詞',
            'なっていた (had become)',
            '*なる* の *〜ていた* 形。気づいた時点で、すでにその状態になっていたことを表します。',
            { chunk: 'asa' },
          ),
          '。',
        ],
        phrases: {
          kigatsuku: {
            range: [0, 2],
            base: '気がつく',
            pos: 'フレーズ',
            tr: 'ふと気づくと (before I knew it)',
            meaning: '気づく、意識を取り戻す',
            ex: '*気がつく* は「気づく、正気に返る」。*〜たら* を伴う *気がついたら* は「いつの間にか、ふと気づくと」を表す決まり文句です。',
          },
          asa: {
            range: [4, 6],
            base: '朝になる',
            pos: 'フレーズ',
            tr: '朝になっていた',
            meaning: '朝になる、夜が明ける',
            ex: '*朝になる* は「夜が明けて朝になる」という表現。*になっていた* で、気づいた時にはすでに朝だったことを示します。',
          },
        },
      },
    },
  };

  const PAGE_STRINGS = {
    en: {
      indexTitle: 'Captionary: learn languages from YouTube, Netflix and Apple TV+',
      indexDesc:
        'Free Chrome extension with dual subtitles, phrase look-up and an AI tutor you choose: your ChatGPT plan, your own API key or a local model.',
      ogTitle: 'Captionary: look up whole phrases in the shows you watch',
      ogDesc:
        'Dual subtitles on YouTube, Netflix and Apple TV+, phrase look-up, and an AI tutor that runs on your ChatGPT plan, your own API key or a local model. Free.',
      privacyTitle: 'Privacy policy · Captionary',
      privacyDesc: 'How the Captionary Chrome extension handles subtitles, your study data and optional AI requests.',
      common: {
        skip: 'Skip to content',
        brandAria: 'Captionary home',
        navAria: 'Sections',
        navPhrases: 'Phrases',
        navAi: 'AI tutor',
        navCompare: 'vs Language Reactor',
        navFaq: 'FAQ',
        langAria: 'Page language',
        ctaHeader: 'Add to Chrome',
        footLinks:
          'Captionary · <a href="https://github.com/mxggle/captionary">Code on GitHub</a> · <a href="https://github.com/mxggle/captionary/issues">Report a problem</a> · <a href="privacy.html" data-preserve-lang>Privacy</a>',
        footFine:
          'Captionary is independent and is not affiliated with or endorsed by YouTube, Netflix, Apple or Dioco (Language Reactor). Product names are trademarks of their owners.',
      },
      index: {
        heroH1: 'Look up <mark class="hl">whole phrases</mark> in the shows you watch.',
        heroLead:
          'Captionary is a free Chrome extension for YouTube, Netflix and Apple TV+. It puts a translation under the original subtitle. Click a word or drag across a phrase, and a tutor explains it in context using the AI you choose: your ChatGPT plan, your own API key, or a model on your own computer.',
        ctaHero: 'Add to Chrome, it’s free',
        ctaCompare: 'Compare with Language Reactor',
        ctaNote: 'No account needed. Your saved words stay in your browser. Works on youtube.com, netflix.com and tv.apple.com.',
        phoneNote: 'Captionary runs in Chrome on a computer. Open this page there to install it.',
        demoLangAria: 'Demo language',
        demoEs: 'Spanish',
        demoJa: 'Japanese',
        demoFigcaption: 'A working copy of the look-up card with sample answers. In the extension, the AI you connect writes them.',
        phrasesH2: 'Some meanings only exist as phrases',
        phrasesP:
          'Look up <i lang="es">cuenta</i> and you get “bill”. In <i lang="es">se dio cuenta</i> it means “realized”, and no single word in the line tells you that. Phrasal verbs, idioms and set expressions work the same way in every language.',
        phrasesLi1: 'Drag across the words, or click one and Shift+click another.',
        phrasesLi2:
          'With a tutor connected, click a single word and it names the phrase the word belongs to. One more click looks up the phrase instead.',
        phrasesLi3:
          'Phrases are saved in dictionary form. <i lang="es">Se dio cuenta</i> goes into your list as <i lang="es">darse cuenta</i>.',
        phrasesLi4: 'Works in Chinese, Japanese and Thai too, where words aren’t separated by spaces.',
        glossAria: 'Word by word versus as a phrase',
        glossDt1: 'Word by word',
        glossDd1: 'himself · gave · bill',
        glossDt2: 'As a phrase',
        glossDd2: '<b lang="es">darse cuenta</b> · to realize',
        aiH2: 'Bring the AI you already pay for',
        aiP: 'Captionary doesn’t sell AI credits or lock you to one model. Connect what you have and switch whenever you like.',
        aiDt1: 'Sign in with ChatGPT',
        aiDd1:
          'Use your ChatGPT Plus, Pro or Business plan. No API key and nothing extra to pay; requests count toward your plan’s Codex usage limits.',
        aiDt2: 'Use your own API key',
        aiDd2:
          'OpenAI, Anthropic (Claude), Google Gemini, OpenRouter, DeepSeek, Groq, Mistral, xAI, or any OpenAI-compatible endpoint. You pay the provider directly, at their prices.',
        aiDt3: 'Run it on your computer',
        aiDd3: 'Ollama, LM Studio, or Chrome’s built-in Gemini Nano. Nothing leaves your machine.',
        aiSmall:
          'Give each job its own model: a fast, cheap one for word look-ups and a stronger one for sentence breakdowns. Add a fallback for outages and rate limits. Answers are cached, and an optional daily cap stops runaway spending.',
        aiPanelHead: 'AI providers',
        aiProvState1: 'Signed in',
        aiProvState2: 'API key ••••3f9a',
        aiProvState3: 'On this computer',
        aiPanelLabel: 'Model for each task',
        aiRouteDt1: 'Word look-up',
        aiRouteDt2: 'Sentence breakdown',
        aiRouteDt3: 'Follow-up chat',
        aiRouteDt4: 'Subtitle translation',
        aiRouteDt5: 'If a provider fails',
        aiRouteDd5: 'Try ChatGPT',
        aiFigcaption: 'Example settings: three providers, a model picked for each task.',
        wordsH2: 'Your word list is free, and it stays yours',
        wordsP:
          'Save a word or phrase as learning or known. Captionary keeps the sentence, its translation, the video and the timestamp it came from. Learning words get a dotted underline wherever they turn up again: in subtitles, the subtitle list and the reader.',
        wordsLi1: 'Review with flashcards.',
        wordsLi2: 'Export to Anki or CSV, or keep a JSON backup.',
        wordsLi3: 'No account and no subscription. The list lives in your browser.',
        wordsPanelHead: 'Saved words <span class="panel-count">3</span>',
        wordsTagLearn1: 'Learning',
        wordsMean1: 'to realize',
        wordsTagLearn2: 'Learning',
        wordsMean2: 'to notice; <i lang="ja">気がついたら</i>, before I knew it',
        wordsTagKnown: 'Known',
        wordsMean3: 'to be right',
        wordsBtnReview: 'Review',
        wordsBtnAnki: 'Export to Anki',
        wordsFigcaption: 'Example list. Each entry keeps the line it came from.',
        compareH2: 'Captionary and Language Reactor compared',
        compareP:
          'Language Reactor is the best-known tool for learning from Netflix and YouTube, with two million Chrome users, and it does a lot well. This is where the two differ. We checked every Language Reactor detail against its own pages on October 18, 2026.',
        compareFeatureSr: 'Feature',
        compareTableAria: 'Comparison table',
        compareR1Th: 'Look up several words at once',
        compareR1Us: '<span class="mark yes">Yes</span>Drag across them, or Shift+click',
        compareR1Lr:
          '<span class="mark no">No</span>One word at a time. Its team said in June 2026 that it’s under consideration.<a class="fn" href="#src-1" aria-label="Source 1">1</a>',
        compareR2Th: 'Save words and phrases',
        compareR2Us: '<span class="mark yes">Free</span>Flashcards, Anki and CSV export included',
        compareR2Lr:
          '<span class="mark part">Pro</span>Free only inside its PhrasePump drills<a class="fn" href="#src-2" aria-label="Source 2">2</a>',
        compareR3Th: 'AI explanations',
        compareR3Us:
          '<span class="mark yes">You set the cap</span>Word explanations, sentence breakdowns and follow-up chat, up to your provider’s limits and a daily cap you can change (300 requests by default)',
        compareR3Lr:
          '<span class="mark part">5 a day</span>Lexa AI: five free questions a day when signed in, unlimited with Pro<a class="fn" href="#src-3" aria-label="Source 3">3</a>',
        compareR4Th: 'Choose the AI model',
        compareR4Us:
          '<span class="mark yes">Yes</span>ChatGPT sign-in, 8 cloud providers with your own key, any OpenAI-compatible endpoint, or local models',
        compareR4Lr: '<span class="mark no">No</span>Language Reactor’s own AI',
        compareR5Th: 'Translation on Netflix when there’s no subtitle in your language',
        compareR5Us: '<span class="mark yes">Free</span>Chrome’s on-device translator, or your AI',
        compareR5Lr:
          '<span class="mark part">Pro</span>Machine translation, about 5 hours of new content a day<a class="fn" href="#src-4" aria-label="Source 4">4</a>',
        compareR6Th: 'Apple TV+',
        compareR6Us: '<span class="mark yes">Yes</span>Plus YouTube and Netflix',
        compareR6Lr: '<span class="mark no">No</span>YouTube and Netflix<a class="fn" href="#src-5" aria-label="Source 5">5</a>',
        compareR7Th: 'Account',
        compareR7Us: '<span class="mark yes">None</span>Everything is stored in your browser',
        compareR7Lr: '<span class="mark part">Needed</span>For Pro, Lexa questions and sync',
        compareR8Th: 'Price',
        compareR8Us: '<span class="mark yes">Free</span>Your AI provider bills you for what you use, if anything',
        compareR8Lr:
          '<span class="mark part">Freemium</span>Pro is a monthly, 3-month or yearly subscription<a class="fn" href="#src-2" aria-label="Source 2">2</a>',
        fairH3Ahead: 'Where Language Reactor is ahead',
        fairLi1: 'Its website works on phones and tablets. Captionary is desktop Chrome only.',
        fairLi2:
          'Settings, saved words and chats live in your account and follow you across devices. Captionary has no sync; you move a JSON backup yourself.',
        fairLi3: 'With Pro, it makes subtitles by speech recognition, including for dubbed Netflix audio.',
        fairLi4: 'It has a catalog of videos, books and podcasts, a chat partner called Aria, and an English course in beta.',
        fairLi5: 'Its Anki export includes images and audio. Captionary exports text: the word, its meaning and the sentence.',
        fairH3Both: 'What both do',
        fairPBoth:
          'Dual subtitles, a subtitle list, auto-pause and line repeat, keyboard shortcuts, transliteration, word-frequency colors, a text reader, local video files with your own subtitles, and Anki export.',
        fairH3Pick: 'Which to pick',
        fairPPick:
          'Pick Captionary if you want to look up phrases, choose your own AI, or keep a word list without paying. Pick Language Reactor if you study on your phone, want your words in an online account, or watch dubbed Netflix shows that have no subtitles.',
        src1: 'Language Reactor forum, staff reply of June 26, 2026: <a href="https://forum.languagelearningwithnetflix.com/t/how-to-select-multiple-word-definitions/41477">How to select multiple word definitions?</a>',
        src2: '<a href="https://www.languagereactor.com/pro-mode">Language Reactor Pro page</a>',
        src3: '<a href="https://www.languagereactor.com/help/updates">Language Reactor update history</a>, September 2026',
        src4: '<a href="https://www.languagereactor.com/help/faq">Language Reactor FAQ</a>',
        src5: '<a href="https://chromewebstore.google.com/detail/language-reactor/hoombieeljmmljlkjmnheibnpciblicm">Language Reactor on the Chrome Web Store</a>',
        compareFine:
          'Language Reactor is made by Dioco. Captionary is independent and not affiliated with it. If something here is out of date, <a href="https://github.com/mxggle/captionary/issues">open an issue</a> and we’ll correct it.',
        toolkitH2: 'The rest of the toolkit',
        tkDt1: 'Fits each player',
        tkDd1: 'Captionary’s button sits in the player’s own control bar, and its menus and look-up card take the site’s look and font.',
        tkDt2: 'Translation from the best source',
        tkDd2:
          'A human subtitle track when there is one, then YouTube’s auto-translate, then Chrome’s on-device translator, then your AI. Blur it until you hover, to test yourself.',
        tkDt3: 'Subtitle list',
        tkDd3: 'Follows playback. Search it, jump to any line, copy it, or download an .srt with both languages.',
        tkDt4: 'Romanization',
        tkDd4: 'Pinyin with tone marks, romaji for kana, and romanized Korean, Russian, Greek and more, under the original line.',
        tkDt5: 'Sentence breakdown',
        tkDd5: 'Press <kbd>E</kbd> for the current line’s translation, a literal gloss, its chunks and its grammar points.',
        tkDt6: 'Playback for study',
        tkDd6:
          'Pause after every line, repeat it, step back or forward, change speed. <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> by default, and every shortcut can be remapped.',
        tkDt7: 'Word frequency',
        tkDd7: 'Optional underlines show how rare a word is in film and TV subtitles, so you know which ones are worth saving.',
        tkDt8: 'Reader',
        tkDd8: 'Paste text, open .txt, .srt or .vtt files, or right-click any web page to read it with clickable words.',
        tkDt9: 'Your own videos',
        tkDd9: 'Play a video file from your disk with its subtitle file and get the same overlay, list and look-ups.',
        privacyH2: 'Your keys and your words stay in your browser',
        privacyP:
          'There’s no Captionary account, no analytics and no ads. The code is <a href="https://github.com/mxggle/captionary">on GitHub</a>, so you can check all of this yourself.',
        privacyLi1:
          'API keys and ChatGPT sign-in tokens are kept in the extension’s local storage on your computer. They’re never synced or exported, they go only to the service they belong to, and web pages can’t read them.',
        privacyLi2:
          'Chrome asks your permission for each AI service when you add it, one site at a time, and Captionary gives the access back when you remove the service. ChatGPT sign-in also needs localhost for a moment, to read the result of OpenAI’s sign-in page; that access is given back as soon as you’re signed in.',
        privacyLi3:
          'You choose how much context goes with a request: just the word, the sentence, or a couple of lines around it, and whether the video title is included.',
        privacyLi4: 'Subtitle text is marked as untrusted in every prompt, and answers can’t load images or HTML.',
        faqH2: 'Questions',
        faqQ1: 'Is Captionary really free?',
        faqA1:
          'Yes. The extension is free. If you connect a paid API, the provider bills you for what you use. With ChatGPT sign-in, a local model or Chrome’s built-in AI, there’s nothing extra to pay.',
        faqQ2: 'Do I need an API key?',
        faqA2:
          'No. Dual subtitles, translations, the dictionary, saving words and review all work without any AI. For the tutor, you can sign in with ChatGPT, run a local model, or use Chrome’s built-in AI instead of a key.',
        faqQ3: 'How does “Sign in with ChatGPT” work?',
        faqA3:
          'You sign in on OpenAI’s own page, the same way OpenAI’s Codex CLI does, and Captionary uses your ChatGPT Plus, Pro or Business plan. Requests count toward the plan’s Codex usage limits. OpenAI hasn’t documented this route for other apps, so it could change. If it does, API keys and local models keep working. Captionary isn’t affiliated with OpenAI.',
        faqQ4: 'How much will my API key cost me?',
        faqA4:
          'That depends on the provider and model you pick. Captionary keeps it down: explanations are only generated when you ask, answers are cached, and you can set a daily request limit. The settings page counts requests and tokens for each model.',
        faqQ5: 'Which languages does it support?',
        faqA5:
          'Any language the video has subtitles in. Phrase selection also works in Chinese, Japanese and Thai, and romanization covers Chinese, Japanese kana, Korean, Russian, Ukrainian, Bulgarian, Serbian, Greek and more. The tutor answers in your own language.',
        faqQ6: 'Which browsers and devices?',
        faqA6: 'Desktop Chrome. Captionary doesn’t run on phones or tablets.',
        faqQ7: 'Is Captionary connected to YouTube, Netflix, Apple or Language Reactor?',
        faqA7:
          'No. Captionary is an independent extension. Netflix and Apple TV+ need their own subscriptions, and subtitle availability depends on the video.',
        finalH2: 'Try it on the next thing you watch',
        finalP: 'A short setup guide asks which language you’re learning and helps you connect a tutor, or skip that for now.',
        ctaFooter: 'Add to Chrome, it’s free',
      },
      privacyPage: {
        h1: 'Captionary Privacy Policy',
        updated: 'Last updated October 18, 2026.',
        intro:
          'Captionary helps you learn languages from video subtitles and reading material. This policy describes how the extension handles that material, your study data, and optional AI requests.',
        storedH2: 'Data stored in your browser',
        storedP1:
          'Captionary stores settings, language preferences, saved words and phrases, notes, context sentences, source titles and URLs, video timestamps, configured AI services, and local usage counters in your browser’s extension storage. It may cache AI answers and downloaded word-frequency lists locally. Imported reading material and side-panel context are passed between extension pages using browser session storage. The reader also keeps the last document you opened (its title, address, language, and text) in local extension storage so you can return to it; opening another document replaces it.',
        storedP2:
          'Provider API keys are stored separately in local extension storage. They are excluded from settings exports and sent to the configured provider when needed to authenticate requests. Web pages cannot read extension storage, but local storage is not an encrypted credential vault. Protect your browser profile and device.',
        storedP3:
          'Captionary does not use Chrome Sync for this data. The current extension does not include a developer-operated account service, analytics SDK, or advertising integration.',
        contentH2: 'Video and reading content',
        contentP1:
          'On supported video sites, Captionary reads subtitle tracks and playback information to display subtitles, look up words, and provide study controls. When you explicitly open a page in the reader, it reads the selected or readable page text, title, URL, and language. It does not read Chrome’s browsing-history database. Source information may be retained with your saved vocabulary or imported reading material.',
        contentP2:
          'Local video and text files are opened for the reader or local video feature. Captionary does not upload the video file as part of playback. If you use cloud AI on text or subtitles from a local file, that text can be sent to the configured AI service.',
        requestsH2: 'Requests to other services',
        requestsLi1: 'Video platforms and their subtitle hosts receive the requests required to obtain the subtitles you study.',
        requestsLi2:
          'Wiktionary lookup is on by default. While it is enabled, the word or phrase you look up is sent to Wiktionary for definitions.',
        requestsLi3:
          'When word-frequency coloring is enabled, Captionary downloads a frequency list for the relevant language from a GitHub-hosted dataset.',
        requestsLi4: 'External dictionary and search links open the selected service with the lookup term in the URL when you choose them.',
        requestsLi5:
          'Pronunciation uses the browser’s speech-synthesis voices. Some voices may use an online service; processing depends on the voice and browser.',
        requestsP:
          'These services can receive ordinary network information, such as your IP address, and apply their own privacy policies.',
        aiH2: 'Optional AI features',
        aiP1: 'No cloud AI provider is configured by default. If you add one and use an AI feature, Captionary sends the relevant word, phrase, sentence, subtitle text, prompt, or chat to that provider. Requests can also contain your selected languages and learning level. Depending on the task and your privacy settings, requests may include nearby subtitle lines, an existing translation, or the media title. Title sharing is on by default; in the reader, the title is the web page’s title. The “In the show” tab is off by default; if you turn it on and open it for a name or term in a video, that request also includes the episode’s subtitle lines that mention it (only lines up to where you are watching, unless you allow spoilers). Follow-up chat includes recent conversation turns; subtitle translation sends batches of subtitle lines.',
        aiP2: 'If you choose a fallback provider, a request the main provider cannot answer (for example during an outage, a rate limit, or a usage limit) is sent to the fallback provider instead, with the same content.',
        aiP3: 'Captionary asks Chrome for access to each AI service’s site when you add the service, and removes that access when you remove the service, unless another configured service uses the same site.',
        aiP4: 'After configuration, optional automatic explanations or AI subtitle translation can make requests as you use those features. Review your settings before studying private material. Avoid sending sensitive personal information to a provider unless you intend to do so.',
        aiP5: 'You can change the explanation context scope and title-sharing setting, choose another provider, disable automatic explanations, or use a local AI service instead. Supported Chrome on-device AI and translation process supported tasks on your device, although setup may require model or language-pack downloads. A localhost provider runs through the service you configure; that service’s own configuration determines whether it makes further network requests.',
        aiP6: 'Each cloud provider controls its own retention, training, account, and billing practices. Captionary cannot delete data that a provider has already received. Consult that provider’s policy and account controls.',
        chatgptH2: 'Optional ChatGPT account sign-in',
        chatgptP1:
          'If you choose ChatGPT sign-in, Captionary opens OpenAI’s authentication page at auth.openai.com using an OAuth authorization flow with PKCE. It uses the public sign-in client that OpenAI publishes for its Codex command-line tool; OpenAI has not documented this sign-in for other apps, so it may change or stop working. Captionary is not affiliated with or endorsed by OpenAI. Captionary never sees your OpenAI password.',
        chatgptP2:
          'The sign-in requests the openid, profile, email, and offline_access scopes. The authorization code returns through a localhost callback URL observed in the sign-in tab, then is exchanged at OpenAI’s token endpoint. No local server is started by Captionary for that callback. Reading that callback address needs temporary access to http://localhost; Captionary gives it back as soon as the sign-in ends, unless a local AI service you configured uses localhost.',
        chatgptP3:
          'Captionary stores the resulting access token, refresh token, expiration time, account/workspace identifier, and any returned email, plan, or account-type metadata in local extension storage under a key separate from exported settings. Tokens are not synced or included in settings exports. The email and plan can be displayed in the provider settings. The current implementation refreshes expiring access tokens through auth.openai.com.',
        chatgptP4:
          'AI requests and model-list requests for this provider go only to chatgpt.com/backend-api/codex, with the access token and account identifier in request headers. They also identify Captionary to OpenAI with an “originator: captionary” header, and for accounts OpenAI marks as FedRAMP accounts, a header saying so. These requests omit browser cookies. When you connect ChatGPT or test the connection, Captionary sends one short test request (“Reply with the single word OK”), which counts toward your plan’s usage like any other request. The response request sets store to false; this request parameter is not a guarantee about OpenAI’s overall retention practices. OpenAI’s account terms, availability, usage limits, and privacy practices apply.',
        chatgptP5:
          'Signing out deletes the locally stored tokens and account metadata and keeps the provider, with its access to chatgpt.com and auth.openai.com, so you can sign in again. Removing the provider also deletes the tokens and gives back that site access. Neither action calls a server-side token revocation endpoint or erases OpenAI-side records; to end the session at OpenAI as well, log out of all devices in ChatGPT’s security settings. You can also manage the extension’s site permissions in Chrome.',
        purposeH2: 'Purpose and sharing',
        purposeP1:
          'Captionary uses the data described here to provide its language-learning features. The current extension has no data-sale, advertising, or credit-scoring feature. It does not send your study data to a developer-operated backend. Data can leave your device through the service requests described above and through exports or links you choose to use.',
        purposeP2:
          'The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including its Limited Use requirements.',
        retentionH2: 'Retention and your controls',
        retentionP1:
          'Saved vocabulary and settings remain in local storage until you remove them, reset extension data, or remove the browser profile or extension. Cached AI answers have a configurable retention period and can be cleared in settings. Downloaded word-frequency data may remain cached locally. Local usage counters can be reset.',
        retentionP2:
          '“Delete everything” under Settings → Data & backup removes settings, saved vocabulary, AI provider connections, API keys, ChatGPT sign-in tokens, the reader’s last document, cached AI answers, and downloaded word-frequency lists, and gives back the site access granted for AI services.',
        retentionP3:
          'You can delete saved vocabulary entries, remove AI provider connections and their stored keys, clear cached AI answers, and use the extension’s data-reset controls. Export any study data you want to keep before resetting or uninstalling. Exported files are under your control and are not automatically deleted by the extension. Removing local data does not remove data already received by third-party services.',
        contactH2: 'Changes and contact',
        contactP1: 'We’ll update this policy when Captionary’s data practices change and revise the date above.',
        contactP2: 'Public support contact: <a href="https://github.com/mxggle/captionary/issues">github.com/mxggle/captionary/issues</a>.',
      },
    },
    'zh-CN': {
      indexTitle: 'Captionary：在 YouTube、Netflix 和 Apple TV+ 看剧学外语',
      indexDesc: '免费 Chrome 扩展，提供双语字幕、词组划选查词，并可接入你自己的 AI 助教：支持 ChatGPT 订阅账号、自带 API 密钥或本地模型。',
      ogTitle: 'Captionary：在看剧时直接查整个词组',
      ogDesc:
        '支持 YouTube、Netflix 与 Apple TV+ 双语字幕、整组划选查词，以及由你自选的 AI 助教（ChatGPT 订阅、自有 API 密钥或本地模型）。免费使用。',
      privacyTitle: '隐私政策 · Captionary',
      privacyDesc: 'Captionary Chrome 扩展如何处理字幕内容、学习数据以及可选的 AI 请求。',
      common: {
        skip: '跳至正文',
        brandAria: 'Captionary 首页',
        navAria: '页面分节',
        navPhrases: '词组查词',
        navAi: 'AI 助教',
        navCompare: '对比 Language Reactor',
        navFaq: '常见问题',
        langAria: '界面语言',
        ctaHeader: '添加到 Chrome',
        footLinks:
          'Captionary · <a href="https://github.com/mxggle/captionary">GitHub 源码</a> · <a href="https://github.com/mxggle/captionary/issues">反馈问题</a> · <a href="privacy.html" data-preserve-lang>隐私政策</a>',
        footFine:
          'Captionary 是独立开发的扩展，与 YouTube、Netflix、Apple 或 Dioco（Language Reactor）无隶属或合作关系。相关产品名称均为各自所有者的商标。',
      },
      index: {
        heroH1: '看剧<wbr>遇到生词，直接查<wbr><mark class="hl">整个词组</mark>。',
        heroLead:
          'Captionary 是一款适用于 YouTube、Netflix 和 Apple TV+ 的免费 Chrome 扩展。它会在原文字幕下方显示译文；点击单个词或拖选整个词组，AI 助教就会结合上下文为你讲解——可以直接用你的 ChatGPT 订阅、你自己的 API 密钥，或者在你电脑上运行的本地模型。',
        ctaHero: '免费添加到 Chrome',
        ctaCompare: '与 Language Reactor 对比',
        ctaNote: '无需注册账号，收藏的词条保存在浏览器本地。支持 youtube.com、netflix.com 和 tv.apple.com。',
        phoneNote: 'Captionary 运行在电脑端 Chrome 浏览器上。请在电脑上打开此页面进行安装。',
        demoLangAria: '演示语言',
        demoEs: '西班牙语',
        demoJa: '日语',
        demoFigcaption: '上方是可直接交互的查词卡片与示例回答。在扩展中，这些解析由你接入的 AI 实时生成。',
        phrasesH2: '有些意思，连成词组<wbr>才存在',
        phrasesP:
          '单查西语的 <i lang="es">cuenta</i>，词典会写“账单”。但在 <i lang="es">se dio cuenta</i> 里，它的意思是“意识到”，拆开看哪一个词都看不出这层含义。各门语言里的动词短语、习语和固定搭配都是如此。',
        phrasesLi1: '直接用鼠标拖选多个词，或先点一个词再按住 Shift 点击另一个词。',
        phrasesLi2: '接入 AI 助教后，即使只点了一个词，卡片也会指出它所属的固定搭配；再点一下就能直接改查整个词组。',
        phrasesLi3: '词组会自动还原为词典原形保存。<i lang="es">Se dio cuenta</i> 存入生词本时会记作 <i lang="es">darse cuenta</i>。',
        phrasesLi4: '同样支持中文、日语、泰语等词与词之间没有空格的语言。',
        glossAria: '逐词直译与整组释义对比',
        glossDt1: '逐词直译',
        glossDd1: '他自己 · 给了 · 账单',
        glossDt2: '作为词组',
        glossDd2: '<b lang="es">darse cuenta</b> · 意识到',
        aiH2: '直接用<wbr>你已经在付费的&nbsp;AI',
        aiP: 'Captionary 不售卖 AI 额度，也不会把你绑定在某一个模型上。手头有什么服务就直接连上，随时可以切换。',
        aiDt1: '使用 ChatGPT 账号登录',
        aiDd1:
          '直接使用你的 ChatGPT Plus、Pro 或 Business 订阅。无需配置 API 密钥，也不用额外花钱；请求会计入你订阅方案的 Codex 用量额度。',
        aiDt2: '使用自己的 API 密钥',
        aiDd2:
          '支持 OpenAI、Anthropic (Claude)、Google Gemini、OpenRouter、DeepSeek、Groq、Mistral、xAI，以及任何兼容 OpenAI 接口的服务。按各平台官方价格直接向服务商付费。',
        aiDt3: '在本地电脑上运行',
        aiDd3: '支持 Ollama、LM Studio 或 Chrome 内置的 Gemini Nano。数据完全留在你的设备上。',
        aiSmall:
          '不同任务可以分配不同模型：查单词用快而便宜的模型，拆解长句用能力更强的模型。还可以设置备用服务，应对接口故障或限流。查过的回答会自动缓存，并可设置每日请求上限以防超支。',
        aiPanelHead: 'AI 服务商',
        aiProvState1: '已登录',
        aiProvState2: 'API 密钥 ••••3f9a',
        aiProvState3: '本机运行',
        aiPanelLabel: '各任务使用的模型',
        aiRouteDt1: '单词与词组查询',
        aiRouteDt2: '整句结构拆解',
        aiRouteDt3: '追问对话',
        aiRouteDt4: '字幕翻译',
        aiRouteDt5: '主服务失败时',
        aiRouteDd5: '改用 ChatGPT',
        aiFigcaption: '设置示例：同时接入三个服务，按任务分配最合适的模型。',
        wordsH2: '生词本<wbr>完全免费，数据<wbr>归你所有',
        wordsP:
          '把单词或词组标记为“学习中”或“已掌握”。Captionary 会一并存下原句、译文、视频来源和对应的时间戳。标记为“学习中”的词再次出现在字幕、字幕列表或阅读器里时，下方会标有虚线提示。',
        wordsLi1: '内置抽认卡复习。',
        wordsLi2: '支持导出到 Anki 或 CSV，也可随时保存 JSON 备份。',
        wordsLi3: '无需注册，没有订阅费，词库就保存在你的浏览器里。',
        wordsPanelHead: '生词本 <span class="panel-count">3</span>',
        wordsTagLearn1: '学习中',
        wordsMean1: '意识到',
        wordsTagLearn2: '学习中',
        wordsMean2: '察觉到；<i lang="ja">気がついたら</i>：回过神来、不知不觉',
        wordsTagKnown: '已掌握',
        wordsMean3: '是对的，有道理',
        wordsBtnReview: '复习',
        wordsBtnAnki: '导出到 Anki',
        wordsFigcaption: '词库示例。每条词目都会保留它出处的那句原话。',
        compareH2: 'Captionary 与 Language Reactor 对比',
        compareP:
          'Language Reactor 是目前最知名的 Netflix 与 YouTube 外语学习工具，拥有两百万 Chrome 用户，很多功能做得非常成熟。下面是两者的主要差异。我们在 2026 年 10 月 18 日逐一核对了 Language Reactor 官方页面上的每项细节。',
        compareFeatureSr: '功能项',
        compareTableAria: '对比表',
        compareR1Th: '一次查多个词（词组）',
        compareR1Us: '<span class="mark yes">支持</span>鼠标拖选，或按住 Shift 点击',
        compareR1Lr:
          '<span class="mark no">不支持</span>每次只能点选一个词。其团队在 2026 年 6 月表示该功能仍在评估中。<a class="fn" href="#src-1" aria-label="来源 1">1</a>',
        compareR2Th: '保存单词与词组',
        compareR2Us: '<span class="mark yes">免费</span>包含抽认卡复习、Anki 与 CSV 导出',
        compareR2Lr:
          '<span class="mark part">需 Pro 会员</span>免费版仅限在其 PhrasePump 练习内使用<a class="fn" href="#src-2" aria-label="来源 2">2</a>',
        compareR3Th: 'AI 讲解',
        compareR3Us:
          '<span class="mark yes">上限自定</span>支持词义讲解、句子拆解与追问对话；额度取决于你接入的服务商，默认每日上限 300 次（可自行修改）',
        compareR3Lr:
          '<span class="mark part">每日 5 次</span>Lexa AI：登录后每天免费提问 5 次，Pro 会员不限次数<a class="fn" href="#src-3" aria-label="来源 3">3</a>',
        compareR4Th: '自选 AI 模型',
        compareR4Us: '<span class="mark yes">支持</span>可用 ChatGPT 登录、8 家云服务商自有密钥、任意 OpenAI 兼容接口或本地模型',
        compareR4Lr: '<span class="mark no">不支持</span>仅限使用 Language Reactor 自带 AI',
        compareR5Th: 'Netflix 缺少母语字幕时的翻译',
        compareR5Us: '<span class="mark yes">免费</span>调用 Chrome 本地端侧翻译，或你接入的 AI',
        compareR5Lr:
          '<span class="mark part">需 Pro 会员</span>机器翻译，每天约 5 小时新内容额度<a class="fn" href="#src-4" aria-label="来源 4">4</a>',
        compareR6Th: '支持 Apple TV+',
        compareR6Us: '<span class="mark yes">支持</span>同时支持 YouTube 和 Netflix',
        compareR6Lr: '<span class="mark no">不支持</span>支持 YouTube 和 Netflix<a class="fn" href="#src-5" aria-label="来源 5">5</a>',
        compareR7Th: '账号要求',
        compareR7Us: '<span class="mark yes">无需账号</span>所有数据保存在你的浏览器本地',
        compareR7Lr: '<span class="mark part">需要账号</span>使用 Pro、Lexa AI 提问及跨设备同步时需登录',
        compareR8Th: '价格',
        compareR8Us: '<span class="mark yes">免费</span>若使用付费 API，仅由对应服务商按实际用量计费',
        compareR8Lr:
          '<span class="mark part">免费增值</span>Pro 会员按月、季或年订阅收费<a class="fn" href="#src-2" aria-label="来源 2">2</a>',
        fairH3Ahead: 'Language Reactor 领先的地方',
        fairLi1: '它的网页端可在手机和平板上使用；Captionary 仅支持桌面端 Chrome。',
        fairLi2: '设置、生词和聊天记录保存在云端账号中，可跨设备同步；Captionary 没有云同步，需要手动导入导出 JSON 备份。',
        fairLi3: '开通 Pro 后支持语音识别生成字幕，包括为 Netflix 配音音轨生成字幕。',
        fairLi4: '内置视频、书籍和播客目录，提供名为 Aria 的对话练习伙伴，以及测试版英语课程。',
        fairLi5: '它的 Anki 导出包含画面截图与音频；Captionary 导出纯文本（词条、释义和原句）。',
        fairH3Both: '两者都具备的<wbr>功能',
        fairPBoth:
          '双语字幕、字幕列表、每句自动暂停与单句循环、键盘快捷键、注音/罗马音转写、词频颜色标记、文本阅读器、本地视频挂接字幕播放，以及 Anki 导出。',
        fairH3Pick: '怎么选',
        fairPPick:
          '如果你想整组查词、自选 AI 模型，或者不想为了背单词付订阅费，选 Captionary。如果你经常在手机上学习、需要云端账号同步生词，或者常看没有字幕的 Netflix 配音剧，选 Language Reactor。',
        src1: 'Language Reactor 论坛，2026 年 6 月 26 日官方团队回复：<a href="https://forum.languagelearningwithnetflix.com/t/how-to-select-multiple-word-definitions/41477">How to select multiple word definitions?</a>',
        src2: '<a href="https://www.languagereactor.com/pro-mode">Language Reactor Pro 页面</a>',
        src3: '<a href="https://www.languagereactor.com/help/updates">Language Reactor 更新日志</a>，2026 年 9 月',
        src4: '<a href="https://www.languagereactor.com/help/faq">Language Reactor 常见问题 (FAQ)</a>',
        src5: '<a href="https://chromewebstore.google.com/detail/language-reactor/hoombieeljmmljlkjmnheibnpciblicm">Chrome 应用商店中的 Language Reactor 页面</a>',
        compareFine:
          'Language Reactor 由 Dioco 开发。Captionary 是独立项目，与其无任何关联。如果此处信息有出入或已过时，欢迎<a href="https://github.com/mxggle/captionary/issues">提交 Issue</a>，我们会及时更正。',
        toolkitH2: '其他<wbr>实用功能',
        tkDt1: '融入原生播放器',
        tkDd1: '开关按钮直接嵌入各视频网站自带的控制栏，菜单和查词卡片也会匹配当前网站的配色与字体。',
        tkDt2: '优先选用最佳翻译来源',
        tkDd2:
          '有人工字幕时优先用人工字幕，其次依次使用 YouTube 自动翻译、Chrome 本地翻译或你接入的 AI。还可以开启译文模糊，鼠标悬停时再显示，方便自测听力。',
        tkDt3: '交互式字幕列表',
        tkDd3: '随视频播放自动滚动。支持全文搜索、点击跳转到任意一句、复制台词，或下载包含双语的 .srt 字幕文件。',
        tkDt4: '注音与罗马音',
        tkDd4: '在原文字幕下方显示带声调的汉语拼音、日语假名罗马音，以及韩语、俄语、希腊语等多种语言的转写。',
        tkDt5: '整句语法拆解',
        tkDd5: '按 <kbd>E</kbd> 键即可查看当前台词的整句翻译、逐词直译、意群切分和核心语法点。',
        tkDt6: '专为精听设计的播放控制',
        tkDd6:
          '播完每句自动暂停、单句重复、前后逐句跳转、调节倍速。默认使用 <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>，所有快捷键均可自定义。',
        tkDt7: '影视词频提示',
        tkDd7: '可选开启词频下划线，直观看出某个词在影视字幕里的罕见程度，帮你判断哪些词值得收藏。',
        tkDt8: '文本阅读器',
        tkDd8: '粘贴文章、打开 .txt / .srt / .vtt 文件，或在任意网页上右键调用阅读器，像点按字幕一样随时查词。',
        tkDt9: '播放本地视频',
        tkDd9: '直接打开电脑硬盘里的视频和字幕文件，同样可以使用双语字幕、字幕列表和划词查询。',
        privacyH2: '你的密钥和生词，都留在<wbr>你自己的<wbr>浏览器里',
        privacyP:
          'Captionary 没有账号系统、不收集分析数据，也没有广告。全部源码公开在 <a href="https://github.com/mxggle/captionary">GitHub</a> 上，你可以随时查验。',
        privacyLi1:
          'API 密钥和 ChatGPT 登录令牌保存在你电脑上扩展专属的本地存储中，绝不会同步或随设置导出，仅发往对应的服务商，普通网页也无法读取。',
        privacyLi2:
          '只有当你添加某项 AI 服务时，Chrome 才会单独请求该网站的访问权限；移除服务时，Captionary 会立即归还权限。使用 ChatGPT 登录时会临时请求一次 localhost 权限以读取登录回调，登录完成后立即释放。',
        privacyLi3: '你可以自行决定随请求发送多少上下文：只发所查词条、发送所在句子，或附带前后几句台词，以及是否包含视频标题。',
        privacyLi4: '提示词中会将字幕文本标记为不可信输入，且返回的回答禁止加载外部图片或执行 HTML。',
        faqH2: '常见问题',
        faqQ1: 'Captionary 真的完全免费吗？',
        faqA1:
          '是的，扩展本身完全免费。如果你接入了按量计费的云端 API，费用由对应的服务商按你的实际用量收取；如果使用 ChatGPT 账号登录、本地模型或 Chrome 内置 AI，则没有任何额外费用。',
        faqQ2: '必须准备 API 密钥才能用吗？',
        faqA2:
          '不需要。双语字幕、字幕翻译、内置词典、生词收藏和抽认卡复习都不依赖 AI。如果要用 AI 助教，除了填密钥，也可以直接登录 ChatGPT、运行本地模型，或使用 Chrome 内置的端侧 AI。',
        faqQ3: '“使用 ChatGPT 登录”是怎么工作的？',
        faqA3:
          '你会在 OpenAI 官方页面完成登录（方式与 OpenAI 的 Codex CLI 相同），让 Captionary 调用你的 ChatGPT Plus、Pro 或 Business 订阅，请求会计入订阅的 Codex 用量限额。OpenAI 并未面向第三方应用公开文档化这一接口，因此未来可能会有变动；万一失效，API 密钥和本地模型仍可正常使用。Captionary 与 OpenAI 无隶属关系。',
        faqQ4: '用自己的 API 密钥大概要花多少钱？',
        faqA4:
          '取决于你选的服务商和模型。Captionary 做了多项省钱设计：只有你主动点击时才生成讲解、已查过的结果会自动缓存、还能设置每日请求上限。设置页也会统计每个模型的请求次数和 Token 用量。',
        faqQ5: '支持学习哪些语言？',
        faqA5:
          '只要视频有对应字幕，任何语言都可以学。词组划选同样支持中文、日语和泰语；注音转写覆盖中文拼音、日语假名、韩语、俄语、乌克兰语、保加利亚语、塞尔维亚语、希腊语等。AI 助教会用你设定的母语回答。',
        faqQ6: '支持哪些浏览器和设备？',
        faqA6: '桌面端 Chrome 浏览器。暂不支持手机和平板电脑。',
        faqQ7: 'Captionary 和 YouTube、Netflix、Apple 或 Language Reactor 有关系吗？',
        faqA7: '没有。Captionary 是独立开发的浏览器扩展。观看 Netflix 和 Apple TV+ 仍需自备相应平台的订阅，字幕内容取决于视频本身。',
        finalH2: '下次看视频时，直接<wbr>试试看',
        finalP: '安装后只需几步简短引导：选好你想学的语言，按需连上 AI 助教（也可以先跳过）。',
        ctaFooter: '免费添加到 Chrome',
      },
      privacyPage: {
        h1: 'Captionary 隐私政策',
        updated: '最后更新于 2026 年 10 月 18 日。',
        intro: 'Captionary 帮助你通过视频字幕与阅读材料学习外语。本政策说明扩展程序如何处理这些学习材料、你的学习数据以及可选的 AI 请求。',
        storedH2: '保存在<wbr>浏览器中的<wbr>数据',
        storedP1:
          'Captionary 会将设置项、语言偏好、保存的单词与词组、笔记、例句上下文、来源标题与网址、视频时间戳、已配置的 AI 服务以及本地用量计数保存在浏览器的扩展本地存储中。扩展还可能在本地缓存 AI 回答与已下载的词频列表。导入的阅读材料与侧边栏上下文通过浏览器的会话存储（session storage）在扩展页面之间传递。阅读器还会在扩展本地存储中保留你最后打开的一篇文档（标题、网址、语言和正文）以便随时继续阅读；打开新文档时会覆盖旧记录。',
        storedP2:
          '各服务商的 API 密钥单独保存在扩展本地存储中，不会包含在导出的设置文件里，仅在需要验证请求时发送给你所配置的服务商。普通网页无法读取扩展存储，但浏览器本地存储并非加密凭据保险箱，请妥善保护你的浏览器配置文件与设备安全。',
        storedP3:
          'Captionary 不使用 Chrome 同步（Chrome Sync）传输上述数据。当前版本的扩展不包含由开发者运营的账号服务、分析统计 SDK 或广告组件。',
        contentH2: '视频<wbr>与阅读内容',
        contentP1:
          '在受支持的视频网站上，Captionary 会读取字幕轨道与播放状态，用于显示双语字幕、查询词义及提供学习播放控制。当你主动在阅读器中打开某个网页时，扩展会读取你所选定或页面可提取的正文文本、标题、网址与语言信息。扩展不会读取 Chrome 的浏览历史数据库。来源信息可能会随你收藏的生词或导入的阅读材料保存在本地。',
        contentP2:
          '使用阅读器或本地视频播放功能时，扩展会在本地打开你选择的视频和文本文件。Captionary 在播放过程中不会上传你的本地视频文件。如果你对本地文件的文本或字幕调用了云端 AI 功能，相关文本会发送给你所配置的 AI 服务。',
        requestsH2: '向其他服务<wbr>发起的请求',
        requestsLi1: '视频平台及其字幕服务器会收到获取当前学习字幕所需的正常网络请求。',
        requestsLi2: '维基词典（Wiktionary）查询默认开启。开启期间，你查询的单词或词组会发送至 Wiktionary 以获取词典释义。',
        requestsLi3: '启用词频颜色标记时，Captionary 会从托管在 GitHub 上的数据集中下载对应语言的词频表。',
        requestsLi4: '当你主动点击外部词典或搜索链接时，浏览器会打开对应服务并将查询词带入网址中。',
        requestsLi5:
          '发音朗读功能调用浏览器自带的语音合成（Speech Synthesis）声音；部分语音可能由浏览器通过在线服务合成，具体处理方式取决于所选语音和浏览器。',
        requestsP: '上述外部服务在接收请求时会获取常规网络信息（如你的 IP 地址），并适用各自的隐私政策。',
        aiH2: '可选的 AI 功能',
        aiP1: '扩展默认不配置任何云端 AI 服务商。如果你自行添加了服务商并使用 AI 功能，Captionary 会将相关的单词、词组、句子、字幕文本、提示词或对话发送给该服务商。请求中还可能包含你设置的语言与学习水平。根据具体任务及你的隐私设置，请求可能附带相邻的几句字幕、现有译文或媒体标题。标题分享默认开启；在阅读器中，标题即网页标题。“剧中”标签默认关闭；如果你开启它，并在视频里为某个人名或专有名词打开它，这次请求还会附带本集提到它的字幕行（除非你允许剧透，否则只包含播放到当前位置之前的台词）。追问对话会包含最近的几轮对话记录；字幕翻译则会按批次发送字幕行。',
        aiP2: '如果你设置了备用服务商（Fallback），当主服务商无法响应（如服务故障、触发速率限制或配额耗尽）时，扩展会将相同内容的请求改发给备用服务商。',
        aiP3: '当你添加某项 AI 服务时，Captionary 会向 Chrome 申请访问该服务商域名的权限；移除该服务时会自动交还权限（除非你配置的另一项服务仍在使用同一域名）。',
        aiP4: '完成配置后，可选的自动讲解或 AI 字幕翻译会在你使用相应功能时发起请求。在学习涉及个人隐私的材料前，请先检查你的设置；除非你明确知情并同意，否则请勿将敏感个人信息发送给云端服务商。',
        aiP5: '你可以随时调整讲解请求附带的上下文范围与标题分享开关、更换服务商、关闭自动讲解，或改用本地 AI 服务。受支持的 Chrome 端侧 AI 与端侧翻译会在你的设备本地完成处理（首次配置可能需要下载模型或语言包）。本地接口（localhost）服务通过你自行配置本机程序运行，其是否会进一步联网取决于该程序自身的配置。',
        aiP6: '各家云端 AI 服务商自行决定其数据保留、模型训练、账号管理与计费规则。Captionary 无法撤回或删除服务商已经收到的数据，请查阅对应服务商的隐私政策与账号设置。',
        chatgptH2: '可选的 ChatGPT 账号登录',
        chatgptP1:
          '如果你选择使用 ChatGPT 登录，Captionary 会通过带 PKCE 的 OAuth 授权流程在 auth.openai.com 打开 OpenAI 官方认证页面。该流程使用 OpenAI 为其 Codex 命令行工具公开提供的客户端标识；OpenAI 并未面向第三方应用公开文档化这一登录方式，因此该功能未来可能发生变化或停止可用。Captionary 与 OpenAI 无隶属或合作关系，也绝不会接触你的 OpenAI 密码。',
        chatgptP2:
          '登录请求包含 openid、profile、email 和 offline_access 权限范围。授权码通过登录标签页中的 localhost 回调地址返回，随后与 OpenAI 的令牌端点交换令牌。Captionary 不会为此启动任何本地服务器。读取该回调地址需要临时申请 http://localhost 的访问权限；登录一结束，Captionary 就会立即交还该权限（除非你同时配置了使用 localhost 的本地 AI 服务）。',
        chatgptP3:
          'Captionary 会将获取到的访问令牌（access token）、刷新令牌（refresh token）、过期时间、账号/工作区标识符，以及返回的邮箱、订阅方案或账号类型元数据保存在扩展本地存储中，并与可导出的设置项隔离存储。令牌不会同步，也不会包含在设置导出文件中。邮箱与订阅方案可在服务商设置页中显示。当前实现会通过 auth.openai.com 自动刷新即将过期的访问令牌。',
        chatgptP4:
          '该渠道的 AI 请求与模型列表请求仅发送至 chatgpt.com/backend-api/codex，并在请求头中附带访问令牌与账号标识符，同时通过 “originator: captionary” 请求头向 OpenAI 标明来源（若账号被 OpenAI 标记为 FedRAMP 账号，还会附带相应标识头）。这些请求不携带浏览器 Cookie。当你连接 ChatGPT 或点击测试连接时，Captionary 会发送一条简短的测试请求（“Reply with the single word OK”），该请求与普通请求一样计入你的订阅用量。响应请求中会将 store 参数设为 false，但该请求参数并不构成对 OpenAI 整体数据保留策略的保证。使用过程适用 OpenAI 的账号条款、服务可用性、用量限制与隐私政策。',
        chatgptP5:
          '点击退出登录会删除本地保存的令牌与账号元数据，但会保留该服务商条目及其对 chatgpt.com 和 auth.openai.com 的站点权限，方便你再次登录；移除该服务商则会同时删除令牌并交还站点访问权限。这两种操作都不会调用服务端令牌吊销接口，也不会清除 OpenAI 服务器端的记录；如需同时在 OpenAI 端终止会话，请前往 ChatGPT 安全设置中选择退出所有设备。你也可以随时在 Chrome 的扩展程序管理页中管理站点权限。',
        purposeH2: '数据用途<wbr>与共享',
        purposeP1:
          'Captionary 仅将上述数据用于提供语言学习功能。当前扩展不包含任何数据售卖、广告投放或信用评估功能，也不会将你的学习数据发送到开发者运营的后端服务器。只有在发生上述外部服务请求，或你主动使用导出功能与外部链接时，相关数据才会离开你的设备。',
        purposeP2: '对于从 Google API 获取的信息，其使用将严格遵守《Chrome 应用商店用户数据政策》（包括其中的“有限使用”要求）。',
        retentionH2: '数据保留<wbr>与你的控制权',
        retentionP1:
          '保存的生词与设置会一直保留在浏览器本地存储中，直到你主动删除它们、重置扩展数据，或删除浏览器配置文件及卸载扩展。缓存的 AI 回答设有可配置的保留期限，并可在设置中随时清空；已下载的词频数据可能保留在本地缓存中；本地用量计数器也可随时重置。',
        retentionP2:
          '在“设置 → 数据与备份”中点击“删除所有数据”，即可清除全部设置、生词本、AI 服务商配置、API 密钥、ChatGPT 登录令牌、阅读器最近打开的文档、AI 回答缓存以及已下载的词频列表，并同时交还授予各 AI 服务的站点访问权限。',
        retentionP3:
          '你可以逐条删除生词、移除 AI 服务商及其保存的密钥、清空 AI 缓存，或使用扩展的数据重置功能。在重置数据或卸载扩展前，请先导出你想保留的学习记录。导出的文件由你自行保管，扩展不会自动删除它们。清除本地数据不会删除第三方服务商此前已经收到的数据。',
        contactH2: '政策更新<wbr>与联系方式',
        contactP1: '当 Captionary 的数据处理方式发生变更时，我们会更新本政策，并在发布新版本时修订页面顶部的更新日期。',
        contactP2: '公开支持与问题反馈：<a href="https://github.com/mxggle/captionary/issues">github.com/mxggle/captionary/issues</a>。',
      },
    },
    'zh-TW': {
      indexTitle: 'Captionary：在 YouTube、Netflix 和 Apple TV+ 看劇學外語',
      indexDesc:
        '免費 Chrome 擴充功能，提供雙語字幕、片語選取查詢，並可連接你自己的 AI 助教：支援 ChatGPT 訂閱方案、自備 API 金鑰或本機模型。',
      ogTitle: 'Captionary：在看劇時直接查整個片語',
      ogDesc:
        '支援 YouTube、Netflix 與 Apple TV+ 雙語字幕、整組片語查詢，以及由你自選的 AI 助教（ChatGPT 訂閱、自備 API 金鑰或本機模型）。免費使用。',
      privacyTitle: '隱私權政策 · Captionary',
      privacyDesc: 'Captionary Chrome 擴充功能如何處理字幕內容、學習資料以及選用的 AI 請求。',
      common: {
        skip: '跳至主要內容',
        brandAria: 'Captionary 首頁',
        navAria: '頁面章節',
        navPhrases: '片語查詢',
        navAi: 'AI 助教',
        navCompare: '比較 Language Reactor',
        navFaq: '常見問題',
        langAria: '介面語言',
        ctaHeader: '加到 Chrome',
        footLinks:
          'Captionary · <a href="https://github.com/mxggle/captionary">GitHub 原始碼</a> · <a href="https://github.com/mxggle/captionary/issues">回報問題</a> · <a href="privacy.html" data-preserve-lang>隱私權政策</a>',
        footFine:
          'Captionary 是獨立開發的擴充功能，與 YouTube、Netflix、Apple 或 Dioco（Language Reactor）無隸屬或合作關係。相關產品名稱皆為各自所有者的商標。',
      },
      index: {
        heroH1: '看劇<wbr>遇到生詞，直接查<wbr><mark class="hl">整個片語</mark>。',
        heroLead:
          'Captionary 是一款適用於 YouTube、Netflix 和 Apple TV+ 的免費 Chrome 擴充功能。它會在原文字幕下方顯示翻譯；點擊單字或拖曳選取整個片語，AI 助教就會結合前後文為你解說——可以直接用你的 ChatGPT 訂閱方案、你自己的 API 金鑰，或是在你電腦上執行的本機模型。',
        ctaHero: '免費加到 Chrome',
        ctaCompare: '與 Language Reactor 比較',
        ctaNote: '不必註冊帳號，儲存的單字留在你的瀏覽器裡。支援 youtube.com、netflix.com 和 tv.apple.com。',
        phoneNote: 'Captionary 僅在電腦版 Chrome 瀏覽器上運作。請在電腦上開啟此頁面進行安裝。',
        demoLangAria: '示範語言',
        demoEs: '西班牙語',
        demoJa: '日語',
        demoFigcaption: '上方是可直接互動的查詢卡片與範例回答。在擴充功能裡，這些解說由你連接的 AI 即時撰寫。',
        phrasesH2: '有些意思，湊成片語<wbr>才存在',
        phrasesP:
          '單查西語的 <i lang="es">cuenta</i>，字典會寫「帳單」。但在 <i lang="es">se dio cuenta</i> 裡，它的意思是「意識到」，拆開看哪一個字都看不出這層意思。各種語言裡的片語動詞、慣用語和固定搭配都是如此。',
        phrasesLi1: '直接用滑鼠拖曳選取多個字，或先點一個字再按住 Shift 點擊另一個字。',
        phrasesLi2: '接上 AI 助教後，就算只點了一個單字，卡片也會指出它所屬的固定片語；再點一下就能改查整個片語。',
        phrasesLi3: '片語會自動以字典原形儲存。<i lang="es">Se dio cuenta</i> 存進單字本時會記為 <i lang="es">darse cuenta</i>。',
        phrasesLi4: '同樣支援中文、日文、泰文等字詞之間沒有空格的語言。',
        glossAria: '逐字直譯與整個片語的對照',
        glossDt1: '逐字直譯',
        glossDd1: '他自己 · 給了 · 帳單',
        glossDt2: '作為片語',
        glossDd2: '<b lang="es">darse cuenta</b> · 意識到',
        aiH2: '直接用<wbr>你已經在付費的&nbsp;AI',
        aiP: 'Captionary 不賣 AI 點數，也不會把你綁死在某一個模型上。手邊有什麼服務就直接連上，隨時可以切換。',
        aiDt1: '使用 ChatGPT 帳號登入',
        aiDd1: '直接使用你的 ChatGPT Plus、Pro 或 Business 方案。不必設定 API 金鑰，也不必額外付費；請求會計入你方案的 Codex 使用額度。',
        aiDt2: '使用自己的 API 金鑰',
        aiDd2:
          '支援 OpenAI、Anthropic (Claude)、Google Gemini、OpenRouter、DeepSeek、Groq、Mistral、xAI，以及任何相容於 OpenAI 介面的端點。依各家官方定價直接向服務商付費。',
        aiDt3: '在自己的電腦上執行',
        aiDd3: '支援 Ollama、LM Studio 或 Chrome 內建的 Gemini Nano。資料完全不會離開你的電腦。',
        aiSmall:
          '不同任務可以指定不同模型：查單字用快又便宜的模型，拆解長句用能力更強的模型。還可以設定備援服務，應付斷線或流量限制。查過的回答會自動快取，也能設定每日請求上限以防超支。',
        aiPanelHead: 'AI 服務商',
        aiProvState1: '已登入',
        aiProvState2: 'API 金鑰 ••••3f9a',
        aiProvState3: '在此電腦上執行',
        aiPanelLabel: '各項任務使用的模型',
        aiRouteDt1: '單字與片語查詢',
        aiRouteDt2: '整句結構拆解',
        aiRouteDt3: '延伸提問對話',
        aiRouteDt4: '字幕翻譯',
        aiRouteDt5: '主服務失敗時',
        aiRouteDd5: '改用 ChatGPT',
        aiFigcaption: '設定範例：同時連接三個服務，依任務挑選適合的模型。',
        wordsH2: '單字本<wbr>完全免費，資料<wbr>永遠屬於你',
        wordsP:
          '把單字或片語標記為「學習中」或「已掌握」。Captionary 會一併留存原句、翻譯、影片來源與時間戳記。標記為「學習中」的字詞再次出現在字幕、字幕列表或閱讀器時，下方會加上虛線底線提醒你。',
        wordsLi1: '內建字卡複習功能。',
        wordsLi2: '支援匯出至 Anki 或 CSV，也可隨時保留 JSON 備份。',
        wordsLi3: '免註冊、免訂閱，單字清單就儲存在你的瀏覽器裡。',
        wordsPanelHead: '儲存的字詞 <span class="panel-count">3</span>',
        wordsTagLearn1: '學習中',
        wordsMean1: '意識到',
        wordsTagLearn2: '學習中',
        wordsMean2: '察覺到；<i lang="ja">気がついたら</i>：回過神來、不知不覺',
        wordsTagKnown: '已掌握',
        wordsMean3: '是對的，有道理',
        wordsBtnReview: '複習',
        wordsBtnAnki: '匯出至 Anki',
        wordsFigcaption: '清單範例。每筆字詞都會保留它出處的那句台詞。',
        compareH2: 'Captionary 與 Language Reactor 比較',
        compareP:
          'Language Reactor 是目前最知名的 Netflix 與 YouTube 外語學習工具，擁有兩百萬名 Chrome 使用者，許多功能做得相當完善。以下是兩者的主要差異。我們在 2026 年 10 月 18 日逐一核對了 Language Reactor 官方頁面上的每項細節。',
        compareFeatureSr: '功能項目',
        compareTableAria: '比較表',
        compareR1Th: '一次查詢多個單字（片語）',
        compareR1Us: '<span class="mark yes">支援</span>滑鼠拖曳選取，或按住 Shift 點擊',
        compareR1Lr:
          '<span class="mark no">不支援</span>每次只能點選一個字。其團隊於 2026 年 6 月表示此功能仍在評估中。<a class="fn" href="#src-1" aria-label="來源 1">1</a>',
        compareR2Th: '儲存單字與片語',
        compareR2Us: '<span class="mark yes">免費</span>內含字卡複習、Anki 與 CSV 匯出',
        compareR2Lr:
          '<span class="mark part">需 Pro 方案</span>免費版僅限在其 PhrasePump 練習內使用<a class="fn" href="#src-2" aria-label="來源 2">2</a>',
        compareR3Th: 'AI 解說',
        compareR3Us:
          '<span class="mark yes">自行設定上限</span>支援字義解說、句子拆解與延伸對話；額度取決於你連接的服務商，預設每日上限 300 次（可自行調整）',
        compareR3Lr:
          '<span class="mark part">每日 5 次</span>Lexa AI：登入後每天免費提問 5 次，Pro 方案無限次<a class="fn" href="#src-3" aria-label="來源 3">3</a>',
        compareR4Th: '自選 AI 模型',
        compareR4Us: '<span class="mark yes">支援</span>可用 ChatGPT 登入、8 家雲端服務商自備金鑰、任何 OpenAI 相容端點或本機模型',
        compareR4Lr: '<span class="mark no">不支援</span>僅限使用 Language Reactor 自家 AI',
        compareR5Th: 'Netflix 缺少母語字幕時的翻譯',
        compareR5Us: '<span class="mark yes">免費</span>使用 Chrome 本機端翻譯，或你連接的 AI',
        compareR5Lr:
          '<span class="mark part">需 Pro 方案</span>機器翻譯，每天約 5 小時新內容額度<a class="fn" href="#src-4" aria-label="來源 4">4</a>',
        compareR6Th: '支援 Apple TV+',
        compareR6Us: '<span class="mark yes">支援</span>同時支援 YouTube 和 Netflix',
        compareR6Lr: '<span class="mark no">不支援</span>支援 YouTube 和 Netflix<a class="fn" href="#src-5" aria-label="來源 5">5</a>',
        compareR7Th: '帳號要求',
        compareR7Us: '<span class="mark yes">免帳號</span>所有資料皆儲存在你的瀏覽器本機',
        compareR7Lr: '<span class="mark part">需要帳號</span>使用 Pro、Lexa AI 提問及跨裝置同步時需登入',
        compareR8Th: '價格',
        compareR8Us: '<span class="mark yes">免費</span>若使用付費 API，僅由該服務商依實際用量計費',
        compareR8Lr:
          '<span class="mark part">免費增值</span>Pro 為月繳、季繳或年繳訂閱制<a class="fn" href="#src-2" aria-label="來源 2">2</a>',
        fairH3Ahead: 'Language Reactor 領先的地方',
        fairLi1: '它的網站可在手機和平板上使用；Captionary 僅支援電腦版 Chrome。',
        fairLi2: '設定、儲存的單字與對話紀錄儲存在雲端帳號中，可跨裝置同步；Captionary 沒有雲端同步，需自行匯入匯出 JSON 備份。',
        fairLi3: '升級 Pro 後可用語音辨識產生字幕，包括為 Netflix 配音音軌產生字幕。',
        fairLi4: '內建影片、書籍與 Podcast 目錄，提供名為 Aria 的對話練習夥伴，以及測試版英語課程。',
        fairLi5: '它的 Anki 匯出包含畫面截圖與音訊；Captionary 匯出純文字（字詞、釋義和原句）。',
        fairH3Both: '兩者皆具備的<wbr>功能',
        fairPBoth:
          '雙語字幕、字幕列表、每句自動暫停與單句重播、鍵盤快捷鍵、拼音／羅馬音轉寫、詞頻顏色標記、文字閱讀器、本機影片掛載字幕播放，以及 Anki 匯出。',
        fairH3Pick: '該選<wbr>哪一個',
        fairPPick:
          '如果你想整組查片語、自選 AI 模型，或是不想為了背單字付訂閱費，選 Captionary。如果你常在手機上學習、需要雲端帳號同步單字，或是常看沒有字幕的 Netflix 配音影集，選 Language Reactor。',
        src1: 'Language Reactor 論壇，2026 年 6 月 26 日官方人員回覆：<a href="https://forum.languagelearningwithnetflix.com/t/how-to-select-multiple-word-definitions/41477">How to select multiple word definitions?</a>',
        src2: '<a href="https://www.languagereactor.com/pro-mode">Language Reactor Pro 頁面</a>',
        src3: '<a href="https://www.languagereactor.com/help/updates">Language Reactor 更新紀錄</a>，2026 年 9 月',
        src4: '<a href="https://www.languagereactor.com/help/faq">Language Reactor 常見問題 (FAQ)</a>',
        src5: '<a href="https://chromewebstore.google.com/detail/language-reactor/hoombieeljmmljlkjmnheibnpciblicm">Chrome 線上應用程式商店上的 Language Reactor</a>',
        compareFine:
          'Language Reactor 由 Dioco 開發。Captionary 為獨立專案，與其無任何關聯。若此處資訊有誤或已過時，歡迎<a href="https://github.com/mxggle/captionary/issues">開啟 Issue</a>，我們會盡快修正。',
        toolkitH2: '其他<wbr>實用工具',
        tkDt1: '自然融入各家播放器',
        tkDd1: '開關按鈕直接嵌進影音網站原有的控制列，選單與查詢卡片也會配合該網站的外觀與字型。',
        tkDt2: '優先採用最佳翻譯來源',
        tkDd2:
          '有人工字幕時優先使用，接著依序使用 YouTube 自動翻譯、Chrome 本機翻譯或你連接的 AI。還可以把譯文模糊處理，滑鼠移過去才顯示，方便自我測驗。',
        tkDt3: '互動式字幕列表',
        tkDd3: '隨播放進度自動捲動。可搜尋台詞、點擊跳至任意一句、複製內容，或下載包含雙語的 .srt 字幕檔。',
        tkDt4: '發音轉寫與羅馬音',
        tkDd4: '在原文字幕下方顯示帶聲調的漢語拼音、日文假名羅馬音，以及韓文、俄文、希臘文等多種語言的羅馬拼音。',
        tkDt5: '整句文法拆解',
        tkDd5: '按下 <kbd>E</kbd> 鍵，即可查看目前台詞的整句翻譯、逐字直譯、語塊切分與文法重點。',
        tkDt6: '專為精聽設計的播放控制',
        tkDd6: '每句播完自動暫停、單句重播、前後逐句跳轉、調整語速。預設使用 <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>，所有快捷鍵皆可自訂。',
        tkDt7: '影視詞頻標示',
        tkDd7: '可選擇開啟詞頻底線，一眼看出某個字在影視字幕裡有多罕見，幫你判斷哪些字值得存下來。',
        tkDt8: '文字閱讀器',
        tkDd8: '貼上文章、開啟 .txt / .srt / .vtt 檔案，或在任何網頁按右鍵開啟閱讀器，像點選字幕一樣隨時查字。',
        tkDt9: '播放自己的影片檔',
        tkDd9: '直接播放電腦硬碟裡的影片與字幕檔，同樣享有雙語字幕、字幕列表與點擊查字功能。',
        privacyH2: '你的金鑰與單字，都留在<wbr>你自己的<wbr>瀏覽器裡',
        privacyP:
          'Captionary 沒有帳號系統、不收集分析數據，也沒有廣告。所有原始碼都公開在 <a href="https://github.com/mxggle/captionary">GitHub</a> 上，你可以親自檢視。',
        privacyLi1:
          'API 金鑰與 ChatGPT 登入權杖儲存在你電腦上擴充功能專屬的本機儲存空間中，絕不會同步或隨設定匯出，僅傳送給所屬的服務商，一般網頁也無法讀取。',
        privacyLi2:
          '只有當你新增某個 AI 服務時，Chrome 才會逐站詢問該網站的存取權限；移除服務時，Captionary 會立即歸還權限。使用 ChatGPT 登入時會短暫需要 localhost 權限以讀取登入結果，登入完成後立即釋放。',
        privacyLi3: '你可以自行決定隨請求傳送多少前後文：只傳查詢的字詞、傳送整句，或附帶前後幾句台詞，以及是否包含影片標題。',
        privacyLi4: '提示詞中會將字幕文字標記為不受信任的輸入，且回傳的解答無法載入外部圖片或執行 HTML。',
        faqH2: '常見問題',
        faqQ1: 'Captionary 真的完全免費嗎？',
        faqA1:
          '是的，擴充功能本身完全免費。如果你連接了付費 API，費用由該服務商依你的實際用量收取；如果使用 ChatGPT 帳號登入、本機模型或 Chrome 內建 AI，則沒有任何額外費用。',
        faqQ2: '一定要有 API 金鑰才能用嗎？',
        faqA2:
          '不需要。雙語字幕、翻譯、內建字典、儲存單字與字卡複習都不依賴 AI。若要使用 AI 助教，除了填入API 金鑰，也可以直接登入 ChatGPT、執行本機模型，或使用 Chrome 內建的本機 AI。',
        faqQ3: '「使用 ChatGPT 帳號登入」是如何運作的？',
        faqA3:
          '你會在 OpenAI 官方頁面完成登入（方式與 OpenAI 的 Codex CLI 相同），讓 Captionary 使用你的 ChatGPT Plus、Pro 或 Business 方案，請求會計入該方案的 Codex 使用額度。OpenAI 並未針對第三方應用程式公開這條管道的文件，因此未來可能會調整；若發生變動，API 金鑰與本機模型仍可繼續使用。Captionary 與 OpenAI 無隸屬關係。',
        faqQ4: '使用自己的 API 金鑰大概會花多少錢？',
        faqA4:
          '取決於你挑選的服務商與模型。Captionary 做了多項省錢設計：只有你主動要求時才產生解說、查過的回答會自動快取，還能設定每日請求上限。設定頁面也會統計每個模型的請求次數與 Token 用量。',
        faqQ5: '支援學習哪些語言？',
        faqA5:
          '只要影片有該語言的字幕就能學。片語選取同樣支援中文、日文與泰文；羅馬音轉寫涵蓋中文拼音、日文假名、韓文、俄文、烏克蘭文、保加利亞文、塞爾維亞文、希臘文等。AI 助教會以你的母語回答。',
        faqQ6: '支援哪些瀏覽器與裝置？',
        faqA6: '電腦版 Chrome 瀏覽器。不支援手機與平板電腦。',
        faqQ7: 'Captionary 與 YouTube、Netflix、Apple 或 Language Reactor 有關聯嗎？',
        faqA7: '沒有。Captionary 是獨立開發的擴充功能。觀看 Netflix 與 Apple TV+ 需自備該平台的訂閱，字幕有無則視個別影片而定。',
        finalH2: '下次看影片時，直接<wbr>試試看',
        finalP: '簡短的設定引導會詢問你想學的語言，並幫你連接 AI 助教（也可以先略過）。',
        ctaFooter: '免費加到 Chrome',
      },
      privacyPage: {
        h1: 'Captionary 隱私權<wbr>政策',
        updated: '最後更新日期：2026 年 10 月 18 日。',
        intro: 'Captionary 協助你透過影片字幕與閱讀材料學習外語。本政策說明擴充功能如何處理這些材料、你的學習資料以及選用的 AI 請求。',
        storedH2: '儲存在<wbr>瀏覽器中的<wbr>資料',
        storedP1:
          'Captionary 會將設定、語言偏好、儲存的單字與片語、筆記、例句前後文、來源標題與網址、影片時間戳記、已設定的 AI 服務以及本機用量計數器儲存在瀏覽器的擴充功能本機儲存空間（extension storage）中。它也可能會在本機快取 AI 回答與已下載的詞頻列表。匯入的閱讀材料與側邊欄上下文會透過瀏覽器的工作階段儲存空間（session storage）在擴充功能頁面之間傳遞。閱讀器也會在本機儲存空間保留你最後開啟的文件（標題、網址、語言與內文），方便你隨時返回繼續閱讀；開啟另一份文件時會將其取代。',
        storedP2:
          '各服務商的 API 金鑰會單獨儲存在擴充功能的本機儲存空間中，不會包含在匯出的設定檔裡，僅在需要驗證請求時傳送給你所設定的服務商。一般網頁無法讀取擴充功能儲存空間，但本機儲存空間並非加密憑證保險箱，請妥善保護你的瀏覽器設定檔與裝置。',
        storedP3:
          'Captionary 不使用 Chrome 同步功能（Chrome Sync）同步上述資料。目前版本的擴充功能不包含由開發者營運的帳號服務、分析統計 SDK 或廣告整合。',
        contentH2: '影片<wbr>與閱讀內容',
        contentP1:
          '在支援的影音網站上，Captionary 會讀取字幕軌道與播放資訊，以顯示字幕、查詢字詞並提供學習控制功能。當你主動在閱讀器中開啟某個網頁時，它會讀取所選取或可擷取的頁面文字、標題、網址與語言。它不會讀取 Chrome 的瀏覽紀錄資料庫。來源資訊可能會隨你儲存的單字或匯入的閱讀材料一併保留。',
        contentP2:
          '本機影片與文字檔會在閱讀器或本機影片功能中開啟。Captionary 在播放過程中不會上傳你的影片檔案。若你針對本機檔案中的文字或字幕使用雲端 AI 功能，該段文字會傳送至你所設定的 AI 服務。',
        requestsH2: '對其他服務<wbr>發出的請求',
        requestsLi1: '影音平台及其字幕主機會收到取得你所學習之字幕所需的連線請求。',
        requestsLi2: '維基詞典（Wiktionary）查詢預設為開啟。開啟期間，你查詢的單字或片語會傳送至 Wiktionary 以取得定義。',
        requestsLi3: '啟用詞頻顏色標示時，Captionary 會從託管於 GitHub 的資料集下載對應語言的詞頻清單。',
        requestsLi4: '當你點選外部字典或搜尋連結時，瀏覽器會開啟所選服務並將查詢字詞帶入網址中。',
        requestsLi5: '發音功能使用瀏覽器的語音合成（speech-synthesis）語音。部分語音可能會透過線上服務處理，具體取決於所選語音與瀏覽器。',
        requestsP: '這些外部服務可能會收到一般網路資訊（例如你的 IP 位址），並適用各自的隱私權政策。',
        aiH2: '選用的 AI 功能',
        aiP1: '預設不會設定任何雲端 AI 服務商。若你自行新增服務商並使用 AI 功能，Captionary 會將相關的單字、片語、句子、字幕文字、提示詞或對話傳送給該服務商。請求中也可能包含你選擇的語言與學習程度。視任務類型與你的隱私設定而定，請求可能包含鄰近的字幕行、現有翻譯或媒體標題。標題分享預設為開啟；在閱讀器中，標題即為網頁標題。「劇中」分頁預設為關閉；若你開啟它，並在影片中為某個人名或專有名詞打開它，該次請求還會附上本集提到它的字幕行（除非你選擇不防雷，否則只包含播放到目前位置之前的台詞）。延伸提問對話會包含近期對話紀錄；字幕翻譯則會分批傳送字幕行。',
        aiP2: '若你選擇了備援服務商（fallback provider），當主服務商無法回答請求時（例如服務中斷、達到速率限制或用量上限），該請求會以相同內容改送往備援服務商。',
        aiP3: '當你新增 AI 服務時，Captionary 會向 Chrome 請求存取該服務商網站的權限，並在你移除該服務時歸還權限（除非已設定的另一個服務也使用同一個網站）。',
        aiP4: '完成設定後，選用的自動解說或 AI 字幕翻譯會在你使用這些功能時發出請求。在學習私人材料前請先檢視你的設定；除非你有意為之，否則請避免將敏感個人資訊傳送給服務商。',
        aiP5: '你可以更改解說的前後文範圍與標題分享設定、改選其他服務商、停用自動解說，或改用本機 AI 服務。受支援的 Chrome 裝置端 AI 與翻譯會在你的裝置上處理支援的任務（但初次設定可能需要下載模型或語言包）。localhost 服務商會透過你設定的本機服務執行；該服務是否會發出進一步的網路請求，取決於其自身的設定。',
        aiP6: '各雲端服務商自行控制其資料保留、模型訓練、帳號與計費方式。Captionary 無法刪除服務商已經收到的資料。請參閱該服務商的政策與帳號控制項。',
        chatgptH2: '選用的 ChatGPT 帳號登入',
        chatgptP1:
          '若你選擇使用 ChatGPT 登入，Captionary 會透過搭配 PKCE 的 OAuth 授權流程，在 auth.openai.com 開啟 OpenAI 的驗證頁面。它使用的是 OpenAI 為其 Codex 命令列工具公開發布的登入用戶端；OpenAI 並未針對其他應用程式公開此登入方式的文件，因此它可能會變更或停止運作。Captionary 與 OpenAI 無隸屬或合作關係，且 Captionary 絕不會看到你的 OpenAI 密碼。',
        chatgptP2:
          '登入流程會請求 openid、profile、email 與 offline_access 權限範圍。授權碼會透過登入分頁中觀察到的 localhost 回呼網址傳回，接著在 OpenAI 的權杖端點進行交換。Captionary 不會為了該回呼而啟動本機伺服器。讀取該回呼網址需要暫時存取 http://localhost 的權限；登入結束後 Captionary 會立即歸還該權限（除非你設定的本機 AI 服務也使用 localhost）。',
        chatgptP3:
          'Captionary 會將取得的存取權杖（access token）、重新整理權杖（refresh token）、到期時間、帳號／工作區識別碼，以及任何傳回的電子郵件、方案或帳號類型中繼資料，儲存在擴充功能本機儲存空間中獨立於匯出設定之外的鍵值下。權杖不會被同步，也不會包含在設定匯出檔中。電子郵件與方案可顯示於服務商設定頁面。目前的實作會透過 auth.openai.com 更新即將到期的存取權杖。',
        chatgptP4:
          '此服務商的 AI 請求與模型清單請求僅會傳送至 chatgpt.com/backend-api/codex，並在請求標頭中附帶存取權杖與帳號識別碼，同時以「originator: captionary」標頭向 OpenAI 標示 Captionary（針對 OpenAI 標記為 FedRAMP 的帳號則會附帶相應標頭）。這些請求不會附帶瀏覽器 Cookie。當你連接 ChatGPT 或測試連線時，Captionary 會發送一則簡短的測試請求（「Reply with the single word OK」），這會像一般請求一樣計入你方案的使用量。回應請求會將 store 設為 false；此請求參數並不保證 OpenAI 整體的資料保留作法。適用 OpenAI 的帳號條款、可用性、用量限制與隱私權作法。',
        chatgptP5:
          '登出會刪除本機儲存的權杖與帳號中繼資料，並保留該服務商項目及其對 chatgpt.com 與 auth.openai.com 的網站存取權，方便你再次登入。移除該服務商則會一併刪除權杖並歸還網站存取權。這兩項操作都不會呼叫伺服器端的權杖撤銷端點，也不會抹除 OpenAI 端的紀錄；若要同時在 OpenAI 端結束工作階段，請在 ChatGPT 的安全性設定中登出所有裝置。你也可以在 Chrome 中管理擴充功能的網站權限。',
        purposeH2: '資料用途<wbr>與分享',
        purposeP1:
          'Captionary 僅使用此處所述的資料來提供語言學習功能。目前的擴充功能沒有資料販售、廣告或信用評分功能，也不會將你的學習資料傳送至開發者營運的後端伺服器。資料僅會透過上述的服務請求，以及你主動選擇使用的匯出或外部連結離開你的裝置。',
        purposeP2: '從 Google API 收到的資訊之使用方式，將遵守《Chrome 線上應用程式商店使用者資料政策》（包含其中的「有限使用」規範）。',
        retentionH2: '資料保留<wbr>與你的控制權',
        retentionP1:
          '儲存的單字與設定會保留在本機儲存空間中，直到你將其刪除、重設擴充功能資料，或移除瀏覽器設定檔或擴充功能為止。快取的 AI 回答具有可設定的保留期限，並可在設定中清除。下載的詞頻資料可能會保留在本機快取中。本機用量計數器可以重設。',
        retentionP2:
          '「設定 → 資料與備份」底下的「刪除所有資料」會移除設定、儲存的單字、AI 服務商連線、API 金鑰、ChatGPT 登入權杖、閱讀器最後開啟的文件、快取的 AI 回答以及下載的詞頻清單，並歸還授予 AI 服務的網站存取權。',
        retentionP3:
          '你可以刪除個別單字項目、移除 AI 服務商連線及其儲存的金鑰、清除快取的 AI 回答，以及使用擴充功能的資料重設控制項。在重設或解除安裝前，請先匯出任何你想保留的學習資料。匯出的檔案由你自行控管，擴充功能不會自動刪除。移除本機資料並不會移除第三方服務已經收到的資料。',
        contactH2: '政策變更<wbr>與聯絡方式',
        contactP1: '當 Captionary 的資料處理作法變更時，我們會更新本政策，並修訂上方的更新日期。',
        contactP2: '公開支援聯絡管道：<a href="https://github.com/mxggle/captionary/issues">github.com/mxggle/captionary/issues</a>。',
      },
    },
    ja: {
      indexTitle: 'Captionary：YouTube、Netflix、Apple TV+ の動画で語学学習',
      indexDesc:
        '日英などの二言語字幕、フレーズ単位の辞書検索、選べる AI チューター（ChatGPT プラン、自分の API キー、ローカルモデル）を備えた無料の Chrome 拡張機能。',
      ogTitle: 'Captionary：見ている動画のフレーズをまるごと調べる',
      ogDesc:
        'YouTube・Netflix・Apple TV+ の二言語字幕、熟語・フレーズ検索、ChatGPT や独自 API キー、ローカルモデルで動く AI チューター。無料。',
      privacyTitle: 'プライバシーポリシー · Captionary',
      privacyDesc: 'Captionary Chrome 拡張機能における字幕データ、学習データ、および任意の AI リクエストの取り扱いについて。',
      common: {
        skip: '本文へスキップ',
        brandAria: 'Captionary ホーム',
        navAria: 'セクション',
        navPhrases: 'フレーズ検索',
        navAi: 'AI チューター',
        navCompare: 'Language Reactor との比較',
        navFaq: 'よくある質問',
        langAria: '表示言語',
        ctaHeader: 'Chrome に追加',
        footLinks:
          'Captionary · <a href="https://github.com/mxggle/captionary">GitHub のソースコード</a> · <a href="https://github.com/mxggle/captionary/issues">問題を報告</a> · <a href="privacy.html" data-preserve-lang>プライバシー</a>',
        footFine:
          'Captionary は独立した拡張機能であり、YouTube、Netflix、Apple、または Dioco（Language Reactor）とは提携・関係していません。製品名は各所有者の商標です。',
      },
      index: {
        heroH1: '動画の中の<wbr><mark class="hl">フレーズを<wbr>まるごと</mark><wbr>調べる。',
        heroLead:
          'Captionary は YouTube、Netflix、Apple TV+ 対応の無料 Chrome 拡張機能です。元の字幕の下に翻訳を表示し、単語をクリックするかフレーズをドラッグして選択すると、文脈に沿った解説を表示します。AI は契約中の ChatGPT プラン、自分の API キー、またはパソコン上のローカルモデルから自由に選べます。',
        ctaHero: 'Chrome に追加（無料）',
        ctaCompare: 'Language Reactor と比較する',
        ctaNote: 'アカウント登録は不要。保存した単語はブラウザ内に残ります。youtube.com、netflix.com、tv.apple.com で動作します。',
        phoneNote: 'Captionary はパソコン版 Chrome で動作します。インストールするにはパソコンからこのページを開いてください。',
        demoLangAria: 'デモの言語',
        demoEs: 'スペイン語',
        demoJa: '日本語',
        demoFigcaption: '実際に動かせる辞書カードのデモ（回答はサンプルです）。拡張機能では、接続した AI が解説を作成します。',
        phrasesH2: 'フレーズに<wbr>なって<wbr>初めて<wbr>生まれる<wbr>意味がある',
        phrasesP:
          'スペイン語の <i lang="es">cuenta</i> を単体で引くと「お会計・勘定」と出ます。しかし <i lang="es">se dio cuenta</i> の中では「気づいた」という意味になり、1語ずつ調べてもその意味には辿り着けません。句動詞やイディオム、決まり文句はどの言語でも同じ仕組みです。',
        phrasesLi1: '複数の単語をドラッグして選択するか、1つクリックしてから Shift+クリックで範囲を選べます。',
        phrasesLi2:
          'AI チューターを接続していれば、単語を1つクリックしただけでもその語を含む熟語を提案します。もう一度クリックすればフレーズ全体の解説に切り替わります。',
        phrasesLi3:
          'フレーズは辞書形（原形）で保存されます。<i lang="es">Se dio cuenta</i> は単語帳に <i lang="es">darse cuenta</i> として登録されます。',
        phrasesLi4: '中国語、日本語、タイ語のように単語がスペースで区切られない言語でもそのまま使えます。',
        glossAria: '単語ごとの直訳とフレーズとしての意味の比較',
        glossDt1: '単語ごと',
        glossDd1: '彼自身に · 与えた · 勘定',
        glossDt2: 'フレーズ全体',
        glossDd2: '<b lang="es">darse cuenta</b> · 気づく',
        aiH2: 'すでに<wbr>使っている AI&nbsp;を<wbr>そのまま<wbr>持ち込む',
        aiP: 'Captionary は独自の AI クレジットを販売したり、特定のモデルに縛ったりしません。手持ちのサービスをつないで、いつでも好きな時に切り替えられます。',
        aiDt1: 'ChatGPT でサインイン',
        aiDd1:
          '契約中の ChatGPT Plus、Pro、または Business プランをそのまま使えます。API キーも追加料金も不要で、リクエストはプランの Codex 利用枠にカウントされます。',
        aiDt2: '自分の API キーを使う',
        aiDd2:
          'OpenAI、Anthropic (Claude)、Google Gemini、OpenRouter、DeepSeek、Groq、Mistral、xAI、または OpenAI 互換の任意のエンドポイントに対応。各プロバイダーの公式料金で直接支払う仕組みです。',
        aiDt3: '自分のパソコン上で動かす',
        aiDd3: 'Ollama、LM Studio、または Chrome 内蔵の Gemini Nano に対応。データが外部に送信されることはありません。',
        aiSmall:
          '用途ごとにモデルを使い分けられます。単語検索には速くて安いモデルを、文構造の解説には高性能なモデルを割り当てたり、障害やレート制限に備えて予備のプロバイダーを設定したりできます。回答はキャッシュされ、使いすぎを防ぐ1日あたりの上限も設定可能です。',
        aiPanelHead: 'AI プロバイダー',
        aiProvState1: 'サインイン済み',
        aiProvState2: 'API キー ••••3f9a',
        aiProvState3: 'このパソコン上',
        aiPanelLabel: 'タスクごとのモデル設定',
        aiRouteDt1: '単語・フレーズ検索',
        aiRouteDt2: '文構造の解説',
        aiRouteDt3: '追加の質問チャット',
        aiRouteDt4: '字幕の翻訳',
        aiRouteDt5: 'エラー時の予備',
        aiRouteDd5: 'ChatGPT を試す',
        aiFigcaption: '設定例：3つのプロバイダーを登録し、用途に合わせてモデルを割り当てています。',
        wordsH2: '単語帳は<wbr>無料で、ずっと<wbr>自分の<wbr>手元に',
        wordsP:
          '単語やフレーズを「学習中」または「既知」として保存できます。Captionary は元の文、翻訳、動画のタイトル、タイムスタンプを一緒に記録します。「学習中」の語が再び現れると、字幕・字幕リスト・リーダーのどこでも点線の下線で知らせます。',
        wordsLi1: 'フラッシュカードで復習。',
        wordsLi2: 'Anki や CSV へのエクスポート、JSON でのバックアップに対応。',
        wordsLi3: 'アカウント登録もサブスクリプションも不要。単語帳はブラウザの中に保存されます。',
        wordsPanelHead: '保存した単語 <span class="panel-count">3</span>',
        wordsTagLearn1: '学習中',
        wordsMean1: '気づく、悟る',
        wordsTagLearn2: '学習中',
        wordsMean2: '気づく；<i lang="ja">気がついたら</i>（いつの間にか、ふと気づくと）',
        wordsTagKnown: '既知',
        wordsMean3: '正しい、もっともだ',
        wordsBtnReview: '復習する',
        wordsBtnAnki: 'Anki に書き出す',
        wordsFigcaption: '単語帳の例。どの項目にも出会った時のセリフがそのまま残ります。',
        compareH2: 'Captionary&nbsp;と Language Reactor&nbsp;の<wbr>比較',
        compareP:
          'Language Reactor は Netflix や YouTube で語学を学ぶための最も有名なツールで、200万人の Chrome ユーザーに愛用されている優れた拡張機能です。ここでは両者の違いをまとめました。Language Reactor に関する記述はすべて、2026年10月18日時点で公式ページと照合しています。',
        compareFeatureSr: '機能',
        compareTableAria: '比較表',
        compareR1Th: '複数の単語（フレーズ）をまとめて調べる',
        compareR1Us: '<span class="mark yes">対応</span>ドラッグ選択、または Shift+クリック',
        compareR1Lr:
          '<span class="mark no">非対応</span>1度に1語のみ。開発チームは2026年6月に「検討中」と回答しています。<a class="fn" href="#src-1" aria-label="出典 1">1</a>',
        compareR2Th: '単語・フレーズの保存',
        compareR2Us: '<span class="mark yes">無料</span>フラッシュカード、Anki・CSV エクスポートもすべて無料',
        compareR2Lr:
          '<span class="mark part">Pro 限定</span>無料版では PhrasePump の練習内でのみ利用可能<a class="fn" href="#src-2" aria-label="出典 2">2</a>',
        compareR3Th: 'AI による解説',
        compareR3Us:
          '<span class="mark yes">上限を自分で設定</span>語義の解説、文構造の分解、質問チャットに対応。プロバイダーの上限および変更可能な1日の上限（初期値300回）まで利用可能',
        compareR3Lr:
          '<span class="mark part">1日5回まで</span>Lexa AI：ログイン時は1日5問まで無料、Pro なら無制限<a class="fn" href="#src-3" aria-label="出典 3">3</a>',
        compareR4Th: 'AI モデルの選択',
        compareR4Us:
          '<span class="mark yes">対応</span>ChatGPT サインイン、8つのクラウド API キー、OpenAI 互換エンドポイント、ローカルモデルに対応',
        compareR4Lr: '<span class="mark no">非対応</span>Language Reactor 独自の AI のみ',
        compareR5Th: 'Netflix に母語字幕がない時の翻訳',
        compareR5Us: '<span class="mark yes">無料</span>Chrome のオンデバイス翻訳、または接続した AI を使用',
        compareR5Lr:
          '<span class="mark part">Pro 限定</span>機械翻訳（1日あたり約5時間分の新規コンテンツまで）<a class="fn" href="#src-4" aria-label="出典 4">4</a>',
        compareR6Th: 'Apple TV+',
        compareR6Us: '<span class="mark yes">対応</span>YouTube と Netflix にも対応',
        compareR6Lr: '<span class="mark no">非対応</span>YouTube と Netflix のみ<a class="fn" href="#src-5" aria-label="出典 5">5</a>',
        compareR7Th: 'アカウント登録',
        compareR7Us: '<span class="mark yes">不要</span>すべてのデータはブラウザ内に保存',
        compareR7Lr: '<span class="mark part">必要</span>Pro の利用、Lexa への質問、同期にはログインが必要',
        compareR8Th: '料金',
        compareR8Us: '<span class="mark yes">無料</span>有料 API を使う場合のみ、利用分をプロバイダーへ直接支払い',
        compareR8Lr:
          '<span class="mark part">フリーミアム</span>Pro は月額・3か月・年額のサブスクリプション<a class="fn" href="#src-2" aria-label="出典 2">2</a>',
        fairH3Ahead: 'Language Reactor&nbsp;が<wbr>優れている点',
        fairLi1: 'ウェブサイト版がスマートフォンやタブレットに対応しています。Captionary はデスクトップ版 Chrome 専用です。',
        fairLi2:
          '設定や保存した単語、チャット履歴がアカウントに保存され、端末間で同期されます。Captionary には同期機能がなく、JSON バックアップを手動で移動します。',
        fairLi3: 'Pro では音声認識による字幕生成に対応しており、Netflix の吹き替え音声からも字幕を作れます。',
        fairLi4: '動画・書籍・ポッドキャストのカタログや、会話パートナー Aria、ベータ版の英語コースがあります。',
        fairLi5: 'Anki エクスポートに画像と音声を含められます。Captionary が書き出すのはテキスト（語句、意味、例文）のみです。',
        fairH3Both: '両方に<wbr>備わっている<wbr>機能',
        fairPBoth:
          '二言語字幕、字幕リスト、1行ごとの自動一時停止とリピート、キーボードショートカット、読みがな・ローマ字表記、単語の出現頻度に応じた色分け、テキストリーダー、字幕ファイル付きのローカル動画再生、Anki エクスポート。',
        fairH3Pick: 'どちらを<wbr>選ぶべきか',
        fairPPick:
          'フレーズ単位で調べたい方、好きな AI を使いたい方、無料で単語帳を続けたい方には Captionary が向いています。スマホで学習する方、オンラインアカウントで単語を同期したい方、字幕のない Netflix 吹き替え作品を観る方には Language Reactor がおすすめです。',
        src1: 'Language Reactor フォーラム、2026年6月26日のスタッフ回答：<a href="https://forum.languagelearningwithnetflix.com/t/how-to-select-multiple-word-definitions/41477">How to select multiple word definitions?</a>',
        src2: '<a href="https://www.languagereactor.com/pro-mode">Language Reactor Pro ページ</a>',
        src3: '<a href="https://www.languagereactor.com/help/updates">Language Reactor 更新履歴</a>（2026年9月）',
        src4: '<a href="https://www.languagereactor.com/help/faq">Language Reactor FAQ</a>',
        src5: '<a href="https://chromewebstore.google.com/detail/language-reactor/hoombieeljmmljlkjmnheibnpciblicm">Chrome ウェブストアの Language Reactor</a>',
        compareFine:
          'Language Reactor は Dioco の製品です。Captionary は独立したプロジェクトであり、同社とは一切関係ありません。記載内容に古い情報があれば、<a href="https://github.com/mxggle/captionary/issues">Issue にてお知らせください</a>。修正いたします。',
        toolkitH2: 'その他の<wbr>機能',
        tkDt1: '各プレイヤーに馴染むデザイン',
        tkDd1:
          'Captionary のボタンは動画プレイヤー本来のコントロールバーに収まり、メニューや辞書カードもサイトの配色やフォントに合わせます。',
        tkDt2: '最適なソースから翻訳を取得',
        tkDd2:
          '公式の字幕トラックがあればそれを優先し、なければ YouTube の自動翻訳、Chrome のオンデバイス翻訳、接続した AI の順で利用します。マウスを重ねるまで翻訳をぼかすテストモードも備えています。',
        tkDt3: '字幕リスト',
        tkDd3:
          '再生に合わせて自動でスクロール。セリフの検索、任意の行へのジャンプ、コピー、二言語入りの .srt ファイルのダウンロードが可能です。',
        tkDt4: 'ローマ字・発音表記',
        tkDd4: '声調記号付きのピンイン、日本語かなのローマ字、韓国語・ロシア語・ギリシャ語などのラテン文字転写を原文字幕の下に表示します。',
        tkDt5: '1文ごとの構造解説',
        tkDd5: '<kbd>E</kbd> キーを押すと、現在のセリフの翻訳、直訳グロス、チャンク（意味の塊）分け、文法ポイントを表示します。',
        tkDt6: '学習向けの再生コントロール',
        tkDd6:
          'セリフごとの自動一時停止、リピート、前後のセリフへの移動、再生速度の変更に対応。初期設定は <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> で、すべてのキーを自由に変更できます。',
        tkDt7: '単語の頻度表示',
        tkDd7: '映画やドラマの字幕でどのくらい珍しい単語かを下線で示し、覚える価値のある単語を見分けやすくします（オン・オフ可能）。',
        tkDt8: 'テキストリーダー',
        tkDd8:
          'テキストの貼り付け、.txt / .srt / .vtt ファイルの読み込み、または任意のウェブページを右クリックして、単語をクリックして調べられるリーダーで読めます。',
        tkDt9: '手元の動画ファイル再生',
        tkDd9: 'パソコン内の動画ファイルと字幕ファイルを読み込み、動画サイトと同じオーバーレイ字幕、リスト、辞書検索を使って学習できます。',
        privacyH2: 'API&nbsp;キーも<wbr>単語帳も、あなたの<wbr>ブラウザの<wbr>中に<wbr>留まります',
        privacyP:
          'Captionary にはアカウント登録も、アクセス解析も、広告もありません。ソースコードは <a href="https://github.com/mxggle/captionary">GitHub</a> で公開されており、誰でも仕組みを確認できます。',
        privacyLi1:
          'API キーと ChatGPT のサインイントークンは、お使いのパソコン上の拡張機能ローカルストレージに保管されます。同期やエクスポートの対象にはならず、該当するサービス以外に送信されることもなく、通常のウェブページから読み取られることもありません。',
        privacyLi2:
          'AI サービスを追加する際、そのサイトへのアクセス許可を1件ずつ Chrome が確認し、サービスを削除すると Captionary は即座にアクセス権を返上します。ChatGPT サインイン時には OpenAI の認証結果を受け取るため一時的に localhost へのアクセス権を使いますが、サインイン完了後すぐに返上します。',
        privacyLi3: 'リクエストに含める文脈の範囲（単語のみ、その1文、前後の数行まで）や、動画タイトルを含めるかどうかを自分で選べます。',
        privacyLi4:
          'すべてのプロンプトで字幕テキストは信頼できない入力として区別され、AI の回答が外部画像や HTML を読み込むことはありません。',
        faqH2: 'よくある<wbr>質問',
        faqQ1: 'Captionary は本当に無料ですか？',
        faqA1:
          'はい、拡張機能自体は無料です。従量課金の有料 API を接続した場合は、使った分だけそのプロバイダーから請求されます。ChatGPT サインイン、ローカルモデル、または Chrome 内蔵 AI を使う場合は、追加の支払いは一切ありません。',
        faqQ2: 'API キーは必要ですか？',
        faqA2:
          'いいえ。二言語字幕、翻訳、内蔵辞書、単語の保存と復習はすべて AI なしで動作します。AI チューターを使う場合も、API キーの代わりに ChatGPT サインイン、ローカルモデル、Chrome 内蔵 AI を利用できます。',
        faqQ3: '「ChatGPT でサインイン」はどういう仕組みですか？',
        faqA3:
          'OpenAI の公式ページでサインインし（OpenAI の Codex CLI と同じ方式）、ご自身の ChatGPT Plus、Pro、または Business プランを利用します。リクエストはプランの Codex 利用枠にカウントされます。OpenAI はこの経路を他アプリ向けに公式文書化していないため、将来仕様が変わる可能性があります。もし使えなくなった場合でも、API キーとローカルモデルは引き続き動作します。Captionary は OpenAI と提携していません。',
        faqQ4: 'API キーを使うと費用はどのくらいかかりますか？',
        faqA4:
          '選ぶプロバイダーとモデル次第ですが、Captionary はコストを抑える設計になっています。解説は求めた時だけ生成され、一度調べた回答はキャッシュされ、1日のリクエスト上限も設定できます。設定画面ではモデルごとのリクエスト数とトークン数を確認できます。',
        faqQ5: 'どの言語に対応していますか？',
        faqA5:
          '動画に字幕がある言語ならどの言語でも学習できます。フレーズ選択は中国語・日本語・タイ語にも対応しており、ローマ字転写は中国語、日本語かな、韓国語、ロシア語、ウクライナ語、ブルガリア語、セルビア語、ギリシャ語などをカバーしています。AI チューターはあなたの母語で回答します。',
        faqQ6: '対応しているブラウザと端末は？',
        faqA6: 'デスクトップ版の Chrome です。スマートフォンやタブレットでは動作しません。',
        faqQ7: 'Captionary は YouTube、Netflix、Apple、Language Reactor と関係がありますか？',
        faqA7:
          'いいえ、Captionary は独立した拡張機能です。Netflix や Apple TV+ の視聴にはそれぞれのサブスクリプションが必要であり、字幕の有無は動画ごとに異なります。',
        finalH2: '次に観る<wbr>動画で、さっそく<wbr>試して<wbr>みませんか',
        finalP: '短いセットアップ画面で学習中の言語を選び、AI チューターを接続できます（あとで設定することも可能です）。',
        ctaFooter: 'Chrome に追加（無料）',
      },
      privacyPage: {
        h1: 'Captionary プライバシー<wbr>ポリシー',
        updated: '最終更新日：2026年10月18日',
        intro:
          'Captionary は、動画の字幕や読み物から言語を学ぶための拡張機能です。本ポリシーでは、当拡張機能がそれらの教材、学習データ、および任意の AI リクエストをどのように取り扱うかを説明します。',
        storedH2: 'ブラウザ内に<wbr>保存される<wbr>データ',
        storedP1:
          'Captionary は、設定、言語設定、保存した単語やフレーズ、メモ、文脈の例文、出典のタイトルと URL、動画のタイムスタンプ、設定済みの AI サービス、およびローカルの利用カウンターをお使いのブラウザの拡張機能ストレージ（extension storage）に保存します。また、AI の回答やダウンロードした単語頻度リストをローカルにキャッシュする場合があります。インポートした読み物やサイドパネルの文脈情報は、ブラウザのセッションストレージ（session storage）を使って拡張機能のページ間で受け渡されます。リーダー機能は、最後に開いたドキュメント（タイトル、アドレス、言語、本文）をローカルの拡張機能ストレージに保持し、いつでも続きから読めるようにします（別のドキュメントを開くと上書きされます）。',
        storedP2:
          '各プロバイダーの API キーはローカルの拡張機能ストレージに個別に保存されます。設定のエクスポートには含まれず、リクエストの認証に必要な場合にのみ設定したプロバイダーへ送信されます。通常のウェブページから拡張機能ストレージを読み取ることはできませんが、ローカルストレージは暗号化された資格情報保管庫ではありません。ブラウザのプロファイルと端末の管理にはご注意ください。',
        storedP3:
          'Captionary はこれらのデータに Chrome 同期（Chrome Sync）を使用しません。現在の拡張機能には、開発者が運営するアカウントサービス、アクセス解析 SDK、広告の組み込みはありません。',
        contentH2: '動画および<wbr>読み物の<wbr>コンテンツ',
        contentP1:
          '対応する動画サイトにおいて、Captionary は字幕トラックと再生情報を読み取り、字幕の表示、単語の検索、学習用コントロールの提供を行います。リーダーで明示的にページを開いた場合は、選択されたテキストまたは読み取り可能な本文、タイトル、URL、言語を読み取ります。Chrome の閲覧履歴データベースを読み取ることはありません。出典情報は、保存した語彙やインポートした読み物とともに保持される場合があります。',
        contentP2:
          'ローカルの動画ファイルおよびテキストファイルは、リーダー機能またはローカル動画再生機能のために開かれます。再生に伴って Captionary が動画ファイルを外部へアップロードすることはありません。ローカルファイルのテキストや字幕に対してクラウド AI を使用した場合、そのテキストは設定した AI サービスへ送信されます。',
        requestsH2: '外部サービスへの<wbr>リクエスト',
        requestsLi1: '動画プラットフォームおよびその字幕配信サーバーには、学習する字幕を取得するために必要な通信リクエストが送信されます。',
        requestsLi2:
          'Wiktionary（ウィクショナリー）検索は初期設定でオンになっています。有効な間、調べた単語やフレーズは定義を取得するため Wiktionary に送信されます。',
        requestsLi3:
          '単語の頻度による色分けを有効にすると、Captionary は GitHub 上でホストされているデータセットから該当言語の頻度リストをダウンロードします。',
        requestsLi4: '外部の辞書や検索リンクを選択した場合、検索語句を URL に含めて該当サービスを開きます。',
        requestsLi5:
          '発音の読み上げにはブラウザの音声合成（speech-synthesis）機能を使用します。一部の音声はオンラインサービスを利用する場合があり、処理方法は選択した音声とブラウザに依存します。',
        requestsP:
          'これらのサービスは IP アドレスなどの通常のネットワーク情報を受け取る可能性があり、各サービスのプライバシーポリシーが適用されます。',
        aiH2: '任意の&nbsp;AI&nbsp;機能',
        aiP1: '初期設定ではクラウド AI プロバイダーは設定されていません。プロバイダーを追加して AI 機能を使用すると、Captionary は該当する単語、フレーズ、文、字幕テキスト、プロンプト、またはチャット内容をそのプロバイダーに送信します。リクエストには選択した言語や学習レベルも含まれる場合があります。タスクの種類やプライバシー設定に応じて、前後の字幕行、既存の翻訳、メディアのタイトルが含まれることがあります。タイトルの共有は初期設定でオンになっています（リーダーではウェブページのタイトルが該当します）。「作中」タブは初期設定でオフです。オンにして動画内の人名や用語でタブを開くと、そのリクエストにはこのエピソードでその語が出てくる字幕行も含まれます（ネタバレを許可しない限り、再生位置までのセリフのみ）。追加質問チャットには直近のやり取りが含まれ、字幕翻訳では字幕行がまとめて送信されます。',
        aiP2: '予備のプロバイダー（フォールバック）を設定している場合、メインのプロバイダーが応答できないリクエスト（障害、レート制限、利用上限など）は、同じ内容のまま予備のプロバイダーへ送信されます。',
        aiP3: 'Captionary は AI サービスを追加する際にそのサイトへのアクセス許可を Chrome に求め、サービスを削除すると（別の設定済みサービスが同じサイトを使用していない限り）そのアクセス権を返上します。',
        aiP4: '設定後、任意の自動解説や AI 字幕翻訳を有効にしていると、機能の利用に伴ってリクエストが発生します。プライベートな教材で学習する前に設定をご確認ください。意図しない限り、機密性の高い個人情報をプロバイダーへ送信しないようご注意ください。',
        aiP5: '解説に含める文脈の範囲やタイトル共有の設定の変更、別のプロバイダーへの切り替え、自動解説の無効化、またはローカル AI サービスの利用が可能です。対応する Chrome のオンデバイス AI および翻訳機能は端末上でタスクを処理します（初回セットアップ時にモデルや言語パックのダウンロードが必要な場合があります）。localhost プロバイダーはご自身が設定したローカルサービス経由で動作し、さらに外部へ通信するかどうかはそのサービス側の設定に依存します。',
        aiP6: 'データの保持、モデル学習への利用、アカウント管理、課金に関する運用は各クラウドプロバイダーが管理しています。プロバイダーがすでに受け取ったデータを Captionary から削除することはできません。各プロバイダーのポリシーとアカウント設定をご確認ください。',
        chatgptH2: '任意の ChatGPT&nbsp;アカウント<wbr>サインイン',
        chatgptP1:
          'ChatGPT サインインを選択すると、Captionary は PKCE を用いた OAuth 認可フローにより auth.openai.com の OpenAI 認証ページを開きます。これには OpenAI が Codex コマンドラインツール向けに公開しているパブリッククライアントを使用します。OpenAI はこのサインイン方式を他のアプリ向けに公式文書化していないため、仕様が変更されたり動作しなくなったりする可能性があります。Captionary は OpenAI と提携・承認関係になく、OpenAI のパスワードを知ることもありません。',
        chatgptP2:
          'サインインでは openid、profile、email、offline_access のスコープを要求します。認可コードはサインインタブ内で検知される localhost のコールバック URL を通じて返され、OpenAI のトークンエンドポイントで交換されます。このコールバックのために Captionary がローカルサーバーを起動することはありません。コールバックアドレスの読み取りには http://localhost への一時的なアクセス権が必要ですが、サインインが完了すると（localhost を使うローカル AI サービスを設定していない限り）ただちにアクセス権を返上します。',
        chatgptP3:
          'Captionary は取得したアクセストークン、リフレッシュトークン、有効期限、アカウント／ワークスペース識別子、および返されたメールアドレス、プラン、アカウント種別のメタデータを、エクスポート対象の設定とは別のキーでローカル拡張機能ストレージに保存します。トークンは同期されず、設定のエクスポートにも含まれません。メールアドレスとプランはプロバイダー設定画面に表示される場合があります。現在の実装では、期限切れが近いアクセストークンを auth.openai.com 経由で更新します。',
        chatgptP4:
          'このプロバイダー向けの AI リクエストおよびモデル一覧リクエストは chatgpt.com/backend-api/codex のみに送信され、リクエストヘッダーにアクセストークンとアカウント識別子を含めます。また、「originator: captionary」ヘッダーによって Captionary からの通信であることを OpenAI に示します（OpenAI が FedRAMP アカウントとしてマークしている場合はその旨のヘッダーも付与されます）。これらのリクエストにはブラウザの Cookie は含まれません。ChatGPT の接続時や接続テスト時には、短いテストリクエスト（「Reply with the single word OK」）を1回送信し、これも他のリクエストと同様にプランの利用枠にカウントされます。応答リクエストでは store パラメータを false に設定しますが、これは OpenAI 全体のデータ保持方針を保証するものではありません。OpenAI の利用規約、可用性、利用制限、プライバシー慣行が適用されます。',
        chatgptP5:
          'サインアウトするとローカルに保存されたトークンとアカウントメタデータが削除されますが、再度サインインできるようプロバイダー項目および chatgpt.com と auth.openai.com へのアクセス権は維持されます。プロバイダー自体を削除すると、トークンが削除されると同時にサイトへのアクセス権も返上されます。いずれの操作もサーバー側のトークン失効エンドポイントを呼び出したり OpenAI 側の記録を消去したりするものではありません。OpenAI 側でもセッションを終了するには、ChatGPT のセキュリティ設定からすべての端末でログアウトしてください。Chrome の拡張機能設定からサイトのアクセス権限を管理することもできます。',
        purposeH2: 'データの<wbr>利用目的と<wbr>共有',
        purposeP1:
          'Captionary はここに記載されたデータを語学学習機能の提供のためにのみ使用します。現在の拡張機能にはデータの販売、広告、信用スコアリング機能はなく、学習データを開発者が運営するバックエンドへ送信することもありません。データが端末の外に出るのは、上記のサービスリクエスト、およびご自身で選択したエクスポートや外部リンクを利用する場合に限られます。',
        purposeP2:
          'Google API から受け取った情報の利用は、Limited Use（限定使用）の要件を含め、Chrome ウェブストアのユーザーデータポリシーに準拠します。',
        retentionH2: 'データの<wbr>保持と<wbr>管理方法',
        retentionP1:
          '保存した語彙と設定は、削除するか、拡張機能データをリセットするか、ブラウザプロファイルまたは拡張機能を削除するまでローカルストレージに残ります。キャッシュされた AI の回答には保持期間を設定でき、設定画面からいつでも消去できます。ダウンロードした単語頻度データはローカルにキャッシュとして残る場合があります。ローカルの利用カウンターもリセット可能です。',
        retentionP2:
          '「設定 → データとバックアップ」にある「すべて削除」を実行すると、設定、保存した語彙、AI プロバイダー接続、API キー、ChatGPT サインイントークン、リーダーの最終ドキュメント、AI 回答キャッシュ、ダウンロード済みの単語頻度リストがすべて削除され、AI サービス用に付与されたサイトアクセス権も返上されます。',
        retentionP3:
          '保存した語彙の個別削除、AI プロバイダー接続と保存済みキーの削除、AI 回答キャッシュの消去、データリセット機能の利用が可能です。リセットやアンインストールの前に、残しておきたい学習データはエクスポートしてください。エクスポートしたファイルはご自身の管理下に置かれ、拡張機能が自動的に削除することはありません。ローカルデータを削除しても、第三者サービスがすでに受け取ったデータは削除されません。',
        contactH2: '変更および<wbr>連絡先',
        contactP1: 'Captionary のデータ取り扱いに変更があった場合は本ポリシーを更新し、新バージョンの公開時に更新日を改訂します。',
        contactP2: '公開サポート窓口：<a href="https://github.com/mxggle/captionary/issues">github.com/mxggle/captionary/issues</a>',
      },
    },
  };

  function applyPageLanguage(lang, { updateUrl = false, persist = false } = {}) {
    const validLang = SUPPORTED.includes(lang) ? lang : 'en';
    const pack = PAGE_STRINGS[validLang] || PAGE_STRINGS.en;
    const isPrivacy = document.body.dataset.page === 'privacy';

    document.documentElement.lang = validLang;

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, validLang);
      } catch (_) {}
    }

    if (updateUrl) {
      try {
        const url = new URL(window.location.href);
        if (validLang === 'en') url.searchParams.delete('lang');
        else url.searchParams.set('lang', validLang);
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      } catch (_) {}
    }

    // Update <title> and <meta> tags
    document.title = isPrivacy ? pack.privacyTitle : pack.indexTitle;
    const setMeta = (sel, val) => {
      const el = document.querySelector(sel);
      if (el && val) el.setAttribute('content', val);
    };
    setMeta('meta[name="description"]', isPrivacy ? pack.privacyDesc : pack.indexDesc);
    setMeta('meta[property="og:title"]', isPrivacy ? pack.privacyTitle : pack.ogTitle);
    setMeta('meta[property="og:description"]', isPrivacy ? pack.privacyDesc : pack.ogDesc);

    // Each language's URL (?lang=, as in the hreflang links) is its own canonical page.
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      try {
        const url = new URL(canonical.href);
        if (validLang === 'en') url.searchParams.delete('lang');
        else url.searchParams.set('lang', validLang);
        canonical.href = url.href;
        setMeta('meta[property="og:url"]', url.href);
      } catch (_) {}
    }
    setMeta('meta[property="og:locale"]', OG_LOCALES[validLang]);
    document.querySelectorAll('meta[property="og:locale:alternate"]').forEach((el, i) => {
      el.setAttribute('content', SUPPORTED.filter((l) => l !== validLang).map((l) => OG_LOCALES[l])[i]);
    });

    const lookup = (key) => {
      if (key in pack.common) return pack.common[key];
      const pageDict = isPrivacy ? pack.privacyPage : pack.index;
      if (pageDict && key in pageDict) return pageDict[key];
      return null;
    };

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const val = lookup(el.dataset.i18n);
      if (val !== null) el.textContent = val;
    });

    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const val = lookup(el.dataset.i18nHtml);
      if (val !== null) el.innerHTML = val;
    });

    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const val = lookup(el.dataset.i18nAria);
      if (val !== null) el.setAttribute('aria-label', val);
    });

    // Update internal links that should preserve ?lang=
    document.querySelectorAll('a[data-preserve-lang]').forEach((a) => {
      const rawHref = a.getAttribute('href');
      if (!rawHref) return;
      const [baseAndQuery, hashPart] = rawHref.split('#');
      const [basePath] = baseAndQuery.split('?');
      const nextQuery = validLang === 'en' ? '' : `?lang=${encodeURIComponent(validLang)}`;
      const nextHash = hashPart ? `#${hashPart}` : '';
      a.setAttribute('href', `${basePath}${nextQuery}${nextHash}`);
    });

    // Sync language selector controls
    document.querySelectorAll('[data-site-lang-select]').forEach((sel) => {
      if (sel.value !== validLang) sel.value = validLang;
    });

    window.dispatchEvent(new CustomEvent('captionary:langchange', { detail: { lang: validLang } }));
  }

  const initialLang = detectLang();

  window.CaptionaryI18n = {
    getLang: () => (SUPPORTED.includes(document.documentElement.lang) ? document.documentElement.lang : initialLang),
    setLang: (lang) => applyPageLanguage(lang, { updateUrl: true, persist: true }),
    getDemoPack: (lang) => DEMO_TRANSLATIONS[lang] || DEMO_TRANSLATIONS.en,
  };

  function init() {
    const hasUrlParam = new URLSearchParams(window.location.search).has('lang');
    applyPageLanguage(initialLang, { updateUrl: hasUrlParam, persist: false });

    document.querySelectorAll('[data-site-lang-select]').forEach((sel) => {
      sel.addEventListener('change', (ev) => {
        applyPageLanguage(ev.target.value, { updateUrl: true, persist: true });
      });
    });
  }

  // Show a page the <head> script hid (.i18n-pending) once the text is in. DOMContentLoaded comes
  // after every deferred script, demo.js included, so the demo's own text is in by then too.
  const reveal = () => document.documentElement.classList.remove('i18n-pending');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  if (document.readyState === 'complete') reveal();
  else document.addEventListener('DOMContentLoaded', reveal);
})();
