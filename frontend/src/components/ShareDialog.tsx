import { useId, useRef, type ReactNode } from "react";
import { Share2, X } from "lucide-react";
import "./shareDialog.css";
export function ShareDialog({title,children}:{title:string;children:ReactNode}) {
  const dialog=useRef<HTMLDialogElement>(null);const trigger=useRef<HTMLButtonElement>(null);const id=useId();
  return <><button ref={trigger} type="button" className="button secondary result-share-trigger" onClick={()=>dialog.current?.showModal()}><Share2 size={16} aria-hidden="true" />Share</button><dialog ref={dialog} className="result-share-dialog" aria-labelledby={id} onClose={()=>trigger.current?.focus()} onClick={event=>{if(event.target===dialog.current){const rect=dialog.current.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.current.close();}}}><header><span className="result-share-icon"><Share2 size={21} aria-hidden="true" /></span><button className="button subtle" type="button" aria-label="Close share dialog" onClick={()=>dialog.current?.close()}><X size={19} aria-hidden="true" /></button></header><h2 id={id}>{title}</h2><section className="mock-share-panel">{children}</section></dialog></>;
}
