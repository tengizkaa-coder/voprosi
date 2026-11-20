// Administrative styling only. No webhook, polling, progress changes or chat messages.
// Deploy with verify_jwt=false; a dedicated secret authorizes this endpoint.
import { PNG } from 'npm:pngjs@7.0.0';

function avatar() {
  const size=512, scale=8;
  const png=new PNG({width:size,height:size});
  const color=(hex:string)=>hex.match(/\w\w/g)!.map(v=>parseInt(v,16));
  function pixel(x:number,y:number,c:string){
    const rgb=color(c);
    for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
      const xx=x*scale+dx,yy=y*scale+dy;if(xx<0||yy<0||xx>=size||yy>=size)continue;
      const p=(yy*size+xx)*4;png.data[p]=rgb[0];png.data[p+1]=rgb[1];png.data[p+2]=rgb[2];png.data[p+3]=255;
    }
  }
  const rect=(x:number,y:number,w:number,h:number,c:string)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)pixel(xx,yy,c)};
  const oval=(x:number,y:number,rx:number,ry:number,c:string)=>{for(let yy=Math.floor(y-ry);yy<=y+ry;yy++)for(let xx=Math.floor(x-rx);xx<=x+rx;xx++)if(((xx-x)/rx)**2+((yy-y)/ry)**2<=1)pixel(xx,yy,c)};
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const t=(x+y)/126;const a=[240,227,249],b=[252,224,236];pixel(x,y,a.map((v,i)=>Math.round(v+(b[i]-v)*t).toString(16).padStart(2,'0')).join(''));
  }
  // Quiet clouds and pixel stars.
  oval(10,44,10,3,'f9f3fc');oval(7,41,4,4,'f9f3fc');oval(14,41,5,5,'f9f3fc');
  oval(56,22,10,3,'fff7fb');oval(52,19,4,4,'fff7fb');oval(59,19,5,5,'fff7fb');
  const star=(x:number,y:number)=>{rect(x,y-2,1,5,'c5a8dc');rect(x-2,y,5,1,'c5a8dc')};star(10,20);star(53,42);star(45,10);rect(16,11,1,1,'c4a4d9');
  // White-haired girl, silhouette and soft pink jumper.
  oval(42,29,10,13,'e0d5e9');rect(32,29,21,17,'e0d5e9');
  oval(42,51,12,12,'d690b8');rect(31,49,23,10,'d690b8');
  oval(41,49,11,10,'efb1d0');rect(30,48,23,11,'efb1d0');
  rect(39,39,5,5,'edc6bd');rect(38,43,7,2,'f9d7e8');
  oval(41,30,8,10,'ffdfd1');rect(34,28,15,8,'ffdfd1');
  oval(41,23,9,7,'fffafd');rect(32,23,3,18,'fffafd');rect(48,24,4,19,'f6f0fa');rect(34,22,7,5,'fffafd');rect(34,26,4,3,'fffafd');
  rect(37,31,1,2,'5c485f');rect(45,31,1,2,'5c485f');rect(34,34,3,1,'edafb8');rect(46,34,2,1,'edafb8');rect(40,36,3,1,'bd858d');
  // Curly boy, lavender jumper and round-ish pixel glasses.
  oval(22,51,12,12,'9571bb');rect(11,49,23,10,'9571bb');
  oval(22,49,11,10,'b79ad9');rect(11,49,23,10,'b79ad9');
  rect(19,39,6,5,'e5b49e');rect(18,43,8,2,'cbb6e5');
  oval(22,30,9,11,'f5cbb4');rect(14,28,17,9,'f5cbb4');
  oval(22,23,10,7,'292333');
  for(const [x,y] of [[14,23],[17,19],[22,18],[27,19],[30,23],[15,26],[21,22],[27,24]])oval(x,y,3,3,'30283b');
  rect(13,26,2,5,'30283b');rect(30,26,2,5,'30283b');
  rect(14,29,7,1,'4a3b53');rect(14,33,7,1,'4a3b53');rect(14,30,1,3,'4a3b53');rect(20,30,1,3,'4a3b53');
  rect(24,29,7,1,'4a3b53');rect(24,33,7,1,'4a3b53');rect(24,30,1,3,'4a3b53');rect(30,30,1,3,'4a3b53');rect(21,30,3,1,'4a3b53');
  rect(17,31,1,1,'342a40');rect(27,31,1,1,'342a40');rect(21,37,3,1,'ad7974');rect(15,35,3,1,'e6a799');
  // Joined sleeves and a tiny hand, visible within a circular Telegram crop.
  rect(25,49,7,4,'b79ad9');rect(31,49,7,4,'efb1d0');rect(30,49,4,2,'f5cbb4');
  // Floating heart.
  const heart=['01100110','11111111','11111111','01111110','00111100','00011000'];
  heart.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='1')pixel(28+x,9+y,'ce8eb8')}));rect(29,10,2,1,'f8c9e0');
  return new Uint8Array(PNG.sync.write(png));
}
Deno.serve(async(req:Request)=>{
  const expected=Deno.env.get('BOT_STYLE_SETUP_SECRET');
  if(req.method!=='POST'||!expected||req.headers.get('x-setup-secret')!==expected)return new Response('Not found',{status:404});
  const token=Deno.env.get('TELEGRAM_BOT_TOKEN');
  if(!token)return Response.json({ok:false,error:'Missing bot token'},{status:503});
  const results:Record<string,unknown>={};
  async function api(method:string,body:unknown){
    try{
      const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
      const data=await r.json();results[method]={ok:data.ok,description:data.description};return data;
    }catch{results[method]={ok:false,description:'Telegram request failed'};return {ok:false}}
  }
  const me=await api('getMe',{});if(!me.ok)return Response.json({ok:false,results});
  await api('setMyName',{name:'между нами | для тебя и Вики'});
  await api('setMyShortDescription',{short_description:'Ваш маленький мир для двоих. 667 поводов стать ближе — без спешки, масок и правильных ответов.'});
  await api('setMyDescription',{description:'между нами\n\nДля тебя и Вики. Для вечеров, которые хочется продлить. Для слов, на которые раньше не хватало смелости.\n\n667 вопросов — от любимого завтрака до самого сокровенного.\n\nНе нужно отвечать идеально. Просто будьте собой.\n\nВаше личное пространство. По одному разговору навстречу друг другу.'});
  await api('setMyCommands',{commands:[{command:'start',description:'Наше пространство для двоих'},{command:'next',description:'Продолжить наш разговор'},{command:'categories',description:'Выбрать настроение разговора'},{command:'random',description:'Довериться случаю'},{command:'progress',description:'Посмотреть нашу историю'}]});
  try{
    const form=new FormData();form.set('photo',JSON.stringify({type:'static',photo:'attach://avatar'}));form.set('avatar',new Blob([avatar()],{type:'image/png'}),'mezhdu-nami.png');
    const r=await fetch(`https://api.telegram.org/bot${token}/setMyProfilePhoto`,{method:'POST',body:form,signal:AbortSignal.timeout(15000)});const data=await r.json();results.setMyProfilePhoto={ok:data.ok,description:data.description};
  }catch{results.setMyProfilePhoto={ok:false,description:'Avatar upload failed'}}
  const name=await api('getMyName',{}),description=await api('getMyDescription',{}),short=await api('getMyShortDescription',{});
  return Response.json({ok:Object.values(results).every((r:any)=>r.ok),username:me.result.username,profile:{name:name.result?.name,description:description.result?.description,short_description:short.result?.short_description},allowed_accounts:(Deno.env.get('TELEGRAM_USER_IDS')||'').split(',').filter(Boolean).length,results});
});
