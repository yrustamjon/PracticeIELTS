import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  BookOpenCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  RotateCcw,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { PageTitle } from "../components/ui";
import vocabulary from "../data/ieltsVocabulary.json";
import "./vocabulary.css";

type Word = (typeof vocabulary)[number];
type Mark = "known" | "review";
type Mode = "lesson" | "quiz" | "dictionary";
const STORAGE_KEY = "practiceielts-vocabulary-marks-v1";
const wordsById = new Map(vocabulary.map((word) => [word.id, word]));

function readMarks(): Record<string, Mark> {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function normalizeAnswer(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[’‘`´ʻʼ]/g, "'")
    .replace(/[^\p{L}\p{N}']/gu, "")
    .trim();
}

function matchesTranslation(answer: string, translation: string) {
  const normalized = normalizeAnswer(answer);
  return Boolean(normalized) && translation.split(/;\s*/).some((part) => normalizeAnswer(part) === normalized);
}

export function Vocabulary() {
  const [day, setDay] = useState(1);
  const [mode, setMode] = useState<Mode>("lesson");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Mark>("all");
  const [marks, setMarks] = useState<Record<string, Mark>>(readMarks);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [dayMenuOpen, setDayMenuOpen] = useState(false);
  const [position, setPosition] = useState(0);
  const [lessonStarted, setLessonStarted] = useState(false);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [quizQueue, setQuizQueue] = useState<string[]>([]);
  const [quizPosition, setQuizPosition] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizAnswer, setQuizAnswer] = useState("");
  const [quizChecked, setQuizChecked] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizWrongIds, setQuizWrongIds] = useState<string[]>([]);
  const quizFeedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(marks));
    } catch {
      // Learning marks remain usable when browser storage is unavailable.
    }
  }, [marks]);

  useEffect(() => {
    if (!quizChecked) return;
    requestAnimationFrame(() => {
      quizFeedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      quizFeedbackRef.current?.focus({ preventScroll: true });
    });
  }, [quizChecked]);

  const allDayWords = useMemo(() => vocabulary.filter((entry) => entry.day === day), [day]);
  const lessonWords = useMemo(
    () => reviewOnly ? allDayWords.filter((word) => marks[word.id] === "review") : allDayWords,
    [allDayWords, marks, reviewOnly],
  );
  const currentWord = lessonWords[position];
  const learnedWords = useMemo(() => allDayWords.filter((word) => marks[word.id] === "known"), [allDayWords, marks]);
  const quizWords = quizQueue.map((id) => wordsById.get(id)).filter((word): word is Word => Boolean(word));
  const quizWord = quizWords[quizPosition];
  const visibleWords = useMemo(() => vocabulary.filter((word) => {
    const matchesQuery =
      !query.trim() ||
      [word.word, word.translation, word.definition, word.synonyms, word.topic]
        .join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    return matchesQuery && (filter === "all" || marks[word.id] === filter);
  }), [filter, marks, query]);

  const days = useMemo(
    () => Array.from({ length: 50 }, (_, index) => {
      const number = index + 1;
      const words = vocabulary.filter((entry) => entry.day === number);
      return {
        number,
        topic: words[0]?.topic || `Kun ${number}`,
        count: words.length,
        known: words.filter((word) => marks[word.id] === "known").length,
      };
    }),
    [marks],
  );
  const dayInfo = days[day - 1];
  const totalKnown = Object.values(marks).filter((mark) => mark === "known").length;
  const dayKnown = learnedWords.length;
  const dayProgress = allDayWords.length ? Math.round((dayKnown / allDayWords.length) * 100) : 0;
  const reviewCount = allDayWords.filter((word) => marks[word.id] === "review").length;
  const lessonFinished = position >= lessonWords.length;
  const quizAnswerCorrect = quizWord ? matchesTranslation(quizAnswer, quizWord.translation) : false;
  const quizFinished = quizPosition >= quizWords.length;

  function resetQuiz() {
    setQuizPosition(0);
    setQuizAnswer("");
    setQuizChecked(false);
    setQuizScore(0);
    setQuizWrongIds([]);
  }

  function chooseDay(number: number) {
    setDay(number);
    setPosition(0);
    setLessonStarted(false);
    setReviewOnly(false);
    setRevealed({});
    setQuizQueue([]);
    setQuizStarted(false);
    resetQuiz();
  }

  function rateWord(mark: Mark) {
    if (!currentWord) return;
    setMarks((previous) => ({ ...previous, [currentWord.id]: mark }));
    setPosition((index) => (reviewOnly && mark === "known" ? index : index + 1));
  }

  function startReview() {
    setReviewOnly(true);
    setPosition(0);
    setLessonStarted(true);
    setRevealed({});
  }

  function startQuiz() {
    const queue = learnedWords.map((word) => word.id);
    setQuizQueue(queue);
    setQuizStarted(true);
    setQuizPosition(0);
    setQuizAnswer("");
    setQuizChecked(false);
    setQuizScore(0);
    setQuizWrongIds([]);
  }

  function restartQuiz() {
    setQuizStarted(true);
    resetQuiz();
  }

  function checkQuizAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quizAnswer.trim() || !quizWord || quizChecked) return;
    const correct = matchesTranslation(quizAnswer, quizWord.translation);
    setQuizChecked(true);
    if (correct) setQuizScore((score) => score + 1);
    else {
      setQuizWrongIds((ids) => [...ids, quizWord.id]);
      setMarks((previous) => ({ ...previous, [quizWord.id]: "review" }));
    }
  }

  function nextQuizQuestion() {
    setQuizPosition((index) => index + 1);
    setQuizAnswer("");
    setQuizChecked(false);
  }

  const reviewTotal = Object.values(marks).filter((mark) => mark === "review").length;

  return (
    <div className="vocabulary-page">
      <PageTitle
        eyebrow="ENGLISH • O‘ZBEK"
        title="50 kunda IELTS lug‘ati"
        description="So‘zlarni o‘rganing, eslab qolganlaringizni tekshiring yoki lug‘atdan qidiring."
        action={<a className="button vocabulary-download" href="/resources/ielts-50-day-vocabulary.pdf" download><Download size={17} /> PDF nusxa</a>}
      />

      <section className="vocabulary-overview" aria-label="Lug‘atdagi umumiy holat">
        <div className="vocabulary-overview-icon"><BookOpenCheck size={23} /></div>
        <div className="vocabulary-overview-copy"><strong>{totalKnown} <span>/ 1 000</span></strong><small>Esimda qoldi deb belgilangan</small></div>
        <div className="vocabulary-overview-track" aria-label={`${Math.round(totalKnown / 10)} foiz bajarildi`}><i style={{ width: `${Math.min(100, totalKnown / 10)}%` }} /></div>
        <span className="vocabulary-overview-note"><Sparkles size={15} /> Har kuni oz-ozdan</span>
      </section>

      <div className="vocabulary-workspace">
        <aside className="vocabulary-days" aria-label="O‘quv kunlari">
          <div className="vocabulary-days-heading"><div><span>O‘QUV REJASI</span><strong>50 kunlik yo‘l</strong></div><small>{totalKnown} / 1000</small></div>
          <div className="vocabulary-day-list">
            {days.map((item) => (
              <button type="button" key={item.number} className={`vocabulary-day ${item.number === day ? "selected" : ""}`} onClick={() => chooseDay(item.number)} aria-current={item.number === day ? "step" : undefined}>
                <span className="vocabulary-day-number">{String(item.number).padStart(2, "0")}</span>
                <span className="vocabulary-day-label"><strong>{item.topic}</strong><small>{item.known}/{item.count} so‘z yodda</small></span>
                <span className="vocabulary-day-meter"><i style={{ width: `${item.count ? (item.known / item.count) * 100 : 0}%` }} /></span>
              </button>
            ))}
          </div>
        </aside>

        <main className="vocabulary-study">
          <div className="vocabulary-mobile-day">
            <button type="button" className="vocabulary-day-picker" aria-expanded={dayMenuOpen} onClick={() => setDayMenuOpen((open) => !open)}>
              <span><small>KUN {String(day).padStart(2, "0")}</small><strong>{dayInfo?.topic}</strong></span><ChevronDown size={19} />
            </button>
            {dayMenuOpen && <div className="vocabulary-day-menu">{days.map((item) => <button type="button" key={item.number} onClick={() => { chooseDay(item.number); setDayMenuOpen(false); }}>Kun {item.number} · {item.topic}</button>)}</div>}
          </div>

          <div className="vocabulary-mode-tabs" role="group" aria-label="Lug‘at bo‘limi">
            <button type="button" aria-pressed={mode === "lesson"} className={mode === "lesson" ? "active" : ""} onClick={() => { setMode("lesson"); setPosition(0); setLessonStarted(false); setReviewOnly(false); setRevealed({}); }}><BookOpenCheck size={16} /> O‘rganish</button>
            <button type="button" aria-pressed={mode === "quiz"} className={mode === "quiz" ? "active" : ""} onClick={() => { setMode("quiz"); setQuizStarted(false); setQuizQueue([]); resetQuiz(); }}><Target size={16} /> Tekshirish</button>
            <button type="button" aria-pressed={mode === "dictionary"} className={mode === "dictionary" ? "active" : ""} onClick={() => setMode("dictionary")}><Search size={16} /> Qidirish</button>
          </div>

          {mode === "lesson" ? (
            <>
              <div className="vocabulary-study-heading">
                <div><span className="vocabulary-kicker">{reviewOnly ? "QAYTA MASHQ" : `KUN ${String(day).padStart(2, "0")} · O‘RGANISH`}</span><h2>{dayInfo?.topic}</h2><p>{reviewOnly ? "Qayta ko‘rish uchun belgilagan so‘zlaringiz." : "Kartani bosing, ma’nosi va misolini ko‘rib o‘rganing."}</p></div>
                <span className="vocabulary-day-progress">{dayProgress}%</span>
              </div>
              <div className="vocabulary-progress-line"><i style={{ width: `${Math.min(100, (position / Math.max(lessonWords.length, 1)) * 100)}%` }} /></div>

              {!lessonStarted ? (
                <section className="vocabulary-start-screen">
                  <span className="vocabulary-start-icon"><BookOpenCheck size={28} /></span>
                  <span className="vocabulary-kicker">KUN {String(day).padStart(2, "0")} · IELTS VOCABULARY</span>
                  <h3>{dayInfo?.topic}</h3>
                  <p>Bugungi 20 ta kartani bittalab ko‘ring. Inglizcha so‘zni o‘qing, kartani ochib o‘zbekcha ma’nosi, izohi va misolini o‘rganing.</p>
                  <div className="vocabulary-start-stats"><span><strong>20</strong><small>so‘z</small></span><span><strong>{dayKnown}</strong><small>esimda</small></span><span><strong>{reviewCount}</strong><small>qayta ko‘rish</small></span></div>
                  <button type="button" className="button primary vocabulary-start-button" onClick={() => { setLessonStarted(true); setPosition(0); setReviewOnly(false); setRevealed({}); }}><Sparkles size={17} /> Darsni boshlash <ChevronRight size={17} /></button>
                  <small className="vocabulary-start-hint">Kartani oching, so‘ng “Esimda qoldi” yoki “Qayta ko‘raman” holatini tanlang.</small>
                </section>
              ) : lessonFinished ? (
                <section className="vocabulary-lesson-finished" aria-live="polite">
                  <span className="vocabulary-finished-icon"><Check size={27} /></span>
                  <span className="vocabulary-kicker">{reviewOnly ? "TAKRORLASH TUGALLANDI" : "BUGUNGI DARS TUGADI"}</span>
                  <h3>{reviewOnly ? "Qayta ko‘rib chiqdingiz." : "Bugungi 20 ta kartani ko‘rib chiqdingiz."}</h3>
                  <p>{reviewCount ? `${reviewCount} ta so‘zni yana bir bor ko‘rib chiqing.` : "Yangi kunni boshlashga tayyorsiz."}</p>
                  <div className="vocabulary-finished-actions">
                    {!reviewOnly && reviewCount > 0 && <button type="button" className="button primary" onClick={startReview}><RotateCcw size={16} /> Qayta ko‘rish ({reviewCount})</button>}
                    {reviewOnly ? <button type="button" className="button primary" onClick={() => { setReviewOnly(false); setPosition(0); setLessonStarted(true); setRevealed({}); }}>Darsga qaytish</button> : <button type="button" className="button" onClick={() => { setPosition(0); setLessonStarted(true); setRevealed({}); }}>Kartalarni yana ko‘rish</button>}
                    <button type="button" className="button" onClick={() => chooseDay(Math.min(50, day + 1))} disabled={day === 50}>Keyingi kun <ChevronRight size={16} /></button>
                  </div>
                </section>
              ) : currentWord ? (
                <article key={currentWord.id} className="vocabulary-lesson-card">
                  <div className="vocabulary-lesson-card-top"><span>{reviewOnly ? "QAYTA MASHQ" : `SO‘Z ${position + 1} / ${lessonWords.length}`}</span><span>{currentWord.topic}</span></div>
                  <h3 className="vocabulary-lesson-word">{currentWord.word}</h3>
                  {!revealed[currentWord.id] ? (
                    <button type="button" className="vocabulary-reveal-answer" onClick={() => setRevealed((previous) => ({ ...previous, [currentWord.id]: true }))}>Tarjima va misolni ko‘rish</button>
                  ) : <div className="vocabulary-lesson-back">
                    <div className="vocabulary-lesson-translation">{currentWord.translation}</div>
                    <p><strong>Izoh</strong>{currentWord.definition}</p><p><strong>Sinonimlar</strong>{currentWord.synonyms}</p><p><strong>So‘z birikmalari</strong>{currentWord.collocations}</p><p><strong>So‘z oilasi</strong>{currentWord.wordFamily}</p><p className="vocabulary-example"><strong>Misol</strong><span>{currentWord.example}</span></p>
                  </div>}
                  {revealed[currentWord.id] && <div className="vocabulary-rate-actions"><span>Bu so‘z uchun holatni tanlang</span><div><button type="button" className={marks[currentWord.id] === "review" ? "chosen" : ""} onClick={() => rateWord("review")}><RotateCcw size={16} /> Qayta ko‘raman</button><button type="button" className={`known ${marks[currentWord.id] === "known" ? "chosen known" : ""}`} onClick={() => rateWord("known")}><Check size={17} /> Esimda qoldi</button></div></div>}
                </article>
              ) : <div className="vocabulary-empty"><strong>Bu kun uchun so‘z topilmadi.</strong></div>}

              {lessonStarted && !lessonFinished && <div className="vocabulary-pager"><button type="button" disabled={position === 0} onClick={() => setPosition((index) => Math.max(0, index - 1))}><ChevronLeft size={17} /> Oldingi</button><span>{position + 1} / {lessonWords.length}</span><button type="button" onClick={() => setPosition((index) => Math.min(lessonWords.length, index + 1))}>Keyingi <ChevronRight size={17} /></button></div>}
              <p className="vocabulary-source-note">Holatlar brauzeringizda saqlanadi. Misollar o‘quv mashqi uchun, rasmiy IELTS savollari emas.</p>
            </>
          ) : mode === "quiz" ? (
            <>
              <div className="vocabulary-study-heading"><div><span className="vocabulary-kicker">KUN {String(day).padStart(2, "0")} · TEKSHIRUV</span><h2>O‘rganganlaringizni tekshiring</h2><p>Bu sinovda faqat “Esimda qoldi” deb belgilagan so‘zlaringiz chiqadi.</p></div><span className="vocabulary-day-progress">{learnedWords.length} ta</span></div>
              {!quizStarted ? (
                <section className="vocabulary-start-screen vocabulary-quiz-start">
                  <span className="vocabulary-start-icon"><Target size={28} /></span><span className="vocabulary-kicker">O‘ZINGIZNI SINAB KO‘RING</span>
                  <h3>{dayInfo?.topic}</h3>
                  {learnedWords.length ? <><p>{learnedWords.length} ta o‘rgangan so‘zingizning o‘zbekcha ma’nosini eslab yozing. Javobingiz darhol tekshiriladi.</p><div className="vocabulary-start-stats"><span><strong>{learnedWords.length}</strong><small>savol</small></span><span><strong>{reviewTotal}</strong><small>qayta ko‘rish</small></span></div><button type="button" className="button primary vocabulary-start-button" onClick={startQuiz}><Target size={17} /> Tekshiruvni boshlash <ChevronRight size={17} /></button></> : <><p>Bu kunda hali “Esimda qoldi” deb belgilangan so‘z yo‘q. Avval darsda so‘zlarni o‘rganib, holatini belgilang.</p><button type="button" className="button primary vocabulary-start-button" onClick={() => setMode("lesson")}><BookOpenCheck size={17} /> Darsga o‘tish</button></>}
                </section>
              ) : quizFinished ? (
                <section className="vocabulary-lesson-finished" aria-live="polite"><span className="vocabulary-finished-icon"><Check size={27} /></span><span className="vocabulary-kicker">TEKSHIRUV TUGADI</span><h3>{quizScore} / {quizWords.length} ta to‘g‘ri</h3><p>{quizWrongIds.length ? `${quizWrongIds.length} ta so‘z “Qayta ko‘raman” holatiga o‘tkazildi.` : "Ajoyib, hammasini to‘g‘ri topdingiz!"}</p><div className="vocabulary-finished-actions">{quizWrongIds.length > 0 && <button type="button" className="button primary" onClick={() => { setMode("lesson"); startReview(); }}><RotateCcw size={16} /> Xatolarni qayta o‘rganish</button>}<button type="button" className="button" onClick={restartQuiz}>Yana bir bor tekshirish</button><button type="button" className="button" onClick={() => setMode("lesson")}>Darsga qaytish</button></div></section>
              ) : quizWord ? (
                <article key={quizWord.id} className="vocabulary-lesson-card vocabulary-quiz-card">
                  <div className="vocabulary-lesson-card-top"><span>SAVOL {quizPosition + 1} / {quizWords.length}</span><span>To‘g‘ri: {quizScore}</span></div>
                  <h3 className="vocabulary-lesson-word">{quizWord.word}</h3>
                  {!quizChecked ? <form className="vocabulary-answer-form" onSubmit={checkQuizAnswer}><label htmlFor="vocabulary-quiz-answer">O‘zbekcha ma’nosini yozing</label><div className="vocabulary-answer-row"><input id="vocabulary-quiz-answer" autoComplete="off" value={quizAnswer} onChange={(event) => setQuizAnswer(event.target.value)} placeholder="Tarjimasini yozing" /><button className="button primary" type="submit" disabled={!quizAnswer.trim()}>Tekshirish</button></div></form> : <><div ref={quizFeedbackRef} tabIndex={-1} role="status" className={`vocabulary-answer-feedback ${quizAnswerCorrect ? "correct" : "incorrect"}`} aria-live="assertive"><strong>{quizAnswerCorrect ? "To‘g‘ri javob!" : "Bu safar topilmadi."}</strong><span>Javob: <b>{quizWord.translation}</b></span><small>{quizAnswerCorrect ? "So‘z yodingizda ekan." : "Bu so‘z qayta ko‘rish ro‘yxatiga qo‘shildi."}</small></div><button type="button" className="button primary vocabulary-quiz-next" onClick={nextQuizQuestion}>{quizPosition + 1 === quizWords.length ? "Natijani ko‘rish" : "Keyingi savol"} <ChevronRight size={17} /></button></>}
                </article>
              ) : null}
              <p className="vocabulary-source-note">Noto‘g‘ri javoblar “Qayta ko‘raman” ro‘yxatiga qo‘shiladi. Holatlar brauzeringizda saqlanadi.</p>
            </>
          ) : (
            <>
              <div className="vocabulary-study-heading"><div><span className="vocabulary-kicker">50 KUN · 1 000 SO‘Z</span><h2>Lug‘atdan qidirish</h2><p>So‘z, tarjima yoki izoh bo‘yicha toping.</p></div></div>
              <div className="vocabulary-controls"><label className="vocabulary-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="So‘z yoki tarjimani qidiring" aria-label="Lug‘atdan so‘z qidirish" /><kbd>/</kbd></label><div className="vocabulary-filters" aria-label="So‘zlar filtri">{([ ["all", "Hammasi"], ["review", "Takrorlash"], ["known", "Esimda"] ] as const).map(([value, label]) => <button type="button" key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}{value === "review" && <span>{reviewTotal}</span>}</button>)}</div></div>
              {visibleWords.length ? <div className="vocabulary-cards">{visibleWords.map((word) => <article className={`vocabulary-card ${marks[word.id] || ""}`} key={word.id}><button type="button" className="vocabulary-card-reveal" onClick={() => setRevealed((previous) => ({ ...previous, [word.id]: !previous[word.id] }))} aria-expanded={Boolean(revealed[word.id])}><span className="vocabulary-word-top"><span>Kun {word.day} · #{String(word.number).padStart(2, "0")}</span>{marks[word.id] === "known" && <span className="vocabulary-known-badge"><Check size={13} /> Esimda</span>}{marks[word.id] === "review" && <span className="vocabulary-review-badge"><RotateCcw size={12} /> Takrorlash</span>}</span><strong className="vocabulary-word">{word.word}</strong><span className={revealed[word.id] ? "vocabulary-translation" : "vocabulary-tap-hint"}>{revealed[word.id] ? word.translation : "Ma’nosini ko‘rish"}</span></button>{revealed[word.id] && <div className="vocabulary-card-details"><p><strong>Izoh</strong>{word.definition}</p><p><strong>Sinonimlar</strong>{word.synonyms}</p><p><strong>So‘z birikmalari</strong>{word.collocations}</p><p><strong>So‘z oilasi</strong>{word.wordFamily}</p><p className="vocabulary-example"><strong>Misol</strong><span>{word.example}</span></p></div>}<div className="vocabulary-card-actions"><button type="button" onClick={() => setMarks((previous) => ({ ...previous, [word.id]: "review" }))}><RotateCcw size={15} /> Qayta ko‘raman</button><button type="button" className="known" onClick={() => setMarks((previous) => ({ ...previous, [word.id]: "known" }))}><Check size={16} /> Esimda qoldi</button></div></article>)}</div> : <div className="vocabulary-empty"><Search size={22} /><strong>So‘z topilmadi</strong><span>Boshqa qidiruv so‘zini kiriting yoki filtrni almashtiring.</span></div>}
              <p className="vocabulary-source-note">Lug‘atdagi belgilar brauzeringizda saqlanadi; rasmiy IELTS savollari emas.</p>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
