#!/usr/bin/env node
// DS-02 audit: compare frozen baseline with a working tree, or validate one tree.
// Usage: node tests/design-system/typography-audit.mjs [baseline-dir] [current-dir]
// The baseline is commit a4a93e0ff24dd5d1fdbc5c53413d06bce600c57b.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[3] || process.argv[2] || '.');
const oldRoot = process.argv[3] ? path.resolve(process.argv[2]) : null;
const BASELINE_SHA = 'a4a93e0ff24dd5d1fdbc5c53413d06bce600c57b';
function heading(selector) {
  return /(?:^|[\s>~+,])h[1-6](?=$|[\s:#.,>\[])/i.test(selector) ||
    /\.(?:h1|h2|sh2|ir-t|ce-t|ve-sdk-t|tf-method-title|tf-status-title)\b|\.bempty b\b/i.test(selector);
}
function graphic(selector) { return /\.tf-currency-check\b/.test(selector); }
function collect(dir) {
  const paths = [
    'css/alt-vu-wallet.css','css/transfi-bank-altvu.css','css/design-system.css',
    'showcase/showcase.css','showcase/specimen.css','ui-kit/index.html',
    'transfi-remittance/index.html','transfi-remittance/legacy.html',
    ...fs.readdirSync(path.join(dir,'components')).filter(f=>f.endsWith('.html')).map(f=>'components/'+f)
  ];
  const all=[],counts={},issues=[],exceptions=[];
  function add(file,selector,raw,from){
    const num=Number(raw);
    if(!Number.isFinite(num)||num>=20)return;
    const exception=heading(selector)||graphic(selector);
    const item={file,selector:selector.trim().replace(/\s+/g,' ').slice(-150),size:num,from};
    if(exception){exceptions.push(item);return;}
    counts[num]=(counts[num]||0)+1;
    all.push(item);
    if(!Number.isInteger(num)||num%2)issues.push(item);
  }
  function scanCSS(file,src) {
    for(const m of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
      const selector=m[1],body=m[2];
      if(selector.trim().startsWith('@font-face'))continue;
      for(const hit of body.matchAll(/\bfont-size\s*:\s*([\d.]+)px\b/gi))add(file,selector,hit[1],'font-size');
      for(const hit of body.matchAll(/\bfont-size\s*:\s*var\([^;\n]*?,\s*([\d.]+)px\s*\)/gi))add(file,selector,hit[1],'font-size fallback');
      for(const hit of body.matchAll(/\bfont\s*:\s*([^;{}\n]+)/gi)){
        const x=hit[1].match(/([\d.]+)px(?=\/|\s+[a-zA-Z"'])/);
        if(x)add(file,selector,x[1],'font');
      }
    }
  }
  for(const file of paths){
    const src=fs.readFileSync(path.join(dir,file),'utf8');
    if(file.endsWith('.css'))scanCSS(file,src);
    else for(const match of src.matchAll(/<style(?:\s[^>]*)?>[\s\S]*?<\/style>/gi))scanCSS(file,match[0]);
  }
  const tok=JSON.parse(fs.readFileSync(path.join(dir,'tokens/tokens.json'),'utf8'));
  for(const t of tok.type){
    const s=Number.parseFloat(t.size);
    if(s<20&&(s%2||!Number.isInteger(s)))issues.push({file:'tokens/tokens.json',selector:'type.'+t.key,size:s,from:'token'});
  }
  for(const cssRef of fs.readFileSync(path.join(dir,'tokens/tokens.css'),'utf8').matchAll(/--ds-font-size-([\d.]+):\s*([\d.]+)px/g)){
    const s=Number(cssRef[2]);if(s<20&&(s%2||!Number.isInteger(s)))issues.push({file:'tokens/tokens.css',selector:cssRef[1],size:s,from:'base token'});
  }
  return {files:paths.length,occurrences:all.length,bySize:Object.fromEntries(Object.entries(counts).sort((a,b)=>+a[0]-+b[0])),issues,exceptions};
}
const current=collect(root),baseline=oldRoot?collect(oldRoot):null;
const report={baseline_commit:BASELINE_SHA,baseline:baseline&&{occurrences:baseline.occurrences,bySize:baseline.bySize,oddCount:baseline.issues.length,exceptions:baseline.exceptions},current:{occurrences:current.occurrences,bySize:current.bySize,oddCount:current.issues.length,exceptions:current.exceptions},remaining:current.issues};
console.log(JSON.stringify(report,null,2));
if(current.issues.length){console.error('DS-02: non-grid text font sizes remain: '+current.issues.length);process.exitCode=1;}
