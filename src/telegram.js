// Telegram fullscreen is separate from expand(); older clients only support expand.
export function setupTelegram(webApp=window.Telegram?.WebApp, root=document.documentElement){
 if(!webApp)return ()=>{};
 const supports=version=>typeof webApp.isVersionAtLeast==='function'&&webApp.isVersionAtLeast(version);
 const safeCall=fn=>{try{fn?.()}catch{/* Unsupported client: retain expanded layout. */}};
 const update=()=>{
  const safe=webApp.safeAreaInset||{},content=webApp.contentSafeAreaInset||{};
  for(const edge of ['top','right','bottom','left'])root.style.setProperty(`--app-safe-${edge}`,`${Math.max(0,safe[edge]||0)+Math.max(0,content[edge]||0)}px`);
  root.style.setProperty('--app-height',`${webApp.viewportStableHeight||window.innerHeight}px`);
 };
 safeCall(()=>webApp.ready());safeCall(()=>webApp.expand());
 if(supports('7.7'))safeCall(()=>webApp.disableVerticalSwipes());
 if(supports('8.0')&&!webApp.isFullscreen)safeCall(()=>webApp.requestFullscreen());
 const events=['viewportChanged','safeAreaChanged','contentSafeAreaChanged','fullscreenChanged'];
 events.forEach(event=>webApp.onEvent?.(event,update));update();
 return ()=>{events.forEach(event=>webApp.offEvent?.(event,update));for(const edge of ['top','right','bottom','left'])root.style.removeProperty(`--app-safe-${edge}`);root.style.removeProperty('--app-height')};
}
