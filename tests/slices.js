const fs=require('fs'),os=require('os'),path=require('path'),puppeteer=require('puppeteer-core');
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT=require('path').resolve(__dirname, 'shots');
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const udd=fs.mkdtempSync(path.join(os.tmpdir(),'slices-'));
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',userDataDir:udd,args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars']});
  const p=await b.newPage();
  await p.setViewport({width:1280,height:900,deviceScaleFactor:1});
  await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle0'});
  // trigger every reveal by walking the page
  await p.evaluate(async()=>{
    const step=Math.round(innerHeight*0.7);
    for(let y=0;y<document.body.scrollHeight;y+=step){scrollTo(0,y);await new Promise(r=>setTimeout(r,150));}
    scrollTo(0,0);
  });
  await new Promise(r=>setTimeout(r,1500));
  const H=await p.evaluate(()=>document.body.scrollHeight);
  // name the sections and their document offsets so I can map a slice to a section
  const secs=await p.evaluate(()=>Array.from(document.querySelectorAll('section[id], footer, .footer, .copy')).map(s=>({
    id:s.id||s.className.split(' ')[0],
    top:Math.round(s.getBoundingClientRect().top+scrollY),
    h:Math.round(s.getBoundingClientRect().height),
    bg:getComputedStyle(s).backgroundColor
  })));
  console.log('PAGE HEIGHT '+H);
  secs.forEach(s=>console.log('  '+String(s.top).padStart(6)+' +'+String(s.h).padStart(5)+'  '+s.id.padEnd(18)+' bg='+s.bg));
  const SL=2400;
  for(let i=0,y=0;y<H;y+=SL,i++){
    await p.screenshot({path:path.join(OUT,'slice-'+i+'.png'),clip:{x:0,y,width:1280,height:Math.min(SL,H-y)}});
  }
  console.log('slices: '+Math.ceil(H/SL));
  await b.close();
})();
