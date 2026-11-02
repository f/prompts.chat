import type { LibraryPrompt } from "./index";

export interface PortableLabels {
  title: string; intro: string; search: string; category: string; all: string;
  preview: string; copy: string; copied: string; copyError: string; empty: string;
  source: string; count: string;
}

/** Escape both the HTML parser and JavaScript string context for embedded JSON. */
function inlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function portableHtml(prompts: LibraryPrompt[], labels: PortableLabels): string {
  // All prompt content and labels are assigned through textContent/value, never innerHTML.
  return `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prompt Library</title>
<style>
:root{color-scheme:light dark;font:16px system-ui,sans-serif;background:light-dark(#f6f7fb,#11121a);color:light-dark(#20212c,#ececf5)}*{box-sizing:border-box}body{max-width:1400px;margin:auto;padding:24px}h1{letter-spacing:-.04em}p{line-height:1.6}input,select,textarea,button{font:inherit;padding:12px;border:1px solid #8888;border-radius:8px;background:light-dark(white,#20212c);color:inherit}button{cursor:pointer;text-align:start}button:hover,button[aria-pressed=true]{border-color:#818cf8;background:light-dark(#eef0ff,#303453)}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid #818cf8;outline-offset:2px}.filters{display:flex;flex-wrap:wrap;gap:12px}.filters label{flex:1;display:flex;flex-direction:column;gap:6px}main{display:grid;grid-template-columns:1fr 1.2fr;gap:24px;margin-top:24px}#list{display:flex;flex-direction:column;gap:10px}#preview{min-width:0}textarea{width:100%;min-height:380px;line-height:1.6;resize:vertical;white-space:pre-wrap}#more{margin-top:12px}#status{min-height:24px}a{color:light-dark(#4338ca,#a5b4fc)}@media(max-width:700px){body{padding:16px}main{grid-template-columns:1fr}}
</style>
<h1 id="title"></h1><p id="intro"></p>
<div class="filters"><label><span id="search-label"></span><input id="search" type="search"></label><label><span id="category-label"></span><select id="category"></select></label></div>
<p id="count" role="status"></p><main><section><div id="list"></div><button id="more" hidden>+ 60</button></section><section id="preview"><h2 id="preview-title"></h2><label for="text" id="preview-label"></label><textarea id="text" readonly></textarea><p><button id="copy" disabled></button></p><p id="status" role="status"></p><a id="source" target="_blank" rel="noopener noreferrer" hidden></a></section></main>
<script id="prompt-data" type="application/json">${inlineJson(prompts)}</script>
<script>
'use strict';
const prompts=JSON.parse(document.getElementById('prompt-data').textContent), labels=${inlineJson(labels)};
const el=id=>document.getElementById(id);
document.title=labels.title; el('title').textContent=labels.title;el('intro').textContent=labels.intro;
el('search-label').textContent=labels.search;el('category-label').textContent=labels.category;el('preview-label').textContent=labels.preview;el('copy').textContent=labels.copy;
for(const c of ['',...new Set(prompts.map(p=>p.category))].sort()){const o=document.createElement('option');o.value=c;o.textContent=c||labels.all;el('category').append(o);}
let filtered=[],limit=60,selected='';
function preview(p){selected=p.id;el('preview-title').textContent=p.title;el('text').value=p.prompt;el('copy').disabled=false;el('status').textContent='';el('source').hidden=true;el('source').removeAttribute('href');try{const u=new URL(p.source);if(u.protocol==='https:'){el('source').href=u.href;el('source').textContent=labels.source;el('source').hidden=false;}}catch{} for(const b of el('list').children)b.setAttribute('aria-pressed',String(b.dataset.id===selected));}
function render(){const terms=el('search').value.toLocaleLowerCase().trim().split(/\\s+/).filter(Boolean);filtered=prompts.filter(p=>(!el('category').value||p.category===el('category').value)&&terms.every(t=>[p.title,p.prompt,p.description,p.category,p.subcategory,...p.tags].join(' ').toLocaleLowerCase().includes(t)));el('list').replaceChildren();el('count').textContent=filtered.length+' '+labels.count;for(const p of filtered.slice(0,limit)){const b=document.createElement('button');b.textContent=p.title+' · '+p.category;b.dataset.id=p.id;b.setAttribute('aria-pressed',String(p.id===selected));b.onclick=()=>preview(p);el('list').append(b);}el('more').hidden=filtered.length<=limit;const next=filtered.find(p=>p.id===selected)||filtered[0];if(next)preview(next);else{selected='';el('preview-title').textContent=labels.empty;el('text').value='';el('copy').disabled=true;el('source').hidden=true;el('status').textContent='';}}
el('search').oninput=el('category').onchange=()=>{limit=60;render();};el('more').onclick=()=>{limit+=60;render();};
el('copy').onclick=async()=>{try{await navigator.clipboard.writeText(el('text').value);el('status').textContent=labels.copied;}catch{el('text').focus();el('text').select();el('status').textContent=labels.copyError;}};render();
</script></html>`;
}
