import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
type Result = {number: number; correct: boolean; accepted_answers: (string | string[])[]};
const ReviewContext = createContext<Result[]>([]);
export function ReviewAnswers({results,children}:{results:Result[];children:ReactNode}) {
  return <ReviewContext.Provider value={results}>{children}</ReviewContext.Provider>;
}
export function ReviewFeedback({number}:{number:number}) {
  const result=useContext(ReviewContext).find(r=>r.number===number);
  const marker=useRef<HTMLSpanElement>(null);
  const [position,setPosition]=useState<{left:number;top:number;above:boolean}|null>(null);
  const tooltipId=useId();
  useEffect(()=>{
    if(!result)return;
    const host=marker.current?.closest<HTMLElement>('.reading-answer,.native-paper-answer,.pdf-answer,.exam-question-control');
    if(!host)return;
    const previousTab=host.getAttribute('tabindex');
    host.dataset.reviewTarget=String(number);host.dataset.reviewCorrect=String(result.correct);
    if(!result.correct)host.tabIndex=0;
    function show(){
      if(!host||result?.correct)return;
      const rect=host.getBoundingClientRect();const width=Math.min(300,window.innerWidth-24);
      const left=Math.max(12,Math.min(rect.left,window.innerWidth-width-12));
      const above=rect.bottom>window.innerHeight-135&&rect.top>130;
      setPosition({left,top:above?rect.top-8:Math.min(rect.bottom+8,window.innerHeight-110),above});
    }
    const hide=()=>setPosition(null);
    const scroll=()=>{if(host?.contains(document.activeElement))show();else hide();};
    const outside=(event:PointerEvent)=>{if(!host?.contains(event.target as Node))hide();};
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape')hide();};
    host.addEventListener('pointermove',show);host.addEventListener('pointerenter',show);host.addEventListener('pointerleave',hide);
    host.addEventListener('pointerdown',show);host.addEventListener('focusin',show);host.addEventListener('focusout',hide);
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);
    window.addEventListener('scroll',scroll,true);window.addEventListener('resize',hide);
    return ()=>{host.removeEventListener('pointermove',show);host.removeEventListener('pointerenter',show);host.removeEventListener('pointerleave',hide);host.removeEventListener('pointerdown',show);host.removeEventListener('focusin',show);host.removeEventListener('focusout',hide);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);window.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',hide);delete host.dataset.reviewTarget;delete host.dataset.reviewCorrect;if(previousTab===null)host.removeAttribute('tabindex');else host.setAttribute('tabindex',previousTab);};
  },[number,result]);
  if(!result)return null;
  return <><span ref={marker} className={`review-feedback-marker ${result.correct?'correct':'incorrect'}`} data-review-answer={number}><span className="sr-only">{result.correct?'Correct':'Incorrect'} answer {number}</span></span>{position&&!result.correct&&createPortal(<div id={tooltipId} role="tooltip" className="review-answer-tooltip" style={{left:position.left,top:position.top,transform:position.above?'translateY(-100%)':undefined}}><span>Question {number} · Correct answer</span><strong>{result.accepted_answers.map(v=>Array.isArray(v)?v.join(' + '):v).join(' / ')}</strong></div>,document.body)}</>;
}
