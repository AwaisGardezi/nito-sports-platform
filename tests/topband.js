const fs=require('fs'),os=require('os'),path=require('path'),puppeteer=require('puppeteer-core');
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT='C:/Users/PcR/OneDrive/Desktop/Sports Platform/tests/shots';
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const udd=fs.mkdtempSync(path.join(os.tmpdir(),'topband-'));
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',userDataDir:udd,args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars']});
  const p=await b.newPage();
  await p.setViewport({width:1280,height:900,deviceScaleFactor:2});
  await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,1200));
  await p.screenshot({path:path.join(OUT,'band-top.png'),clip:{x:0,y:0,width:1280,height:230}});
  // geometry of the pieces at the top
  const geo=await p.evaluate(()=>{
    const g=(s)=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();const c=getComputedStyle(e);
      return {sel:s,x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),
        pos:c.position,top:c.top,z:c.zIndex,bg:c.backgroundColor};};
    return [g('.topbar'),g('.nav'),g('.brand'),g('.brand__logo'),g('#site-header')].filter(Boolean);
  });
  console.log('AT REST'); geo.forEach(x=>console.log('  '+JSON.stringify(x)));
  await p.evaluate(()=>window.scrollTo(0,420));
  await new Promise(r=>setTimeout(r,700));
  await p.screenshot({path:path.join(OUT,'band-scrolled.png'),clip:{x:0,y:0,width:1280,height:230}});
  const geo2=await p.evaluate(()=>{
    const g=(s)=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();const c=getComputedStyle(e);
      return {sel:s,y:Math.round(r.y),h:Math.round(r.height),pos:c.position,z:c.zIndex,bg:c.backgroundColor};};
    return [g('.topbar'),g('.nav'),g('.brand__logo')].filter(Boolean);
  });
  console.log('SCROLLED 420'); geo2.forEach(x=>console.log('  '+JSON.stringify(x)));
  await b.close();
})();
