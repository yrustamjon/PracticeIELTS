import { useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { PageTitle } from "../components/ui";
import vocabulary from "../data/ieltsVocabulary.json";
import "./vocabulary.css";

type Word = (typeof vocabulary)[number];
type Mark = "known" | "review";
const STORAGE_KEY = "practiceielts-vocabulary-marks-v1";

function readMarks(): Record<string, Mark> {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function Vocabulary() {
  const [day, setDay] = useState(1);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Mark>("all");
  const [marks, setMarks] = useState<Record<string, Mark>>(readMarks);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [dayMenuOpen, setDayMenuOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(marks));
    } catch {
      // Learning cards remain usable if browser storage is unavailable.
    }
  }, [marks]);

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
  const visibleWords = useMemo(() => {
    return vocabulary.filter((word) => {
      const matchesDay = normalizedQuery ? true : word.day === day;
      const matchesQuery =
        !normalizedQuery ||
        [word.word, word.translation, word.definition, word.synonyms, word.topic]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedQuery);
      const matchesFilter = filter === "all" || marks[word.id] === filter;
      return matchesDay && matchesQuery && matchesFilter;
    });
  }, [day, filter, marks, normalizedQuery]);
  const dayInfo = days[day - 1];
  const totalKnown = Object.values(marks).filter((mark) => mark === "known").length;
  const dayProgress = dayInfo ? Math.round((dayInfo.known / dayInfo.count) * 100) : 0;

  function updateMark(word: Word, mark: Mark) {
    setMarks((previous) => ({ ...previous, [word.id]: mark }));
    setRevealed((previous) => ({ ...previous, [word.id]: true }));
  }

  return (
    <div className="vocabulary-page">
      <PageTitle
        eyebrow="ENGLISH • O‘ZBEK"
        title="50 kunda IELTS lug‘ati"
        description="Har kuni 20 ta so‘z. Ma’nosini o‘rganing, misolda ko‘ring va o‘z sur’atingizda takrorlang."
        action={
          <a
            className="button vocabulary-download"
            href="/resources/ielts-50-day-vocabulary.pdf"
            download
          >
            <Download size={17} /> PDF nusxa
          </a>
        }
      />

      <section className="vocabulary-overview" aria-label="Lug‘atdagi umumiy holat">
        <div className="vocabulary-overview-icon"><BookOpenCheck size={23} /></div>
        <div className="vocabulary-overview-copy">
          <strong>{totalKnown} <span>/ 1 000</span></strong>
          <small>O‘rganilgan so‘z</small>
        </div>
        <div className="vocabulary-overview-track" aria-label={`${Math.round(totalKnown / 10)} foiz bajarildi`}>
          <i style={{ width: `${Math.min(100, totalKnown / 10)}%` }} />
        </div>
        <span className="vocabulary-overview-note"><Sparkles size={15} /> Oz-ozdan, har kuni</span>
      </section>

      <div className="vocabulary-workspace">
        <aside className="vocabulary-days" aria-label="O‘quv kunlari">
          <div className="vocabulary-days-heading">
            <div><span>REJA</span><strong>50 kunlik yo‘l</strong></div>
            <small>{totalKnown} / 1000</small>
          </div>
          <div className="vocabulary-day-list">
            {days.map((item) => (
              <button
                type="button"
                key={item.number}
                className={`vocabulary-day ${item.number === day && !normalizedQuery ? "selected" : ""}`}
                onClick={() => { setDay(item.number); setQuery(""); setFilter("all"); }}
                aria-current={item.number === day && !normalizedQuery ? "step" : undefined}
              >
                <span className="vocabulary-day-number">{String(item.number).padStart(2, "0")}</span>
                <span className="vocabulary-day-label"><strong>{item.topic}</strong><small>{item.known}/{item.count} so‘z</small></span>
                <span className="vocabulary-day-meter"><i style={{ width: `${item.count ? (item.known / item.count) * 100 : 0}%` }} /></span>
              </button>
            ))}
          </div>
        </aside>

        <main className="vocabulary-study">
          <div className="vocabulary-mobile-day">
            <button type="button" className="vocabulary-day-picker" aria-expanded={dayMenuOpen} onClick={() => setDayMenuOpen((open) => !open)}>
              <span><small>{normalizedQuery ? "QIDIRUV NATIJALARI" : `KUN ${String(day).padStart(2, "0")}`}</small><strong>{normalizedQuery ? `${visibleWords.length} ta so‘z` : dayInfo?.topic}</strong></span>
              <ChevronDown size={19} />
            </button>
            {dayMenuOpen && <div className="vocabulary-day-menu">{days.map((item) => <button type="button" key={item.number} onClick={() => { setDay(item.number); setQuery(""); setFilter("all"); setDayMenuOpen(false); }}>Kun {item.number} · {item.topic}</button>)}</div>}
          </div>
          <div className="vocabulary-study-heading">
            <div>
              <span className="vocabulary-kicker">{normalizedQuery ? "LUG‘AT QIDIRUVI" : `KUN ${String(day).padStart(2, "0")} · ${dayInfo?.known ?? 0}/${dayInfo?.count ?? 20} O‘RGANILDI`}</span>
              <h2>{normalizedQuery ? "Topilgan so‘zlar" : dayInfo?.topic}</h2>
              {!normalizedQuery && <p>So‘zni bosing — tarjimasi, izohi va misoli ochiladi.</p>}
            </div>
            {!normalizedQuery && <span className="vocabulary-day-progress">{dayProgress}%</span>}
          </div>
          {!normalizedQuery && <div className="vocabulary-progress-line"><i style={{ width: `${dayProgress}%` }} /></div>}

          <div className="vocabulary-controls">
            <label className="vocabulary-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="So‘z yoki tarjimani qidiring" aria-label="Lug‘atdan so‘z qidirish" /><kbd>/</kbd></label>
            <div className="vocabulary-filters" aria-label="So‘zlar filtri">
              {([ ["all", "Hammasi"], ["review", "Takrorlash"], ["known", "O‘rgandim"] ] as const).map(([value, label]) => <button type="button" key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}{value === "review" && <span>{Object.values(marks).filter((mark) => mark === "review").length}</span>}</button>)}
            </div>
          </div>

          {visibleWords.length ? (
            <div className="vocabulary-cards">
              {visibleWords.map((word) => {
                const isRevealed = Boolean(revealed[word.id] || normalizedQuery);
                return (
                  <article className={`vocabulary-card ${marks[word.id] || ""}`} key={word.id}>
                    <button type="button" className="vocabulary-card-reveal" onClick={() => setRevealed((previous) => ({ ...previous, [word.id]: !previous[word.id] }))} aria-expanded={isRevealed}>
                      <span className="vocabulary-word-top"><span>#{String(word.number).padStart(2, "0")}</span>{marks[word.id] === "known" && <span className="vocabulary-known-badge"><Check size={13} /> O‘rgandim</span>}{marks[word.id] === "review" && <span className="vocabulary-review-badge"><RotateCcw size={12} /> Takrorlash</span>}</span>
                      <strong className="vocabulary-word">{word.word}</strong>
                      {isRevealed ? <span className="vocabulary-translation">{word.translation}</span> : <span className="vocabulary-tap-hint">Ma’nosini ko‘rish <ChevronRight size={14} /></span>}
                    </button>
                    {isRevealed && <div className="vocabulary-card-details">
                      <p><strong>Izoh</strong>{word.definition}</p>
                      <p><strong>Sinonimlar</strong>{word.synonyms}</p>
                      <p><strong>So‘z birikmalari</strong>{word.collocations}</p>
                      <p><strong>So‘z oilasi</strong>{word.wordFamily}</p>
                      <p className="vocabulary-example"><strong>Misol</strong><span>{word.example}</span></p>
                    </div>}
                    <div className="vocabulary-card-actions">
                      <button type="button" className={marks[word.id] === "review" ? "chosen" : ""} onClick={() => updateMark(word, "review")}><RotateCcw size={15} /> Qayta ko‘raman</button>
                      <button type="button" className={marks[word.id] === "known" ? "chosen known" : "known"} onClick={() => updateMark(word, "known")}><Check size={16} /> O‘rgandim</button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="vocabulary-empty"><Search size={22} /><strong>{filter === "review" ? "Takrorlash uchun belgilangan so‘z yo‘q" : filter === "known" ? "Bu tanlovda o‘rganilgan so‘z yo‘q" : "So‘z topilmadi"}</strong><span>Boshqa qidiruv so‘zini kiriting yoki filtrni almashtiring.</span></div>
          )}
          {!normalizedQuery && <div className="vocabulary-pager"><button type="button" disabled={day === 1} onClick={() => setDay((value) => Math.max(1, value - 1))}><ChevronLeft size={17} /> Oldingi kun</button><span>{day} / 50</span><button type="button" disabled={day === 50} onClick={() => setDay((value) => Math.min(50, value + 1))}>Keyingi kun <ChevronRight size={17} /></button></div>}
          <p className="vocabulary-source-note">Misollar ushbu o‘quv PDF’i uchun yozilgan; rasmiy IELTS savollari emas. O‘rganilgan holat brauzeringizda saqlanadi.</p>
        </main>
      </div>
    </div>
  );
}
