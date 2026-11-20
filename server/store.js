import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { questions } from '../shared/questions.js';
export function createStore(path='data/progress.sqlite') {
 if(path!==':memory:') mkdirSync('data',{recursive:true});
 const db=new DatabaseSync(path);
 db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS progress (question_id INTEGER PRIMARY KEY, asked_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
 return {
  state(){return {asked:db.prepare('SELECT question_id AS id, asked_at AS at FROM progress ORDER BY asked_at DESC').all(),current:Number(db.prepare("SELECT value FROM settings WHERE key='current'").get()?.value)||null}},
  select(id){if(!questions.some(q=>q.id===id)) throw new Error('Неизвестный вопрос'); db.prepare("INSERT INTO settings VALUES ('current',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(id));return this.state()},
  mark(id){if(!questions.some(q=>q.id===id))throw new Error('Неизвестный вопрос');db.prepare('INSERT OR IGNORE INTO progress VALUES (?,?)').run(id,new Date().toISOString());return this.state()},
  undo(id){db.prepare('DELETE FROM progress WHERE question_id=?').run(id);return this.state()},
  next(category,random=false){const done=new Set(this.state().asked.map(x=>x.id));const pool=questions.filter(q=>!done.has(q.id)&&(!category||q.category===category));const q=pool[random?Math.floor(Math.random()*pool.length):0];if(q)this.select(q.id);return q||null},
  close(){db.close()}
 };
}
