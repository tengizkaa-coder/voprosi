export const emptyProgress=()=>({asked:[],current:1,generation:0,revision:0});
export function localAction(base,action,id){
 if(action==='reset')return {...emptyProgress(),generation:(base.generation||0)+1,revision:(base.revision||0)+1};
 const asked=action==='mark'&&!base.asked.some(a=>a.id===id)?[{id,at:new Date().toISOString()},...base.asked]:action==='undo'?base.asked.filter(a=>a.id!==id):base.asked;
 return {...base,asked,current:action==='select'?id:base.current,revision:(base.revision||0)+1};
}
export function isNewer(incoming,current){return (incoming.revision??0)>=(current.revision??0)}
