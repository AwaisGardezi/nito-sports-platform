const fs=require('fs'),os=require('os'),path=require('path'),puppeteer=require('puppeteer-core');
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT=require('path').resolve(__dirname, 'shots');
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const udd=fs.mkdtempSync(path.join(os.tmpdir(),'drshot-'));
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',userDataDir:udd,args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars']});
  const p=await b.newPage();
  await p.setViewport({width:390,height:844,deviceScaleFactor:2});
  await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,1200));
  await p.evaluate(()=>{const b=document.querySelector('.burger, .nav__burger, [data-drawer]'); if(b)b.click();});
  await new Promise(r=>setTimeout(r,900));
  const info=await p.evaluate(()=>{
    const panel=document.querySelector('.drawer__panel');
    const logo=document.querySelector('.drawer__top .brand__logo');
    const lr=logo?logo.getBoundingClientRect():null;
    return {panelBg:panel?getComputedStyle(panel).backgroundColor:null,
            panelH:panel?Math.round(panel.getBoundingClientRect().height):null,
            logoSrc:logo?logo.getAttribute('src'):null,
            logoRect:lr?{x:Math.round(lr.x),y:Math.round(lr.y),w:Math.round(lr.width),h:Math.round(lr.height)}:null,
            isOpen:document.querySelector('.drawer')?document.querySelector('.drawer').className:null};
  });
  console.log(JSON.stringify(info,null,2));
  await p.screenshot({path:path.join(OUT,'drawer-open.png')});
  await b.close();
})();
