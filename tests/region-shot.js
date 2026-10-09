const fs=require('fs'),os=require('os'),path=require('path'),puppeteer=require('puppeteer-core');
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT='C:/Users/PcR/OneDrive/Desktop/Sports Platform/tests/shots';
const page=process.argv[2]||'index.html';
const sel=process.argv[3]||'#site-header';
const pad=parseInt(process.argv[4]||'0',10);
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const udd=fs.mkdtempSync(path.join(os.tmpdir(),'regshot-'));
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',userDataDir:udd,args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars']});
  const p=await b.newPage();
  await p.setViewport({width:1280,height:900,deviceScaleFactor:2});
  await p.goto('http://127.0.0.1:8099/'+page,{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,1200));
  const info=await p.evaluate((s,pad)=>{
    const el=document.querySelector(s);
    if(!el) return {err:'not found: '+s};
    const r=el.getBoundingClientRect();
    window.scrollTo(0, Math.max(0, r.top + window.pageYOffset - pad));
    return {found:true, rect:{w:Math.round(r.width),h:Math.round(r.height)}, html:el.outerHTML.slice(0,300)};
  }, sel, pad);
  await new Promise(r=>setTimeout(r,700));
  const clip=await p.evaluate((s,pad)=>{
    const el=document.querySelector(s);
    const r=el.getBoundingClientRect();
    return {x:0,y:0,width:1280,height:Math.min(900, Math.max(80, r.height+pad*2))};
  }, sel, pad);
  const name=(page.replace(/[^\w]/g,'_'))+'-'+(sel.replace(/[^\w]/g,'_'));
  await p.screenshot({path:path.join(OUT,'region-'+name+'.png'), clip});
  console.log(JSON.stringify(info));
  console.log('wrote region-'+name+'.png', JSON.stringify(clip));
  await b.close();
})();
