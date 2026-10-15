import {mkdir,copyFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
await rm(path.join(root,'dist'),{recursive:true,force:true});
export const files=['cover.jpg','index.html','src/main.js','src/rules.js','src/platform.js','src/player.js','src/style.css','public/favicon.svg'];
for(const file of files){const target=path.join(root,'dist',file);await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(root,file),target);}
const html=await readFile(path.join(root,'dist/index.html'),'utf8');
if(!html.includes('three@0.180.0')||html.includes('src="/'))throw Error('Static entry must use a pinned CDN and relative paths.');
console.log(`Packaged ${files.length} static files in dist/ (no compilation required).`);
