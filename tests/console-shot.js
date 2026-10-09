const fs=require('fs'),os=require('os'),path=require('path'),puppeteer=require('puppeteer-core');
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT=require('path').resolve(__dirname, 'shots');
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const udd=fs.mkdtempSync(path.join(os.tmpdir(),'con-'));
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',userDataDir:udd,args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars']});
  const p=await b.newPage();
  await p.setViewport({width:1440,height:900,deviceScaleFactor:2});
  await p.goto('http://127.0.0.1:8099/login.html',{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,1200));
  const mode=await p.evaluate(()=>document.getElementById('authForm').getAttribute('data-mode'));
  console.log('login mode: '+mode);
  if(mode==='setup'){
    await p.type('#aName','Awais Haider');
    await p.type('#aEmail','owner@nitosports.com');
    await p.type('#aPass','Fixture-Passw0rd!');
    await p.type('#aPass2','Fixture-Passw0rd!');
    await p.click('#authSubmit');
    await new Promise(r=>setTimeout(r,2600));
  }
  console.log('url now: '+p.url());
  await new Promise(r=>setTimeout(r,1500));
  const info=await p.evaluate(()=>{
    const logos=Array.from(document.querySelectorAll('img')).map(i=>{
      const r=i.getBoundingClientRect();
      const holder=i.parentElement;
      return {src:i.getAttribute('src'),w:Math.round(r.width),h:Math.round(r.height),
              bg:holder?getComputedStyle(holder).backgroundColor:null,
              visible:r.width>0&&r.height>0};
    });
    return {url:location.pathname, logos};
  });
  console.log(JSON.stringify(info,null,2));
  await p.screenshot({path:path.join(OUT,'console-top.png'),clip:{x:0,y:0,width:1440,height:420}});
  console.log('wrote console-top.png');
  await b.close();
})();
