const fs=require('fs'),os=require('os'),path=require('path'),puppeteer=require('puppeteer-core');
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT='C:/Users/PcR/OneDrive/Desktop/Sports Platform/tests/shots';
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const udd=fs.mkdtempSync(path.join(os.tmpdir(),'fshot-'));
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',userDataDir:udd,args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars']});
  const p=await b.newPage();
  await p.setViewport({width:1280,height:900,deviceScaleFactor:2});
  await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle0'});
  await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await new Promise(r=>setTimeout(r,1200));
  await p.screenshot({path:path.join(OUT,'footer-viewport.png')});   // no clip = true viewport
  const info=await p.evaluate(()=>{
    const f=document.querySelector('.footer');
    const logo=document.querySelector('.footer .brand__logo');
    const lr=logo?logo.getBoundingClientRect():null;
    const fr=f?f.getBoundingClientRect():null;
    return {
      footerBg:f?getComputedStyle(f).backgroundColor:null,
      logo:{src:logo?logo.getAttribute('src'):null,
            y:lr?Math.round(lr.y):null,h:lr?Math.round(lr.height):null,w:lr?Math.round(lr.width):null,
            nat:logo?logo.naturalWidth+'x'+logo.naturalHeight:null,
            complete:logo?logo.complete:null},
      footerTop:fr?Math.round(fr.top):null
    };
  });
  console.log(JSON.stringify(info,null,2));
  await b.close();
})();
