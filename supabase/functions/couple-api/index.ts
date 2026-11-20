// Production: one authenticated API and Telegram webhook, backed by Postgres.
// verify_jwt=false is intentional: Telegram initData/webhook secret are verified here.
const env=(key)=>Deno.env.get(key)||'';
const root=env('SUPABASE_URL')+'/rest/v1/';
const dbHeaders={'apikey':env('SUPABASE_SERVICE_ROLE_KEY'),'Authorization':'Bearer '+env('SUPABASE_SERVICE_ROLE_KEY'),'Content-Type':'application/json'};
const allowed=()=>env('TELEGRAM_USER_IDS').split(',').map(x=>x.trim()).filter(x=>/^\d+$/.test(x));
const equal=(a,b)=>{if(!a||!b||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0};
async function db(path,body,method=body===undefined?'GET':'POST',extra={}){
 const r=await fetch(root+path,{method,headers:{...dbHeaders,...extra},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});
 const text=await r.text();let result;try{result=text?JSON.parse(text):null}catch{throw Error('DATABASE_ERROR')}
 if(!r.ok){const known=['STALE_GENERATION','INVALID_RESET_TOKEN','INVALID_QUESTION','INVALID_ACTION','INVALID_CATEGORY'];throw Error(known.find(k=>result?.message?.includes(k))||'DATABASE_ERROR')}
 return result;
}
const rpc=(name,body)=>db('rpc/'+name,body);
async function action(actor,name,data={}){return await rpc('couple_action',{p_action:name,p_actor:String(actor),p_id:data.id??null,p_category:data.category||null,p_random:!!data.random,p_generation:data.generation??null,p_confirmation:data.confirmation||null})}
async function telegram(method,body){
 const r=await fetch('https://api.telegram.org/bot'+env('TELEGRAM_BOT_TOKEN')+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});const data=await r.json();if(!data.ok)throw Error('TELEGRAM_'+String(data.error_code));return data.result;
}
async function telegramUser(raw){
 try{
  if(!raw||raw.length>16000)return null;
  const params=new URLSearchParams(raw),hash=params.get('hash');params.delete('hash');if(!hash||!/^[a-f0-9]{64}$/.test(hash))return null;
  const check=[...params.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join('\n');
  const enc=new TextEncoder();
  async function hmac(key,value){const k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(value)))}
  const secret=await hmac(enc.encode('WebAppData'),env('TELEGRAM_BOT_TOKEN'));
  const expected=[...await hmac(secret,check)].map(v=>v.toString(16).padStart(2,'0')).join('');if(!equal(hash,expected))return null;
  const age=Date.now()/1000-Number(params.get('auth_date'));if(!Number.isFinite(age)||age< -30||age>86400)return null;
  const user=JSON.parse(params.get('user')||'null');return user&&allowed().includes(String(user.id))?user:null;
 }catch{return null}
}
const escape=(s)=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const menu=()=>({inline_keyboard:[[{text:'Открыть наше пространство',web_app:{url:env('APP_URL')}}],[{text:'Продолжить разговор',callback_data:'resume'},{text:'Категории',callback_data:'categories'}],[{text:'Наша история',callback_data:'progress'},{text:'Reset',callback_data:'reset_request'}]]});
const send=(chat,text,reply_markup=menu())=>telegram('sendMessage',{chat_id:chat,text,parse_mode:'HTML',reply_markup});
async function question(chat,state,category){
 if(state.exhausted||state.asked.length===667)return send(chat,state.asked.length===667?'<b>667 разговоров позади.</b>\n\nИ целая жизнь, чтобы продолжать узнавать друг друга. Ваша история сохранена.':'<b>В этой категории всё обсудили.</b>\n\nВыберите другую — впереди ещё много разговоров.');
 const [q]=await db('couple_questions?id=eq.'+state.current+'&select=*');if(!q)throw Error('DATABASE_ERROR');
 const [cat]=await db('couple_categories?id=eq.'+encodeURIComponent(q.category)+'&select=name');
 const suffix=state.generation+':'+(category||'');
 return send(chat,`<b>${escape(cat.name)}</b>\n<code>${String(q.id).padStart(3,'0')} / 667</code>\n\n${escape(q.text)}\n\n<i>Не спешите. Главное — услышать друг друга.</i>`,{inline_keyboard:[[{text:'Обсудили — дальше',callback_data:`mark:${q.id}:${suffix}`}],[{text:'Случайный вопрос',callback_data:`random:${suffix}`},{text:'Категории',callback_data:'categories'}],[{text:'Открыть мини-апп',web_app:{url:env('APP_URL')}}]]});
}
async function processUpdate(update){
 const msg=update.message,cb=update.callback_query,from=msg?.from||cb?.from,chat=msg?.chat||cb?.message?.chat;
 if(!from||!chat||chat.type!=='private')return;
 if(cb)await telegram('answerCallbackQuery',{callback_query_id:cb.id}).catch(()=>{});
 if(!allowed().includes(String(from.id))){await send(chat.id,'Это личное пространство для двоих. Доступ ограничен.',{inline_keyboard:[]});return}
 const command=msg?.text?.split(' ')[0]?.split('@')[0];const value=cb?.data||command;
 let state=await action(from.id,'state');
 try{
  if(value==='/start')return await send(chat.id,'<b>между нами</b>\n<i>667 поводов стать ближе</i>\n\nДля тебя и Вики. Для вечеров без спешки и разговоров по-настоящему.\n\nНачните с простого, выберите настроение или доверьтесь случаю. После разговора нажмите <b>«Обсудили»</b> — вопрос больше не повторится ни здесь, ни в мини-аппе.\n\n<blockquote>Нет правильных ответов. Есть только вы — настоящие.</blockquote>');
  if(value==='/categories'||value==='categories'){
   const cats=await db('couple_categories?select=id,name&order=level');
   return await send(chat.id,'<b>О чём поговорим сегодня?</b>\n\nОт маленьких привычек до больших чувств.\nЛюбую тему можно отложить.',{inline_keyboard:[...cats.map(c=>[{text:c.name,callback_data:'category:'+c.id+':'+state.generation}]),[{text:'Открыть мини-апп',web_app:{url:env('APP_URL')}}]]});
  }
  if(value==='/progress'||value==='progress')return await send(chat.id,`<b>Наша история</b>\n\nОбсудили <b>${state.asked.length} из 667</b> вопросов.\nЕщё ${667-state.asked.length} поводов узнать друг друга чуть лучше.\n\n<i>Бот и мини-апп помнят один общий путь.</i>`);
  if(value==='/reset'||value==='reset_request'){
   state=await action(from.id,'reset_request',{generation:state.generation});
   return await send(chat.id,'<b>Начать нашу историю заново?</b>\n\nReset удалит все отметки «Обсудили» и вернёт к вопросу № 1 — <b>и в боте, и в мини-аппе</b>. Все 667 вопросов снова станут незаданными.\n\nОтменить сброс нельзя. Подтверждение действует 5 минут.',{inline_keyboard:[[{text:'Да, сбросить всё',callback_data:'reset:'+state.reset_token+':'+state.generation}],[{text:'Нет, сохранить историю',callback_data:'cancel_reset'}]]});
  }
  if(value==='cancel_reset'){
   await db('couple_reset_tokens?actor=eq.'+from.id,undefined,'DELETE');
   if(cb)await telegram('editMessageReplyMarkup',{chat_id:chat.id,message_id:cb.message.message_id,reply_markup:{inline_keyboard:[]}}).catch(()=>{});
   return await send(chat.id,'Историю сохранили. Продолжим с того места, где остановились.');
  }
  if(value?.startsWith('reset:')){
   const [,confirmation,generation]=value.split(':');state=await action(from.id,'reset',{confirmation,generation:Number(generation)});
   if(cb)await telegram('editMessageReplyMarkup',{chat_id:chat.id,message_id:cb.message.message_id,reply_markup:{inline_keyboard:[]}}).catch(()=>{});
   return await send(chat.id,'<b>Начинаем заново.</b>\n\nПрогресс сброшен в боте и мини-аппе. Впереди — 667 новых разговоров.');
  }
  if(value?.startsWith('mark:')){const [,id,generation,category]=value.split(':');state=await action(from.id,'mark',{id:Number(id),generation:Number(generation),category});return await question(chat.id,state,category)}
  if(value?.startsWith('category:')){const [,category,generation]=value.split(':');state=await action(from.id,'next',{category,generation:Number(generation)});return await question(chat.id,state,category)}
  if(value==='/random'||value?.startsWith('random:')){const [,generation,category]=value.split(':');state=await action(from.id,'next',{random:true,category,generation:value==='/random'?state.generation:Number(generation)});return await question(chat.id,state,category)}
  if(value==='/next'||value==='resume'){state=await action(from.id,'resume',{generation:state.generation});return await question(chat.id,state)}
  return await send(chat.id,'Выберите тему разговора или откройте наше пространство.');
 }catch(e){if(['STALE_GENERATION','INVALID_RESET_TOKEN'].includes(e.message))return await send(chat.id,'Эта кнопка устарела или сброс уже выполнен. История не изменена. Нажмите «Продолжить разговор».');throw e}
}
Deno.serve(async(req)=>{
 const path=new URL(req.url).pathname.split('/').filter(Boolean).pop();
 const origin=req.headers.get('origin');const appOrigin=env('APP_URL')?new URL(env('APP_URL')).origin:'';
 const origins=[appOrigin,'https://tengizkaa-coder.github.io'];
 const cors={'Access-Control-Allow-Origin':origin&&origins.includes(origin)?origin:appOrigin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Telegram-Init-Data','Vary':'Origin','Cache-Control':'no-store'};
 const json=(body,status=200)=>Response.json(body,{status,headers:cors});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 try{
  if(path==='config'&&req.method==='GET')return json({shared:true});
  if(path==='setup'&&req.method==='POST'){
   if(!equal(req.headers.get('x-setup-secret'),env('COUPLE_SETUP_SECRET')))return json({error:'Not found'},404);
   const body=await req.json();const url=body.catalogUrl;
   if(!/^https:\/\/api\.github\.com\/repos\/tengizkaa-coder\/voprosi\/contents\/shared\/catalog\.json\?ref=[a-f0-9]{40}$/.test(url||''))return json({error:'Invalid catalogue URL'},400);
   const r=await fetch(url,{headers:{'Accept':'application/vnd.github.raw+json','User-Agent':'mezhdu-nami'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('CATALOGUE_UNAVAILABLE');const catalogue=await r.json();
   if(catalogue.questions?.length!==667||catalogue.categories?.length!==10)throw Error('INVALID_CATALOGUE');
   await db('couple_categories',catalogue.categories,'POST',{'Prefer':'resolution=merge-duplicates,return=minimal'});
   await db('couple_questions',catalogue.questions,'POST',{'Prefer':'resolution=merge-duplicates,return=minimal'});
   const base=env('SUPABASE_URL')+'/functions/v1/couple-api';
   await telegram('setChatMenuButton',{menu_button:{type:'web_app',text:'Между нами',web_app:{url:env('APP_URL')}}});
   await telegram('setMyCommands',{commands:[{command:'start',description:'Наше пространство для двоих'},{command:'next',description:'Продолжить наш разговор'},{command:'categories',description:'Выбрать настроение разговора'},{command:'random',description:'Довериться случаю'},{command:'progress',description:'Посмотреть нашу историю'},{command:'reset',description:'Начать заново — с подтверждением'}]});
   await telegram('setWebhook',{url:base+'/webhook',secret_token:env('TELEGRAM_WEBHOOK_SECRET'),allowed_updates:['message','callback_query'],drop_pending_updates:false});
   const hook=await telegram('getWebhookInfo',{});return json({ok:true,questions:667,appUrl:env('APP_URL'),webhook:hook.url,pending:hook.pending_update_count});
  }
  if(path==='webhook'&&req.method==='POST'){
   if(!equal(req.headers.get('x-telegram-bot-api-secret-token'),env('TELEGRAM_WEBHOOK_SECRET')))return json({error:'Not found'},404);
   const update=await req.json();if(!Number.isSafeInteger(update.update_id))return json({error:'Invalid update'},400);
   const claim=await rpc('couple_claim_update',{p_id:update.update_id});if(claim==='done')return json({ok:true});if(claim==='busy')return json({error:'Retry'},503);
   try{await processUpdate(update);await db('couple_updates?id=eq.'+update.update_id,{status:'done'},'PATCH');return json({ok:true})}catch{await db('couple_updates?id=eq.'+update.update_id,{started_at:'1970-01-01T00:00:00Z'},'PATCH').catch(()=>{});return json({error:'Retry'},503)}
  }
  if(path==='progress'){
   const user=await telegramUser(req.headers.get('x-telegram-init-data'));if(!user)return json({error:'Открой мини-апп из бота с разрешённого аккаунта. Если он уже открыт — закрой и запусти снова.'},401);
   if(req.method==='GET')return json(await action(user.id,'state'));
   if(req.method==='POST'){
    const body=await req.json();if(!['mark','undo','select','next','reset_request','reset'].includes(body.action))return json({error:'Неизвестное действие'},400);
    return json(await action(user.id,body.action,body));
   }
  }
  return json({error:'Not found'},404);
 }catch(e){
  const stale=['STALE_GENERATION','INVALID_RESET_TOKEN'].includes(e.message);
  return json({error:stale?'Прогресс изменился или подтверждение истекло. Обнови страницу и повтори действие.':'Не удалось выполнить действие. Попробуй ещё раз.',code:stale?e.message:'REQUEST_FAILED'},stale?409:503);
 }
});
