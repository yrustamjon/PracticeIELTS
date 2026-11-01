import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useAuth} from '../stores/auth';
import './pdfHighlights.css';
type Box={x:number;y:number;width:number;height:number};
export function PdfHighlights({path}:{path:string}){
 const user=useAuth(s=>s.user?.id);const key=`pdf-highlights-v1-${user}-${path}`;
 const [boxes,setBoxes]=useState<Box[]>([]);const [active,setActive]=useState(false);const [draft,setDraft]=useState<Box|null>(null);const [toolbar,setToolbar]=useState<Element|null>(null);const root=useRef<HTMLDivElement>(null);const start=useRef<{x:number;y:number}|null>(null);
 useEffect(()=>{setToolbar(root.current?.closest('.pdf-interactive')?.querySelector('.pdf-zoom')||null);try{const v=JSON.parse(localStorage.getItem(key)||'[]');setBoxes(Array.isArray(v)?v.filter(b=>[b.x,b.y,b.width,b.height].every(Number.isFinite)):[]);}catch{setBoxes([]);}},[key]);
 function save(v:Box[]){setBoxes(v);try{localStorage.setItem(key,JSON.stringify(v));}catch{}}
 function point(e:React.PointerEvent){const rect=root.current!.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height))};}
 return <>{toolbar&&createPortal(<div className="pdf-highlight-buttons"><button type="button" aria-pressed={active} onClick={()=>setActive(!active)}>{active?'Cancel highlight':'Highlight area'}</button><button type="button" disabled={!boxes.length} onClick={()=>save([])}>Clear page highlights</button></div>,toolbar)}<div ref={root} className={`pdf-highlights ${active?'is-drawing':''}`} aria-label="PDF highlight layer" onPointerDown={e=>{if(!active)return;e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);start.current=point(e);}} onPointerMove={e=>{if(!start.current)return;const p=point(e);setDraft({x:Math.min(p.x,start.current.x),y:Math.min(p.y,start.current.y),width:Math.abs(p.x-start.current.x),height:Math.abs(p.y-start.current.y)});}} onPointerUp={e=>{if(!start.current)return;const p=point(e);const b={x:Math.min(p.x,start.current.x),y:Math.min(p.y,start.current.y),width:Math.abs(p.x-start.current.x),height:Math.abs(p.y-start.current.y)};if(b.width>.005&&b.height>.002)save([...boxes,b]);start.current=null;setDraft(null);setActive(false);}} onPointerCancel={()=>{start.current=null;setDraft(null);setActive(false);}}>{[...boxes,...(draft?[draft]:[])].map((b,i)=><span key={i} className="pdf-saved-highlight" style={{left:`${b.x*100}%`,top:`${b.y*100}%`,width:`${b.width*100}%`,height:`${b.height*100}%`}}/>)}</div></>;
}
