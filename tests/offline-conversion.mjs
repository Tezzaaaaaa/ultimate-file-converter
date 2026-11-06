import{chromium}from'playwright';import{createServer}from'node:http';import{readFile,mkdir}from'node:fs/promises';import{extname,resolve}from'node:path';import{execFileSync}from'node:child_process';

// Offline regression suite. Every case runs with the network switched off after
// the service worker has installed, so a missing offline asset or a conversion
// that secretly needs the network fails the build.

const root=resolve('dist'),fixtures=resolve('tests/fixtures'),downloads=resolve('tests/downloads');
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.wasm':'application/wasm','.json':'application/json','.woff2':'font/woff2','.png':'image/png','.mp4':'video/mp4','.webm':'video/webm','.txt':'text/plain'};

const server=createServer(async(req,res)=>{try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const f=resolve(root,pathname==='/'?'index.html':'.'+pathname);
  if(!f.startsWith(root))throw Error();
  res.writeHead(200,{'Content-Type':types[extname(f)]||'application/octet-stream'});
  res.end(await readFile(f));
}catch{if(!res.headersSent){res.writeHead(404);res.end();}}});
await new Promise(ok=>server.listen(4173,'127.0.0.1',ok));
await mkdir(downloads,{recursive:true});

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let failures=[];
try{
  const ctx=await browser.newContext({acceptDownloads:true,serviceWorkers:'allow'}),p=await ctx.newPage();
  const errors=[],external=[];
  p.on('pageerror',e=>errors.push(e.message));
  p.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173'))external.push(r.url());});

  await p.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:60000});
  await p.evaluate(()=>navigator.serviceWorker.ready);
  await p.reload({waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForFunction(()=>!!navigator.serviceWorker.controller);

  // The offline cache must hold every asset, with no remote fallbacks.
  const cache=await p.evaluate(async()=>{const keys=await caches.keys(),c=await caches.open(keys[0]),urls=(await c.keys()).map(r=>r.url);return{count:urls.length,fonts:urls.filter(u=>u.includes('/fonts/')).length,external:urls.filter(u=>!u.includes('127.0.0.1'))};});
  if(cache.count<40)failures.push('offline cache too small: '+cache.count);
  if(cache.fonts<9)failures.push('UI fonts missing from offline cache: '+cache.fonts);
  if(cache.external.length)failures.push('offline cache holds remote URLs: '+cache.external.join(', '));
  if(external.length)failures.push('page requested external URLs: '+external.join(', '));
  console.log('offline cache: '+cache.count+' entries, '+cache.fonts+' fonts, 0 external');

  await ctx.setOffline(true);

  // Fonts must resolve from the local cache while offline.
  const faces=await p.evaluate(async()=>{await document.fonts.ready;return[...new Set([...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family))];});
  if(!faces.includes('DM Sans')||!faces.includes('Manrope'))failures.push('self-hosted fonts did not load offline: '+faces.join(', '));
  console.log('fonts loaded offline: '+faces.join(', '));

  // Each case selects a file, picks an output format and waits for the download.
  async function convert(file,label,timeout=240000){
    await p.locator('#clear').click().catch(()=>{});
    await p.locator('#file').setInputFiles(resolve(fixtures,file));
    const select=p.locator('.select').first();
    const options=await select.locator('option').allTextContents();
    if(!options.includes(label))throw Error(label+' is not offered for '+file);
    await select.selectOption({label});
    await p.locator('#convert').click();
    await p.waitForFunction(()=>['done','error'].includes(document.querySelector('#progress')?.dataset.status),null,{timeout});
    const status=await p.locator('#progress').getAttribute('data-status');
    if(status!=='done')throw Error(await p.locator('#progressLabel').textContent());
    const pending=p.waitForEvent('download',{timeout:30000});
    await p.locator('#downloadList a.download').first().click();
    const download=await pending,out=resolve(downloads,label+'--'+download.suggestedFilename());
    await download.saveAs(out);
    return out;
  }

  const cases=[
    ['fixture.webm','MP4',buf=>buf.includes(Buffer.from('avcC'))||buf.includes(Buffer.from('avc1')),'H.264 MP4'],
    // Regression: the bundled mjpeg encoder aborted on video input.
    ['fixture.webm','JPG',buf=>buf[0]===0xFF&&buf[1]===0xD8&&buf[buf.length-2]===0xFF&&buf[buf.length-1]===0xD9,'valid JPEG'],
    ['fixture.png','JPG',buf=>buf[0]===0xFF&&buf[1]===0xD8,'valid JPEG from image input'],
    // Regression: frame extraction used the same failing JPEG encoder.
    ['fixture.webm','FRAMES',buf=>buf[0]===0x50&&buf[1]===0x4B,'ZIP of JPG frames'],
    ['fixture.mp3','MP3',buf=>buf.length>1000,'MP3'],
    ['fixture.txt','PDF',buf=>buf.subarray(0,5).toString()==='%PDF-','PDF'],
    // Regression: document-to-PDF routes failed with "not supported".
    ['fixture.txt','HTML',buf=>buf.toString().includes('<html'),'HTML'],
    // Regression: SVG inputs had no decoder path at all.
    ['fixture.svg','PNG',buf=>buf.subarray(1,4).toString()==='PNG','PNG from SVG'],
    ['fixture.csv','XLSX',buf=>buf[0]===0x50&&buf[1]===0x4B,'XLSX'],
    ['fixture.png','PDF',buf=>buf.subarray(0,5).toString()==='%PDF-','PDF from image'],
  ];

  for(const[file,label,check,description]of cases){
    try{
      const out=await convert(file,label);
      const buf=await readFile(out);
      if(!check(buf))throw Error('unexpected output content');
      console.log('PASS: '+file+' -> '+label+' ('+description+', '+(buf.length/1024).toFixed(1)+' KB)');
    }catch(error){
      failures.push(file+' -> '+label+': '+error.message);
      console.log('FAIL: '+file+' -> '+label+': '+error.message);
    }
  }

  if(errors.length)failures.push('page errors: '+errors.join('; '));
}finally{await browser.close();server.close();}

if(failures.length){console.error('\n'+failures.length+' offline regression(s) failed:\n- '+failures.join('\n- '));process.exit(1);}
console.log('\nPASS: all offline conversion checks succeeded with the network disabled.');
