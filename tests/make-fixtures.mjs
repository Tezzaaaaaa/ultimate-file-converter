import{chromium}from'playwright';import{execFileSync}from'node:child_process';import{mkdir,readdir,readFile,writeFile}from'node:fs/promises';import{resolve}from'node:path';

// Builds the small sample files the offline regression suite converts.
// Media fixtures come from the FFmpeg CLI, the rest are written directly.

const out=resolve('tests/fixtures');
await mkdir(out,{recursive:true});

const ff=(args)=>execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args]);
const media=resolve(out,'source.mp4');
ff(['-f','lavfi','-i','testsrc=size=160x120:rate=10','-f','lavfi','-i','sine=frequency=1000:sample_rate=44100','-t','2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',media]);
ff(['-i',media,'-c:v','libvpx','-deadline','realtime','-cpu-used','8','-c:a','libopus',resolve(out,'fixture.webm')]);
ff(['-i',media,'-vn','-c:a','libmp3lame',resolve(out,'fixture.mp3')]);
ff(['-f','lavfi','-i','testsrc=size=160x120:rate=1','-frames:v','1',resolve(out,'fixture.png')]);

await writeFile(resolve(out,'fixture.txt'),'Hello offline world\nSecond line of text\n');
await writeFile(resolve(out,'fixture.csv'),'Quarter,Revenue\nQ1,1000\nQ2,2500\n');
await writeFile(resolve(out,'fixture.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#0af"/><circle cx="60" cy="40" r="24" fill="#fff"/></svg>');

const files=(await readdir(out)).sort();
console.log('fixtures ready: '+files.join(', '));
