import {botProfile} from '../shared/bot-profile.js';
import {categories,questions} from '../shared/questions.js';
export async function startBot({token,allowed,store,url}){
 const api=async(method,body)=>{const res=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await res.json();if(!data.ok)throw new Error(`Telegram ${method}: ${data.description}`);return data.result};
 const markup={inline_keyboard:[[{text:'Открыть наше пространство',web_app:{url}}],[{text:'Следующий вопрос',callback_data:'next'},{text:'Категории',callback_data:'categories'}]]};
 const show=async(chat,q,category)=>api('sendMessage',{chat_id:chat,text:q?`${categories.find(c=>c.id===q.category).name}\n\n${String(q.id).padStart(3,'0')} / 667\n\n${q.text}`:'В этой категории всё обсудили. Выберите другую — впереди ещё много разговоров.',reply_markup:q?{inline_keyboard:[[{text:'Обсудили — дальше',callback_data:`mark:${q.id}:${category||''}`}],[{text:'Случайный вопрос',callback_data:`random:${q.category}`},{text:'Категории',callback_data:'categories'}],[{text:'Открыть мини-апп',web_app:{url}}]]}:markup});
 await api('setMyName',{name:botProfile.name});
 await api('setMyCommands',{commands:botProfile.commands});
 await api('setMyDescription',{description:botProfile.description});
 await api('setMyShortDescription',{short_description:botProfile.short_description});
 await api('setChatMenuButton',{menu_button:{type:'web_app',text:'Между нами',web_app:{url}}});
 let offset=0;
 async function handle(update){
 const msg=update.message; const cb=update.callback_query;const from=msg?.from||cb?.from;const chat=msg?.chat.id||cb?.message?.chat.id;
 if(!from||!chat)return;
 if(cb)await api('answerCallbackQuery',{callback_query_id:cb.id});
 if(!allowed.includes(String(from.id))){await api('sendMessage',{chat_id:chat,text:'Это личное пространство для двоих. Доступ ограничен.'});return}
 if(msg?.chat.type&&msg.chat.type!=='private')return;
 const command=msg?.text?.split(' ')[0].split('@')[0];const action=cb?.data||command;
 if(action==='/start'){await api('sendMessage',{chat_id:chat,text:'Между нами\n\n667 поводов стать ближе.\nДля тебя и Вики.\n\nНачните с простого, выберите настроение или доверьтесь случаю. Отмечайте вопросы после разговора — бот и мини-апп помнят всё вместе.\n\nЗдесь нет правильных ответов. Любой вопрос можно отложить.',reply_markup:markup});return}
 if(action==='/progress'){await api('sendMessage',{chat_id:chat,text:`Наша история\n\nОбсудили ${store.state().asked.length} из 667 вопросов.\nКаждый разговор — ещё один шаг навстречу.`,reply_markup:markup});return}
 if(action==='categories'||action==='/categories'){await api('sendMessage',{chat_id:chat,text:'О чём поговорим сегодня?',reply_markup:{inline_keyboard:categories.map(c=>[{text:c.name,callback_data:`cat:${c.id}`}])}});return}
 if(action?.startsWith('mark:')){const [,rawId,category]=action.split(':');store.mark(Number(rawId));await show(chat,store.next(category||undefined),category);return}
 if(action?.startsWith('cat:')){const category=action.split(':')[1];await show(chat,store.next(category),category);return}
 if(action==='/random'||action?.startsWith('random:')){const category=action==='/random'?undefined:action.split(':')[1];await show(chat,store.next(category,true),category);return}
 if(action==='next'||action==='/next'){const s=store.state();const q=questions.find(q=>q.id===s.current&&!s.asked.some(a=>a.id===q.id));await show(chat,q||store.next());return}
 await api('sendMessage',{chat_id:chat,text:'Выбери следующий вопрос или открой мини-апп.',reply_markup:markup});
 }
 console.log('Telegram bot started');
 while(true){try{const updates=await api('getUpdates',{offset,timeout:25,allowed_updates:['message','callback_query']});for(const u of updates){offset=u.update_id+1;try{await handle(u)}catch(e){console.error('Bot update failed:',e.message)}}}catch(e){console.error('Bot polling:',e.message);await new Promise(r=>setTimeout(r,5000))}}
}
