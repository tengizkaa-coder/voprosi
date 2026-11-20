import {useEffect,useRef,useState} from 'react';
import {questions,PROGRESS_STORAGE_VERSION} from '../shared/questions.js';
import {emptyProgress,isNewer,localAction} from './progress.js';
export const STORAGE_KEY=`between-progress-v${PROGRESS_STORAGE_VERSION}`;
const API=(import.meta.env.VITE_API_URL||'/api').replace(/\/$/,'');
const initData=()=>window.Telegram?.WebApp?.initData||'';
function readLocal(){try{const s=JSON.parse(localStorage.getItem(STORAGE_KEY));if(Array.isArray(s?.asked)&&Number.isInteger(s.current)&&s.current>=1&&s.current<=667)return s}catch{}return emptyProgress()}
export function useProgress(){
 const [status,setStatus]=useState(initData()?'loading':'demo');
 const [state,setState]=useState(()=>initData()?emptyProgress():readLocal());
 const [busy,setBusy]=useState(false),[online,setOnline]=useState(true),[notice,setNotice]=useState('');
 const ref=useRef(state),lock=useRef(false);ref.current=state;
 const shared=status==='shared';
 function accept(s,initial=false){if(!initial&&!isNewer(s,ref.current))return;const clean={asked:s.asked,current:s.current||1,generation:s.generation??0,revision:s.revision??0};ref.current=clean;setState(clean);setOnline(true)}
 const headers=()=>({'Content-Type':'application/json','X-Telegram-Init-Data':initData()});
 async function getState(){const r=await fetch(API+'/progress',{headers:headers()});const s=await r.json();if(!r.ok){if(r.status===401)setStatus('denied');throw Error(s.error||'Не удалось загрузить прогресс')}return s}
 useEffect(()=>{let alive=true;if(!initData())return;
 fetch(API+'/config').then(r=>{if(!r.ok)throw Error();return r.json()}).then(async c=>{if(!c.shared)throw Error();const s=await getState();if(alive){accept(s,true);setStatus('shared')}}).catch(()=>{if(alive)setStatus('denied')});return()=>{alive=false};
 },[]);
 useEffect(()=>{if(status==='demo')localStorage.setItem(STORAGE_KEY,JSON.stringify(state))},[state,status]);
 useEffect(()=>{if(!shared)return;let active=true;const sync=()=>{if(lock.current)return;getState().then(s=>{if(active)accept(s)}).catch(()=>{if(active)setOnline(false)})};const t=setInterval(sync,5000);window.addEventListener('focus',sync);return()=>{active=false;clearInterval(t);window.removeEventListener('focus',sync)}},[shared]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(t)},[notice]);
 async function request(action,id,extra={}){const r=await fetch(API+'/progress',{method:'POST',headers:headers(),body:JSON.stringify({action,id,generation:ref.current.generation,...extra})});const s=await r.json();if(!r.ok){if(r.status===401)setStatus('denied');if(r.status===409){const fresh=await getState();accept(fresh)}throw Error(s.error||'Не удалось сохранить. Попробуй ещё раз.')}return s}
 async function run(task){if(lock.current)return null;lock.current=true;setBusy(true);try{return await task()}catch(e){setNotice(e.message);return null}finally{lock.current=false;setBusy(false)}}
 async function mutate(action,id,extra={}){return run(async()=>{if(!['shared','demo'].includes(status))throw Error('Сначала открой приложение из бота');let s;
  if(shared)s=await request(action,id,extra);else{if(action==='next'){const done=new Set(ref.current.asked.map(a=>a.id));const pool=questions.filter(q=>!done.has(q.id)&&(!extra.category||q.category===extra.category));const q=pool[extra.random?Math.floor(Math.random()*pool.length):0];if(!q)return null;s=localAction(ref.current,'select',q.id)}else{s=localAction(ref.current,action,id);if(action==='mark'){const next=questions.find(q=>!s.asked.some(a=>a.id===q.id)&&(!extra.category||q.category===extra.category));if(next)s=localAction(s,'select',next.id)}}}
  accept(s);return s;
 })}
 async function resetAll(){return run(async()=>{let s;if(shared){const challenge=await request('reset_request');s=await request('reset',undefined,{confirmation:challenge.reset_token,generation:challenge.generation})}else s=localAction(ref.current,'reset');accept(s);setNotice('Всё с чистого листа. Привет, вопрос № 1.');return s})}
 return {state,status,shared,busy,online,notice,setNotice,mutate,resetAll};
}
