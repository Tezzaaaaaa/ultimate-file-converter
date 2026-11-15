/* Exhaustive pathway matrix: every fixture in tests/matrix x every output the UI offers.
   Usage: node tests/matrix.mjs [filter-regex] ; set CHROME=/path/to/chrome if needed. */
import{chromium}from'playwright';import{createServer}from'node:http';import{readFile,readdir,mkdir}from'node:fs/promises';import{extname,resolve}from'node:path';
const root=resolve('dist'),dir=resolve('tests/matrix'),out=resolve('tests/downloads-matrix');
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.wasm':'application/wasm','.json':'application/json','.woff2':'font/woff2'};
const server=createServer(async(q,s)=>{try{const p=decodeURIComponent(new URL(q.url,'http://x').pathname);const f=resolve(root,p==='/'?'index.html':'.'+p);if(!f.startsWith(root))throw 0;s.writeHead(200,{'Content-Type':types[extname(f)]||'application/octet-stream'});s.end(await readFile(f));}catch{s.writeHead(404);s.end();}});
await new Promise(ok=>server.listen(4174,'127.0.0.1',ok));await mkdir(out,{recursive:true});
const filter=new RegExp(process.argv[2]||'.');
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CHROME?{executablePath:process.env.CHROME}:{})});
const ctx=await browser.newContext({acceptDownloads:true}),p=await ctx.newPage();p.on('pageerror',e=>console.log('PAGEERROR',e.message));
await p.goto('http://127.0.0.1:4174/');
const fails=[];let n=0;
for(const f of(await readdir(dir)).sort().filter(x=>filter.test(x))){
  await p.locator('#clear').click().catch(()=>{});await p.locator('#file').setInputFiles(resolve(dir,f));
  const labels=await p.locator('.select').first().locator('option').allTextContents();
  for(const label of labels.filter(l=>!process.env.LABELS||process.env.LABELS.split(',').includes(l))){
    n++;const t0=Date.now();
    try{
      await p.locator('#clear').click().catch(()=>{});await p.locator('#file').setInputFiles(resolve(dir,f));
      await p.locator('.select').first().selectOption({label});
      await p.locator('#convert').click();
      await p.waitForFunction(()=>['done','error'].includes(document.querySelector('#progress')?.dataset.status),null,{timeout:90000});
      if(await p.locator('#progress').getAttribute('data-status')!=='done')throw Error(((await p.locator('#progressLabel').textContent())||'').slice(0,160));
      const pend=p.waitForEvent('download',{timeout:20000});await p.locator('#downloadList a.download').first().click();
      const d=await pend,o=resolve(out,f+'--'+label+'--'+d.suggestedFilename());await d.saveAs(o);
      const size=(await readFile(o)).length;if(size<50)throw Error('output tiny ('+size+' B)');
      console.log('ok   '+f+' -> '+label+' ('+size+' B, '+((Date.now()-t0)/1000).toFixed(1)+'s)');
    }catch(e){fails.push(f+' -> '+label+': '+e.message);console.log('FAIL '+f+' -> '+label+': '+e.message);
      await p.reload();}
  }
}
console.log('\n'+n+' conversions, '+fails.length+' failed');fails.forEach(x=>console.log(' - '+x));
await browser.close();server.close();
