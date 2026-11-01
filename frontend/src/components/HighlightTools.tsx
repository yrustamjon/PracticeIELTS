import { useEffect, useRef, useState } from "react";
import { Highlighter, Eraser } from "lucide-react";
import "./highlightTools.css";

type Saved = {start: number; end: number};
type Registry = {set: (name: string, value: unknown) => void; delete: (name: string) => void};
// CSS highlights leave React's text nodes and answer controls untouched.
export function HighlightTools({selector, storageKey}: {selector: string; storageKey: string}) {
  const [selection, setSelection] = useState<Saved | null>(null);
  const [count, setCount] = useState(0);
  const root = useRef<Element | null>(null);
  const saved = useRef<Saved[]>([]);
  const name = useRef(`mock-${Math.random().toString(36).slice(2)}`);
  const key = `practiceielts-highlights-v1-${storageKey}`;
  function nodes() {
    const result: Text[] = [];
    if (!root.current) return result;
    const walker = document.createTreeWalker(root.current, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (!node.parentElement?.closest("input, textarea, select, button, script, style, [aria-hidden=true], .review-feedback-marker")) result.push(node);
    }
    return result;
  }
  function paint() {
    const registry = (CSS as unknown as {highlights?: Registry}).highlights;
    const Constructor = (window as unknown as {Highlight?: new (...ranges: Range[]) => unknown}).Highlight;
    if (!registry || !Constructor) return;
    const text = nodes();
    const ranges: Range[] = [];
    for (const span of saved.current) {
      let offset = 0; const range = document.createRange(); let started = false;
      for (const node of text) {
        if (!started && span.start < offset + node.length) {range.setStart(node, Math.max(0, span.start-offset)); started=true;}
        if (started && span.end <= offset+node.length) {range.setEnd(node, span.end-offset);ranges.push(range);break;}
        offset += node.length;
      }
    }
    registry.set(name.current, new Constructor(...ranges));
  }
  useEffect(() => {
    root.current = document.querySelector(selector);
    try {const value=JSON.parse(localStorage.getItem(key)||"[]");saved.current=Array.isArray(value)?value.filter(s=>Number.isInteger(s.start)&&Number.isInteger(s.end)&&s.start>=0&&s.end>s.start):[];} catch {saved.current=[];}
    setCount(saved.current.length);
    const style=document.createElement("style");style.textContent=`::highlight(${name.current}) {background-color:#ffe58a;color:#173548;}`;document.head.append(style);
    paint();
    function capture() {
      const selected=window.getSelection();
      if (!selected || selected.isCollapsed || !selected.rangeCount || !root.current) {setSelection(null);return;}
      const range=selected.getRangeAt(0);const text=nodes();
      const startNode=text.indexOf(range.startContainer as Text),endNode=text.indexOf(range.endContainer as Text);
      if(startNode<0||endNode<0){setSelection(null);return;}
      const start=text.slice(0,startNode).reduce((n,t)=>n+t.length,0)+range.startOffset;
      const end=text.slice(0,endNode).reduce((n,t)=>n+t.length,0)+range.endOffset;
      setSelection(end>start?{start,end}:null);
    }
    document.addEventListener("selectionchange",capture);
    const observer=new MutationObserver(()=>paint());
    if(root.current)observer.observe(root.current,{subtree:true,childList:true,characterData:true});
    return ()=>{observer.disconnect();document.removeEventListener("selectionchange",capture);style.remove();(CSS as unknown as {highlights?:Registry}).highlights?.delete(name.current);};
  }, [selector,key]);
  function store() {try {localStorage.setItem(key,JSON.stringify(saved.current));} catch { /* A private browser can disable storage; highlighting still works. */ }setCount(saved.current.length);paint();}
  return <div className="mock-highlight-tools" aria-label="Text highlighting">
    <span>Select passage or question text to highlight.</span>
    <button type="button" className="button secondary" disabled={!selection} onPointerDown={event=>event.preventDefault()} onMouseDown={event=>event.preventDefault()} onClick={()=>{if(selection){saved.current=[...saved.current,selection];store();window.getSelection()?.removeAllRanges();setSelection(null);}}}><Highlighter size={15} aria-hidden="true" />Highlight</button>
    <button type="button" className="button subtle" disabled={!count} onClick={()=>{saved.current=[];store();}}><Eraser size={15} aria-hidden="true" />Clear highlights</button>
    <span className="sr-only" role="status">{count} highlights saved on this device</span>
  </div>;
}
