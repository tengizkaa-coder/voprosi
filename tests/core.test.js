import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {questions,categories} from '../shared/questions.js';
import {createStore} from '../server/store.js';
import {validateTelegram} from '../server/auth.js';
test('667 unique, stable questions, ten categories, increasing depth',()=>{
 assert.equal(questions.length,667);assert.equal(new Set(questions.map(q=>q.text)).size,667);
 assert.equal(categories.length,10);questions.forEach((q,i)=>{assert.equal(q.id,i+1);assert.ok(categories.some(c=>c.id===q.category));if(i)assert.ok(q.level>=questions[i-1].level)});
});
test('both modes share asked state; duplicate marks are idempotent; undo works',()=>{
 const s=createStore(':memory:');assert.equal(s.next().id,1);s.mark(1);s.mark(1);assert.equal(s.state().asked.length,1);assert.equal(s.next('hello').id,2);assert.equal(s.next().id,2);
 for(let i=0;i<50;i++)assert.notEqual(s.next('hello',true).id,1);
 s.undo(1);assert.equal(s.next().id,1);s.close();
});
test('completed categories and completed catalogue return no next question',()=>{
 const s=createStore(':memory:');questions.filter(q=>q.category==='hello').forEach(q=>s.mark(q.id));assert.equal(s.next('hello',true),null);assert.equal(s.next().id,68);questions.forEach(q=>s.mark(q.id));assert.equal(s.next(),null);s.close();
});
test('invalid IDs never reach storage',()=>{const s=createStore(':memory:');assert.throws(()=>s.mark(668));assert.throws(()=>s.select(-1));assert.equal(s.state().asked.length,0);s.close()});
function signed({user=12,date=Math.floor(Date.now()/1000),token='test-token'}={}){const p=new URLSearchParams({auth_date:String(date),query_id:'test',user:JSON.stringify({id:user})});const check=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');const key=createHmac('sha256','WebAppData').update(token).digest();p.set('hash',createHmac('sha256',key).update(check).digest('hex'));return p.toString()}
test('Telegram signature, account allowlist and expiry are enforced',()=>{
 assert.equal(validateTelegram(signed(),'test-token',['12']).id,12);
 assert.equal(validateTelegram(signed(),'wrong-token',['12']),false);
 assert.equal(validateTelegram(signed(),'test-token',['13']),false);
 assert.equal(validateTelegram(signed({date:1}),'test-token',['12']),false);
 assert.equal(validateTelegram('hash=broken','test-token',['12']),false);
});
test('catalogue keeps 131 mature questions at the end and explicit boundaries',()=>{
 assert.equal(questions.filter(q=>q.level>=9).length,131);
 assert.ok(questions.slice(536).every(q=>q.level>=9));
 assert.ok(categories.filter(c=>c.level>=9).every(c=>c.subtitle.includes('18+')));
 assert.ok(questions.filter(q=>/\bнет\b|\bпас\b|согласи|границ|без давления|отказ/i.test(q.text)).length>10);
});

test('new-acquaintance progression starts with basics and does not assume a relationship',()=>{
 assert.equal(questions[0].text,'Какой твой любимый цвет?');
 assert.equal(questions[1].text,'Какое твоё любимое блюдо?');
 assert.equal(questions[2].text,'Какую музыку ты чаще всего слушаешь?');
 assert.ok(questions.slice(0,134).every(q=>!/секс|интим|измена|ревност|травм|предатель|наши отношения/i.test(q.text)));
 assert.ok(questions.every(q=>!/наши отношения|нашей паре|нашу ссору|наша близость|наш первый поцелуй|нашей сексуальной жизни|когда мы|первый секс со мной|тебя во мне|мой поступок/i.test(q.text)));
 assert.ok(categories.find(c=>c.id==='values').name.includes('Принципы'));
 assert.ok(categories.find(c=>c.id==='past').name.includes('границы'));
});
