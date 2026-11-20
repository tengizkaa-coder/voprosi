// Rebuild the exact deterministic pixel avatar installed on the Telegram bot.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {PNG} from 'pngjs';
const source=readFileSync('supabase/functions/bot-style/index.ts','utf8');
const start=source.indexOf('function avatar()');
const end=source.indexOf('Deno.serve(');
if(start<0||end<0)throw Error('Avatar source not found');
const {code}=transformSync(source.slice(start,end),{loader:'ts',target:'es2022'});
// Only checked-in local drawing code, no input, network or credentials.
const render=new Function('PNG',`${code}\nreturn avatar;`)(PNG);
mkdirSync('assets',{recursive:true});
writeFileSync('assets/telegram-avatar.png',render());
console.log('Rendered assets/telegram-avatar.png (512 × 512)');
