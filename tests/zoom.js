const fs=require('fs'),os=require('os'),path=require('path'),puppeteer=require('puppeteer-core');
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT=require('path').resolve(__dirname, 'shots');
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const udd=fs.mkdtempSync(path.join(os.tmpdir(),'zoom-'));
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',userDataDir:udd,args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars']});
  const p=await b.newPage();
  await p.setViewport({width:1280,height:900,deviceScaleFactor:2});
  await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,1200));
  // scroll to credentials so its reveal fires
  await p.evaluate(()=>document.getElementById('credentials').scrollIntoView({block:'start'}));
  await new Promise(r=>setTimeout(r,1400));
  const info=await p.evaluate(()=>{
    const card=Array.from(document.querySelectorAll('#credentials .cred')).find(c=>c.querySelector('.cred__marks, img'));
    const marks=card?Array.from(card.querySelectorAll('img')).map(i=>{
      const r=i.getBoundingClientRect(); const cs=getComputedStyle(i);
      const holder=i.closest('.cred__marks,.cred--marks');
      const hs=holder?getComputedStyle(holder):null;
      return {src:i.getAttribute('src'),alt:i.getAttribute('alt'),
              rect:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)},
              nat:i.naturalWidth+'x'+i.naturalHeight,
              holderBg:hs?hs.backgroundColor:null, holderClass:holder?holder.className:null};
    }):[];
    return {found:!!card, marks};
  });
  console.log(JSON.stringify(info,null,2));
  const box=await p.evaluate(()=>{
    const card=Array.from(document.querySelectorAll('#credentials .cred')).find(c=>c.querySelector('img'));
    const r=card.getBoundingClientRect();
    return {x:Math.max(0,r.x-8),y:Math.max(0,r.y-8),width:r.width+16,height:Math.min(880,r.height+16)};
  });
  await p.screenshot({path:path.join(OUT,'cred-marks.png'),clip:box});
  console.log('wrote cred-marks.png');
  await b.close();
})();
