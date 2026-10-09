/* For every brand/payment <img> on every page, scroll it into view and ask
   elementFromPoint what is actually painted at its centre. Geometry can say a
   logo is "visible" while something is drawn over it; only hit-testing settles
   it. Reports any element that is NOT the image or one of its ancestors. */
const fs=require('fs'),os=require('os'),path=require('path'),puppeteer=require('puppeteer-core');
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PAGES=['index.html','products.html','product.html?id=football-kit','about.html',
             'contact.html','quote.html','customization.html','login.html','admin.html','404.html'];
const VPS=[[1280,900],[390,844]];
(async()=>{
  const udd=fs.mkdtempSync(path.join(os.tmpdir(),'occ-'));
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',userDataDir:udd,args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars']});
  let issues=0;
  for(const [w,h] of VPS){
    for(const page of PAGES){
      const p=await b.newPage();
      await p.setViewport({width:w,height:h,deviceScaleFactor:1});
      try{ await p.goto('http://127.0.0.1:8099/'+page,{waitUntil:'networkidle0'}); }catch(e){ console.log('skip '+page); await p.close(); continue; }
      await new Promise(r=>setTimeout(r,1200));
      const res=await p.evaluate(async()=>{
        const out=[];
        const imgs=Array.from(document.querySelectorAll('img')).filter(i=>/nito-|assets\/img\/pay|scci|fbr|logo/i.test(i.getAttribute('src')||''));
        for(const img of imgs){
          img.scrollIntoView({block:'center'});
          await new Promise(r=>setTimeout(r,260));
          const r=img.getBoundingClientRect();
          if(r.width<2||r.height<2){ out.push({src:img.getAttribute('src'),note:'zero-size'}); continue; }
          const pts=[[r.left+r.width/2,r.top+r.height/2],[r.left+4,r.top+4],
                     [r.right-4,r.top+4],[r.left+4,r.bottom-4],[r.right-4,r.bottom-4]];
          const over=[];
          for(const [x,y] of pts){
            if(x<0||y<0||x>innerWidth||y>innerHeight) continue;
            const el=document.elementFromPoint(x,y);
            if(!el) continue;
            if(el===img||el.contains(img)||img.contains(el)) continue;
            const cs=getComputedStyle(el);
            over.push(el.tagName.toLowerCase()+'.'+(el.className&&el.className.toString?el.className.toString().split(' ').slice(0,2).join('.'):'')
                      +' bg='+cs.backgroundColor+' z='+cs.zIndex);
          }
          out.push({src:img.getAttribute('src'),w:Math.round(r.width),h:Math.round(r.height),
                    over:[...new Set(over)]});
        }
        return out;
      });
      const bad=res.filter(x=>x.over&&x.over.length);
      if(bad.length){ issues+=bad.length;
        console.log('\n['+w+'px] '+page);
        bad.forEach(x=>console.log('   OCCLUDED '+x.src+'  ('+x.w+'x'+x.h+')  by: '+x.over.join(' | ')));
      }
      await p.close();
    }
  }
  console.log('\n--- occlusion issues: '+issues+' ---');
  await b.close();
})();
