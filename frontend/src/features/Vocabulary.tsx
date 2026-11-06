import { useEffect, useMemo, useState, type FormEvent } from "react";
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
} from "lucide-react";
import { PageTitle } from "../components/ui";
import vocabulary from "../data/ieltsVocabulary.json";
import "./vocabulary.css";

type Word = (typeof vocabulary)[number];
type Mark = "known" | "review";
type Mode = "lesson" | "dictionary";
const STORAGE_KEY = "practiceielts-vocabulary-marks-v1";

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
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(marks));
    } catch {
      // The lesson still works if browser storage is unavailable.
    }
  }, [marks]);

  const allDayWords = useMemo(() => vocabulary.filter((entry) => entry.day === day), [day]);
  const sessionWords = useMemo(
    () => reviewOnly ? allDayWords.filter((word) => marks[word.id] === "review") : allDayWords,
    [allDayWords, marks, reviewOnly],
  );
  const currentWord = sessionWords[position];
  const days = useMemo(
    () =>
      Array.from({ length: 50 }, (_, index) => {
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
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleWords = useMemo(() => vocabulary.filter((word) => {
    const matchesQuery =
      !normalizedQuery ||
      [word.word, word.translation, word.definition, word.synonyms, word.topic]
        .join(" ").toLocaleLowerCase().includes(normalizedQuery);
    return matchesQuery && (filter === "all" || marks[word.id] === filter);
  }), [filter, marks, normalizedQuery]);
  const dayInfo = days[day - 1];
  const totalKnown = Object.values(marks).filter((mark) => mark === "known").length;
  const dayKnown = allDayWords.filter((word) => marks[word.id] === "known").length;
  const dayProgress = allDayWords.length ? Math.round((dayKnown / allDayWords.length) * 100) : 0;
  const isAnswerCorrect = currentWord ? matchesTranslation(answer, currentWord.translation) : false;

  function resetQuestion() {
    setAnswer("");
    setChecked(false);
  }

  function chooseDay(number: number) {
    setDay(number);
    setPosition(0);
    setLessonStarted(false);
    setReviewOnly(false);
    setRevealed({});
    resetQuestion();
  }

  function checkAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answer.trim() || !currentWord) return;
    setChecked(true);
    setRevealed((previous) => ({ ...previous, [currentWord.id]: true }));
  }

  function rateWord(mark: Mark) {
    if (!currentWord) return;
    setMarks((previous) => ({ ...previous, [currentWord.id]: mark }));
    setPosition((index) => (reviewOnly && mark === "known" ? index : index + 1));
    resetQuestion();
  }

  function startReview() {
    setReviewOnly(true);
    setPosition(0);
    setLessonStarted(true);
    setRevealed({});
    resetQuestion();
  }

  const lessonFinished = position >= sessionWords.length;
  const reviewCount = allDayWords.filter((word) => marks[word.id] === "review").length;

  return (
    <div className="vocabulary-page">
      <PageTitle
        eyebrow="ENGLISH • O‘ZBEK"
        title="50 kunda IELTS lug‘ati"
        description="So‘zni yoddan eslang, javobingizni tekshiring va qiyinlarini qayta mashq qiling."
        action={<a className="button vocabulary-download" href="/resources/ielts-50-day-vocabulary.pdf" download><Download size={17} /> PDF nusxa</a>}
      />

      <section className="vocabulary-overview" aria-label="Lug‘atdagi umumiy holat">
        <div className="vocabulary-overview-icon"><BookOpenCheck size={23} /></div>
        <div className="vocabulary-overview-copy"><strong>{totalKnown} <span>/ 1 000</span></strong><small>Esimda deb belgilangan</small></div>
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

          <div className="vocabulary-mode-tabs" role="group" aria-label="Lug‘at rejimi">
            <button type="button" aria-pressed={mode === "lesson"} className={mode === "lesson" ? "active" : ""} onClick={() => { setMode("lesson"); setPosition(0); setLessonStarted(false); setReviewOnly(false); setRevealed({}); resetQuestion(); }}><Sparkles size={16} /> Dars: 20 ta so‘z</button>
            <button type="button" aria-pressed={mode === "dictionary"} className={mode === "dictionary" ? "active" : ""} onClick={() => setMode("dictionary")}><Search size={16} /> Lug‘atdan qidirish</button>
          </div>

          {mode === "lesson" ? (
            <>
              <div className="vocabulary-study-heading">
                <div><span className="vocabulary-kicker">{reviewOnly ? "QAYTA MASHQ" : `KUN ${String(day).padStart(2, "0")} · KUNLIK DARS`}</span><h2>{dayInfo?.topic}</h2><p>{reviewOnly ? "Qayta ko‘rish uchun belgilagan so‘zlaringiz." : "Avval tarjimani xotiradan toping, keyin javobni tekshiring."}</p></div>
                <span className="vocabulary-day-progress">{dayProgress}%</span>
              </div>
              <div className="vocabulary-progress-line"><i style={{ width: `${Math.min(100, (position / Math.max(sessionWords.length, 1)) * 100)}%` }} /></div>

              {!lessonStarted ? (
                <section className="vocabulary-start-screen">
                  <span className="vocabulary-start-icon"><BookOpenCheck size={28} /></span>
                  <span className="vocabulary-kicker">KUN {String(day).padStart(2, "0")} · IELTS VOCABULARY</span>
                  <h3>{dayInfo?.topic}</h3>
                  <p>20 ta kartochkani bittalab o‘rganing. Avval tarjimani eslang, javobingizni tekshiring, keyin keyingi kartochkaga o‘ting.</p>
                  <div className="vocabulary-start-stats"><span><strong>20</strong><small>so‘z</small></span><span><strong>{dayKnown}</strong><small>esimda</small></span><span><strong>{reviewCount}</strong><small>qayta ko‘rish</small></span></div>
                  <button type="button" className="button primary vocabulary-start-button" onClick={() => { setLessonStarted(true); setPosition(0); setReviewOnly(false); setRevealed({}); resetQuestion(); }}><Sparkles size={17} /> Darsni boshlash <ChevronRight size={17} /></button>
                  <small className="vocabulary-start-hint">Har bir kartochkadan so‘ng “Esimda qoldi” yoki “Qayta ko‘raman” deb tanlang.</small>
                </section>
              ) : lessonFinished ? (
                <section className="vocabulary-lesson-finished" aria-live="polite">
                  <span className="vocabulary-finished-icon"><Check size={27} /></span>
                  <span className="vocabulary-kicker">{reviewOnly ? "TAKRORLASH TUGALLANDI" : "BUGUNGI DARS TUGADI"}</span>
                  <h3>{reviewOnly ? "Qayta ko‘rib chiqdingiz." : "20 ta so‘zning barchasini ko‘rib chiqdingiz."}</h3>
                  <p>{reviewCount ? `${reviewCount} ta so‘zni yana bir bor mashq qilsangiz yaxshi bo‘ladi.` : "Ajoyib! Bugungi so‘zlarda qayta ko‘rish belgisi qolmadi."}</p>
                  <div className="vocabulary-finished-actions">
                    {!reviewOnly && reviewCount > 0 && <button type="button" className="button primary" onClick={startReview}><RotateCcw size={16} /> Qiyin so‘zlarni takrorlash ({reviewCount})</button>}
                    {reviewOnly ? <button type="button" className="button primary" onClick={() => { setReviewOnly(false); setPosition(0); setLessonStarted(true); setRevealed({}); resetQuestion(); }}>Darsga qaytish</button> : <button type="button" className="button" onClick={() => { setPosition(0); setLessonStarted(true); setRevealed({}); resetQuestion(); }}>Darsni yana takrorlash</button>}
                    <button type="button" className="button" onClick={() => chooseDay(Math.min(50, day + 1))} disabled={day === 50}>Keyingi kun <ChevronRight size={16} /></button>
                  </div>
                </section>
              ) : currentWord ? (
                <article key={currentWord.id} className="vocabulary-lesson-card">
                  <div className="vocabulary-lesson-card-top"><span>{reviewOnly ? "QAYTA MASHQ" : `SO‘Z ${position + 1} / ${sessionWords.length}`}</span><span>{currentWord.topic}</span></div>
                  <h3 className="vocabulary-lesson-word">{currentWord.word}</h3>
                  <p className="vocabulary-lesson-prompt">O‘zbekcha ma’nosini eslashga harakat qiling.</p>
                  {!checked && !revealed[currentWord.id] && <form className="vocabulary-answer-form" onSubmit={checkAnswer}>
                    <label htmlFor="vocabulary-answer">Tarjimasini yozing <span>(yoki javobni oching)</span></label>
                    <div className="vocabulary-answer-row"><input id="vocabulary-answer" autoComplete="off" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Masalan: egallamoq" /><button className="button primary" type="submit" disabled={!answer.trim()}>Tekshirish</button></div>
                    <button className="vocabulary-reveal-answer" type="button" onClick={() => setRevealed((previous) => ({ ...previous, [currentWord.id]: true }))}>Javobni ochish</button>
                  </form>}
                  {checked && <div className={`vocabulary-answer-feedback ${isAnswerCorrect ? "correct" : "incorrect"}`} aria-live="polite"><strong>{isAnswerCorrect ? "To‘g‘ri topdingiz!" : "Javobni birga ko‘rib chiqamiz."}</strong>{!isAnswerCorrect && <span>Berilgan tarjima: <b>{currentWord.translation}</b></span>}</div>}
                  {revealed[currentWord.id] && <div className="vocabulary-lesson-back">
                    <div className="vocabulary-lesson-translation">{currentWord.translation}</div>
                    <p><strong>Izoh</strong>{currentWord.definition}</p>
                    <p><strong>Sinonimlar</strong>{currentWord.synonyms}</p>
                    <p><strong>So‘z birikmalari</strong>{currentWord.collocations}</p>
                    <p><strong>So‘z oilasi</strong>{currentWord.wordFamily}</p>
                    <p className="vocabulary-example"><strong>Misol</strong><span>{currentWord.example}</span></p>
                  </div>}
                  {revealed[currentWord.id] && <div className="vocabulary-rate-actions"><span>Bu so‘z esingizda qoldimi?</span><div><button type="button" onClick={() => rateWord("review")}><RotateCcw size={16} /> Qayta ko‘raman</button><button type="button" className="known" onClick={() => rateWord("known")}><Check size={17} /> Esimda qoldi</button></div></div>}
                </article>
              ) : <div className="vocabulary-empty"><strong>Bu kun uchun so‘z topilmadi.</strong></div>}

              {lessonStarted && !lessonFinished && <div className="vocabulary-pager"><button type="button" disabled={position === 0} onClick={() => { setPosition((index) => Math.max(0, index - 1)); resetQuestion(); }}><ChevronLeft size={17} /> Oldingi so‘z</button><span>{position + 1} / {sessionWords.length}</span><span className="vocabulary-next-hint">Baholang, keyingi kartochka ochiladi <ChevronRight size={15} /></span></div>}
              <p className="vocabulary-source-note">Javob va eslab qolish belgisi ushbu brauzerda saqlanadi. Misollar o‘quv mashqi uchun, rasmiy IELTS savollari emas.</p>
            </>
          ) : (
            <>
              <div className="vocabulary-study-heading"><div><span className="vocabulary-kicker">50 KUN · 1 000 SO‘Z</span><h2>Lug‘atdan qidirish</h2><p>So‘z, tarjima yoki izoh bo‘yicha toping.</p></div></div>
              <div className="vocabulary-controls">
                <label className="vocabulary-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="So‘z yoki tarjimani qidiring" aria-label="Lug‘atdan so‘z qidirish" /><kbd>/</kbd></label>
                <div className="vocabulary-filters" aria-label="So‘zlar filtri">{([["all", "Hammasi"], ["review", "Takrorlash"], ["known", "Esimda"]] as const).map(([value, label]) => <button type="button" key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}{value === "review" && <span>{Object.values(marks).filter((mark) => mark === "review").length}</span>}</button>)}</div>
              </div>
              {visibleWords.length ? <div className="vocabulary-cards">{visibleWords.map((word) => <article className={`vocabulary-card ${marks[word.id] || ""}`} key={word.id}>
                <button type="button" className="vocabulary-card-reveal" onClick={() => setRevealed((previous) => ({ ...previous, [word.id]: !previous[word.id] }))} aria-expanded={Boolean(revealed[word.id])}>
                  <span className="vocabulary-word-top"><span>Kun {word.day} · #{String(word.number).padStart(2, "0")}</span>{marks[word.id] === "known" && <span className="vocabulary-known-badge"><Check size={13} /> Esimda</span>}{marks[word.id] === "review" && <span className="vocabulary-review-badge"><RotateCcw size={12} /> Takrorlash</span>}</span>
                  <strong className="vocabulary-word">{word.word}</strong><span className={revealed[word.id] ? "vocabulary-translation" : "vocabulary-tap-hint"}>{revealed[word.id] ? word.translation : "Ma’nosini ko‘rish"}</span>
                </button>
                {revealed[word.id] && <div className="vocabulary-card-details"><p><strong>Izoh</strong>{word.definition}</p><p><strong>Sinonimlar</strong>{word.synonyms}</p><p><strong>So‘z birikmalari</strong>{word.collocations}</p><p><strong>So‘z oilasi</strong>{word.wordFamily}</p><p className="vocabulary-example"><strong>Misol</strong><span>{word.example}</span></p></div>}
                <div className="vocabulary-card-actions"><button type="button" onClick={() => setMarks((previous) => ({ ...previous, [word.id]: "review" }))}><RotateCcw size={15} /> Qayta ko‘raman</button><button type="button" className="known" onClick={() => setMarks((previous) => ({ ...previous, [word.id]: "known" }))}><Check size={16} /> Esimda qoldi</button></div>
              </article>)}</div> : <div className="vocabulary-empty"><Search size={22} /><strong>So‘z topilmadi</strong><span>Boshqa qidiruv so‘zini kiriting yoki filtrni almashtiring.</span></div>}
              <p className="vocabulary-source-note">Lug‘atdagi belgilar brauzeringizda saqlanadi; rasmiy IELTS savollari emas.</p>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
