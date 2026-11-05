import {build} from 'esbuild';import{cp,mkdir,readdir,rm,stat,writeFile,readFile}from'node:fs/promises';import{createHash}from'node:crypto';import path from'node:path';
const root=process.cwd(),out=path.join(root,'dist');await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
await build({entryPoints:['app.js'],bundle:true,splitting:true,format:'esm',platform:'browser',target:['es2022'],outdir:out,entryNames:'app',chunkNames:'chunks/[name]-[hash]',assetNames:'assets/[name]-[hash]',sourcemap:false,legalComments:'none'});
for(const f of['index.html','favicon.svg'])await cp(path.join(root,f),path.join(out,f));
// Self-host the UI fonts so the offline cache covers them too.
await mkdir(path.join(out,'fonts'),{recursive:true});
const fontFiles=[];
for(const[family,weights]of[['dm-sans',[400,500,600,700]],['manrope',[400,500,600,700,800]]]){
  for(const weight of weights){
    const name=family+'-latin-'+weight+'-normal';
    await cp(path.join('node_modules/@fontsource',family,'files',name+'.woff2'),path.join(out,'fonts',name+'.woff2'));
    fontFiles.push([name,weight,family==='dm-sans'?'DM Sans':'Manrope']);
  }
}
const fontFaces=fontFiles.map(([name,weight,fam])=>'@font-face{font-family:\''+fam+'\';font-style:normal;font-weight:'+weight+';font-display:swap;src:url(./fonts/'+name+'.woff2) format(\'woff2\')}').join('\n');
const cssSource=fontFaces+'\n'+await readFile(path.join(root,'styles.css'),'utf8');
if(cssSource.includes('fonts.googleapis.com'))throw Error('Remote font import found in styles.css');
await writeFile(path.join(out,'styles.css'),cssSource);
await mkdir(path.join(out,'ffmpeg/lib'),{recursive:true});await mkdir(path.join(out,'ffmpeg/core'),{recursive:true});await mkdir(path.join(out,'vendor'),{recursive:true});
await cp('node_modules/@ffmpeg/ffmpeg/dist/esm',path.join(out,'ffmpeg/lib'),{recursive:true});await cp('node_modules/@ffmpeg/core/dist/esm',path.join(out,'ffmpeg/core'),{recursive:true});await cp('node_modules/pdfjs-dist/build/pdf.worker.mjs',path.join(out,'vendor/pdf.worker.mjs'));
async function walk(d,p=''){let out=[];for(const e of await readdir(d,{withFileTypes:true})){const r=path.posix.join(p,e.name);if(e.isDirectory())out.push(...await walk(path.join(d,e.name),r));else out.push('./'+r);}return out;}
const assets=await walk(out);assets.push('./sw.js','./asset-manifest.json');const manifest=JSON.stringify(assets,null,2);await writeFile(path.join(out,'asset-manifest.json'),manifest);const hash=createHash('sha256');for(const asset of assets.filter(x=>x!=='./sw.js'&&x!=='./asset-manifest.json'))hash.update(await readFile(path.join(out,asset.slice(2))));const sw=(await readFile(path.join(root,'sw.js'),'utf8')).replace('__CACHE_VERSION__',hash.digest('hex').slice(0,12));await writeFile(path.join(out,'sw.js'),sw);
const wasm=await stat(path.join(out,'ffmpeg/core/ffmpeg-core.wasm'));if(wasm.size<10_000_000)throw Error('FFmpeg WASM core missing');console.log('Built '+assets.length+' offline assets ('+fontFiles.length+' font files); FFmpeg WASM '+(wasm.size/1048576).toFixed(1)+' MB');