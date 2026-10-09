const fs=require('fs'),os=require('os'),path=require('path'),puppeteer=require('puppeteer-core');
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT=require('path').resolve(__dirname, 'shots');
const page=process.argv[2]||'index.html';
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const udd=fs.mkdtempSync(path.join(os.tmpdir(),'fullshot-'));
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',userDataDir:udd,args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars']});
  const p=await b.newPage();
  await p.setViewport({width:1280,height:900,deviceScaleFactor:1});
  await p.goto('http://127.0.0.1:8099/'+page,{waitUntil:'networkidle0'});
  // walk the page so [data-reveal] elements actually fire before we shoot
  await p.evaluate(async()=>{
    const step=Math.round(window.innerHeight*0.8);
    for(let y=0;y<document.body.scrollHeight;y+=step){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,120));}
    window.scrollTo(0,0);
  });
  await new Promise(r=>setTimeout(r,900));
  const name=page.replace(/[^\w]/g,'_');
  await p.screenshot({path:path.join(OUT,'full-'+name+'.png'),fullPage:true});
  const h=await p.evaluate(()=>document.body.scrollHeight);
  console.log('wrote full-'+name+'.png  height='+h);
  await b.close();
})();
