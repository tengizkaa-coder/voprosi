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
// The Mini App gets a transparent sprite, without the Telegram avatar's sky.
const sprite=PNG.sync.read(Buffer.from(render()));
for(let y=0;y<512;y++)for(let x=0;x<512;x++){
 const i=(y*512+x)*4,t=(Math.floor(x/8)+Math.floor(y/8))/126;
 const background=[240,227,249].map((v,n)=>Math.round(v+([252,224,236][n]-v)*t));
 const rgb=[sprite.data[i],sprite.data[i+1],sprite.data[i+2]];
 const same=background.every((v,n)=>v===rgb[n]);
 const hex=rgb.map(v=>v.toString(16).padStart(2,'0')).join('');
 if(same||['f9f3fc','fff7fb'].includes(hex))sprite.data[i+3]=0;
}
writeFileSync('assets/couple-sprite.png',PNG.sync.write(sprite));
console.log('Rendered transparent assets/couple-sprite.png');
