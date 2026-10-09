const fs=require('fs'),os=require('os'),path=require('path'),puppeteer=require('puppeteer-core');
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT=require('path').resolve(__dirname, 'shots');
const JOBS=[
  ['login.html','#authForm',700],
  ['index.html','.footer',900],
  ['admin.html','body',700]
];
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const udd=fs.mkdtempSync(path.join(os.tmpdir(),'multi-'));
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',userDataDir:udd,args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars']});
  for(const [page,sel,pad] of JOBS){
    const p=await b.newPage();
    await p.setViewport({width:1280,height:900,deviceScaleFactor:2});
    await p.goto('http://127.0.0.1:8099/'+page,{waitUntil:'networkidle0'});
    await new Promise(r=>setTimeout(r,1400));
    const clip=await p.evaluate((s,pad)=>{
      const el=document.querySelector(s);
      if(!el) return {x:0,y:0,width:1280,height:700};
      const r=el.getBoundingClientRect();
      const top=Math.max(0, r.top+window.pageYOffset-pad);
      window.scrollTo(0, top);
      return {x:0,y:0,width:1280,height:700,scrollTo:top};
    }, sel, pad);
    await new Promise(r=>setTimeout(r,700));
    const name=page.replace(/[^\w]/g,'_');
    await p.screenshot({path:path.join(OUT,'chk-'+name+'.png'),clip:{x:0,y:0,width:1280,height:Math.min(900,clip.height)}});
    console.log('wrote chk-'+name+'.png  '+JSON.stringify(clip));
    await p.close();
  }
  await b.close();
})();
