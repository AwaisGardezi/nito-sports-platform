const fs=require('fs'),os=require('os'),path=require('path'),puppeteer=require('puppeteer-core');
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT='C:/Users/PcR/OneDrive/Desktop/Sports Platform/tests/shots';
const TARGETS=[['#credentials .cred:has(img)','cred-card'],['.cta-band','cta-band'],['.why-choose','marquee']];
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const udd=fs.mkdtempSync(path.join(os.tmpdir(),'zoom2-'));
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',userDataDir:udd,args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars']});
  const p=await b.newPage();
  await p.setViewport({width:1280,height:900,deviceScaleFactor:2});
  await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle0'});
  // walk whole page so every reveal fires
  await p.evaluate(async()=>{const s=Math.round(innerHeight*0.6);for(let y=0;y<document.body.scrollHeight;y+=s){scrollTo(0,y);await new Promise(r=>setTimeout(r,200));}scrollTo(0,0);});
  await new Promise(r=>setTimeout(r,1500));
  for(const [sel,name] of TARGETS){
    const box=await p.evaluate((s)=>{
      const el=document.querySelector(s);
      if(!el) return null;
      const r=el.getBoundingClientRect();
      return {x:Math.max(0,r.x-10), y:Math.max(0, r.y+scrollY-10),
              width:Math.min(1280, r.width+20), height:Math.min(1400, r.height+20)};
    }, sel);
    if(!box){ console.log('MISS '+sel); continue; }
    await p.screenshot({path:path.join(OUT,name+'.png'),clip:box});
    console.log('wrote '+name+'.png '+JSON.stringify(box));
  }
  await b.close();
})();
