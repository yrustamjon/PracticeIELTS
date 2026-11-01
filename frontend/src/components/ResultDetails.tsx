import { useState } from "react";
import "./resultDetails.css";
type Result = {number:number;group:number;correct:boolean;answer:string|string[];accepted_answers:(string|string[])[];prompt?:string;options?:{key:string;text:string}[]};
const text=(v:string|string[])=>Array.isArray(v)?v.join(", "):v||"No answer";
export function ResultDetails({results,label}:{results:Result[];label:"Part"|"Passage"}) {
  const groups=[...new Set(results.map(r=>r.group))].sort((a,b)=>a-b);
  const [selected,setSelected]=useState<number | null>(null);
  const active=selected!==null&&groups.includes(selected)?selected:groups[0];
  return <details className="result-details" onToggle={event=>{if(event.currentTarget.open)setSelected(groups[0]??null);}}>
    <summary>Batafsil <span>Answers and mistakes</span></summary>
    <nav className="result-details-tabs" aria-label={`${label} results`}>{groups.map(group=><button type="button" key={group} className={active===group?"active":""} aria-pressed={active===group} onClick={()=>setSelected(group)}>{label} {group}</button>)}</nav>
    <div className="exam-result-list">{results.filter(r=>r.group===active).map(r=><article key={r.number} className={`exam-result-row ${r.correct?"correct":"incorrect"}`} data-result-question={r.number}>
      <span>{r.number}</span><div><h3>{r.prompt||`Question ${r.number}`}</h3>{!!r.options?.length&&<ul>{r.options.map(o=><li key={o.key}>{o.key}{o.text?`. ${o.text}`:""}</li>)}</ul>}<p>Your answer: {text(r.answer)}</p><small>Correct answer: {r.accepted_answers.map(text).join(" / ")}</small></div><strong>{r.correct?"Correct":"Incorrect"}</strong>
    </article>)}</div>
  </details>;
}
