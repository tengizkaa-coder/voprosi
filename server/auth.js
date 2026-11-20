import { createHmac,timingSafeEqual } from 'node:crypto';
export function validateTelegram(data,token,allowed,now=Date.now()){
 try{
 const params=new URLSearchParams(data);const hash=params.get('hash');params.delete('hash');
 if(!hash||!/^[a-f0-9]{64}$/.test(hash))return false;
 const check=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
 const secret=createHmac('sha256','WebAppData').update(token).digest();
 const expected=createHmac('sha256',secret).update(check).digest();
 if(!timingSafeEqual(expected,Buffer.from(hash,'hex')))return false;
 const age=now/1000-Number(params.get('auth_date'));if(!Number.isFinite(age)||age< -30||age>86400)return false;
 const user=JSON.parse(params.get('user'));return allowed.includes(String(user.id))?user:false;
 }catch{return false}
}
