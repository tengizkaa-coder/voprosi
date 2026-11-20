import test from 'node:test';
import assert from 'node:assert/strict';
import {localAction,emptyProgress,isNewer} from '../src/progress.js';
import {questions,categories} from '../shared/questions.js';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('local reset clears both modes and current, increments generation and revision',()=>{
 let s=localAction(emptyProgress(),'mark',1);s=localAction(s,'select',20);
 assert.equal(s.asked.length,1);const old=s;s=localAction(s,'reset');
 assert.deepEqual(s.asked,[]);assert.equal(s.current,1);assert.equal(s.generation,1);assert.ok(s.revision>old.revision);assert.equal(isNewer(old,s),false);
 assert.equal(localAction(s,'mark',1).asked.length,1);
});
test('deployment catalogue is identical to the shared questions',()=>{
 const c=JSON.parse(readFileSync(new URL('../shared/catalog.json',import.meta.url)));
 assert.deepEqual(c,{questions,categories});
});
test('real Postgres SQL: common progress, atomic reset, stale buttons and private tables',async()=>{
 const db=new PGlite();
 try{
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
 await db.exec(readFileSync(new URL('../supabase/migrations/202611190001_couple.sql',import.meta.url),'utf8'));
 for(const c of categories)await db.query('insert into couple_categories(id,name,level) values($1,$2,$3)',[c.id,c.name,c.level]);
 await db.query('insert into couple_questions select * from jsonb_to_recordset($1::jsonb) as q(id int,category text,text text,level int)',[JSON.stringify(questions)]);
 const act=async(action,{actor='123',id=null,category=null,random=false,generation=0,confirmation=null}={})=>(await db.query('select couple_action($1,$2,$3,$4,$5,$6,$7) as state',[action,actor,id,category,random,generation,confirmation])).rows[0].state;
 let s=await act('mark',{id:1});assert.equal(s.asked.length,1);assert.equal(s.current,2);
 s=await act('mark',{id:1});assert.equal(s.asked.length,1);assert.equal(s.current,2);
 s=await act('next',{category:'hello',random:true});assert.notEqual(s.current,1);assert.ok(s.current<=67);
 const reset=await act('reset_request');assert.ok(reset.reset_token);
 await assert.rejects(act('reset',{actor:'456',confirmation:reset.reset_token}),/INVALID_RESET_TOKEN/);
 assert.equal((await act('state')).asked.length,1);
 s=await act('reset',{confirmation:reset.reset_token});assert.equal(s.asked.length,0);assert.equal(s.current,1);assert.equal(s.generation,1);
 await assert.rejects(act('mark',{id:1,generation:0}),/STALE_GENERATION/);
 await assert.rejects(act('reset',{generation:1,confirmation:reset.reset_token}),/INVALID_RESET_TOKEN/);
 assert.equal((await act('state')).asked.length,0);
 const expired=await act('reset_request',{generation:1});
 await db.exec("update couple_reset_tokens set expires_at=now()-interval '1 second'");
 await assert.rejects(act('reset',{generation:1,confirmation:expired.reset_token}),/INVALID_RESET_TOKEN/);
 assert.equal((await db.query('select couple_claim_update(100) as result')).rows[0].result,'claimed');
 assert.equal((await db.query('select couple_claim_update(100) as result')).rows[0].result,'busy');
 await db.exec("update couple_updates set status='done' where id=100");
 assert.equal((await db.query('select couple_claim_update(100) as result')).rows[0].result,'done');
 await db.exec('set role anon');
 await assert.rejects(db.query('select * from couple_state'),/permission denied/);
 await assert.rejects(db.query('select couple_snapshot()'),/permission denied/);
 await db.exec('reset role');
 }finally{await db.close()}
});
