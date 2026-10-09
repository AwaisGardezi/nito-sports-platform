const fs=require('fs'),os=require('os'),path=require('path'),puppeteer=require('puppeteer-core');
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT='C:/Users/PcR/OneDrive/Desktop/Sports Platform/tests/shots';
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const udd=fs.mkdtempSync(path.join(os.tmpdir(),'copyshot-'));
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',userDataDir:udd,args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars']});
  const p=await b.newPage();
  await p.setViewport({width:1280,height:900,deviceScaleFactor:2});
  await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle0'});
  await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await new Promise(r=>setTimeout(r,900));
  const el=await p.$('.copy');
  await el.screenshot({path:path.join(OUT,'footer-copy-bar.png')});
  const t=await p.evaluate(()=>{const c=document.querySelector('.copy__pay');return {text:c?c.textContent.trim():'(none)',h:c?Math.round(c.getBoundingClientRect().height):0};});
  console.log(JSON.stringify(t));
  await b.close();
})();
