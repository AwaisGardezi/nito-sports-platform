const fs=require('fs'),os=require('os'),path=require('path'),puppeteer=require('puppeteer-core');
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
(async()=>{
  const udd=fs.mkdtempSync(path.join(os.tmpdir(),'pdiag-'));
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',userDataDir:udd,args:['--no-sandbox','--disable-dev-shm-usage']});
  const p=await b.newPage();
  await p.setViewport({width:1280,height:900});
  await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle0'});
  await p.evaluate(()=>document.getElementById('payments').scrollIntoView());
  await new Promise(r=>setTimeout(r,800));
  const out=await p.evaluate(()=>{
    const card=document.querySelector('.pay');
    const chip=card.querySelector('.pay__logo');
    const img=chip.querySelector('img');
    const cs=getComputedStyle(chip), is=getComputedStyle(img);
    return {
      chipRect:chip.getBoundingClientRect().height,
      chipComputedHeight:cs.height, chipDisplay:cs.display, chipPad:cs.padding,
      chipBoxSizing:cs.boxSizing, chipMinH:cs.minHeight, chipOverflow:cs.overflow,
      imgRect:img.getBoundingClientRect().height+'x'+img.getBoundingClientRect().width,
      imgMaxH:is.maxHeight, imgMaxW:is.maxWidth, imgH:is.height, imgW:is.width,
      imgNatural:img.naturalWidth+'x'+img.naturalHeight,
      cardDisplay:getComputedStyle(card).display
    };
  });
  console.log(JSON.stringify(out,null,2));
  await b.close();
})();
