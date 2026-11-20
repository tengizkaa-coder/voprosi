import 'dotenv/config';
import express from 'express';
import {createStore} from './store.js';
import {validateTelegram} from './auth.js';
import {startBot} from './bot.js';
const app=express();app.use(express.json({limit:'16kb'}));
const token=process.env.TELEGRAM_BOT_TOKEN;const allowed=(process.env.TELEGRAM_USER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean);
const configured=Boolean(token&&allowed.length>=1&&allowed.length<=2&&allowed.every(id=>/^\d+$/.test(id))&&process.env.APP_URL);
const store=createStore();
app.get('/api/config',(_req,res)=>res.json({shared:configured}));
app.use('/api',(req,res,next)=>{if(!configured)return res.status(503).json({error:'Telegram пока не настроен. Доступен локальный режим.'});if(!validateTelegram(req.headers['x-telegram-init-data']||'',token,allowed))return res.status(401).json({error:'Открой приложение в Telegram с разрешённого аккаунта.'});next()});
app.get('/api/progress',(_req,res)=>res.json(store.state()));
app.post('/api/progress',(req,res)=>{const {action,id}=req.body;if(!Number.isInteger(id)||id<1||id>667)return res.status(400).json({error:'Некорректный вопрос'});if(!['mark','undo','select'].includes(action))return res.status(400).json({error:'Неизвестное действие'});res.json(store[action](id))});
app.use('/api',(_req,res)=>res.status(404).json({error:'Не найдено'}));
if(process.env.NODE_ENV==='production'){app.use(express.static('dist'));app.get('*',(_req,res)=>res.sendFile(`${process.cwd()}/dist/index.html`))}else{const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true,allowedHosts:true},appType:'spa'});app.use(vite.middlewares)}
app.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Между нами → port '+(process.env.PORT||3000)));
if(configured)startBot({token,allowed,store,url:process.env.APP_URL}).catch(e=>console.error('Не удалось запустить бота:',e.message));
