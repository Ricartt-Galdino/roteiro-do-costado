import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync } from 'node:fs';

const base=process.env.GITHUB_ACTIONS?'/roteiro-do-costado/':'/';
const asset=(path:string)=>`${base}${path.replace(/^\//,'')}`;

mkdirSync('public/ocr',{recursive:true});
copyFileSync('node_modules/tesseract.js/dist/worker.min.js','public/ocr/worker.min.js');
copyFileSync('node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js','public/ocr/tesseract-core-lstm.wasm.js');
copyFileSync('node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz','public/ocr/eng.traineddata.gz');

export default defineConfig({
  base,
  plugins:[{
    name:'offline-shell',
    generateBundle(_,bundle){
      const files=['','index.html','icon.svg','manifest.webmanifest','ocr/worker.min.js','ocr/tesseract-core-lstm.wasm.js','ocr/eng.traineddata.gz',...Object.keys(bundle)].map(asset);
      const fallback=asset('index.html');
      const version='costado-'+Date.now();
      this.emitFile({type:'asset',fileName:'sw.js',source:`const CACHE=${JSON.stringify(version)};const FILES=${JSON.stringify(files)};const FALLBACK=${JSON.stringify(fallback)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('costado-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).catch(()=>e.request.mode==='navigate'?caches.match(FALLBACK):Response.error())))});`});
    }
  }]
});
