if(!self.define){let o,e={};const r=(r,n)=>(r=new URL(r+".js",n).href,e[r]||new Promise((e=>{if("document"in self){const o=document.createElement("script");o.src=r,o.onload=e,document.head.appendChild(o)}else o=r,importScripts(r),e()})).then((()=>{let o=e[r];if(!o)throw new Error(`Module ${r} didn’t register its module`);return o})));self.define=(n,s)=>{const i=o||("document"in self?document.currentScript.src:"")||location.href;if(e[i])return;let l={};const a=o=>r(o,i),t={module:{uri:i},exports:l,require:a};e[i]=Promise.all(n.map((o=>t[o]||a(o)))).then((o=>(s(...o),l)))}}define(["./workbox-03ef139c"],(function(o){"use strict";o.setCacheNameDetails({prefix:"war-on-board"}),self.addEventListener("message",(o=>{o.data&&"SKIP_WAITING"===o.data.type&&self.skipWaiting()})),o.precacheAndRoute([{url:"/war-on-board/css/app.2d054d80.css",revision:null},{url:"/war-on-board/css/chunk-vendors.e54b9e1d.css",revision:null},{url:"/war-on-board/fonts/materialdesignicons-webfont.3de8526e.woff",revision:null},{url:"/war-on-board/fonts/materialdesignicons-webfont.477c6ab0.woff2",revision:null},{url:"/war-on-board/fonts/materialdesignicons-webfont.48a1ce0c.eot",revision:null},{url:"/war-on-board/fonts/materialdesignicons-webfont.dfd403cf.ttf",revision:null},{url:"/war-on-board/index.html",revision:"6646bffcec48ee249025b13f6b5f6574"},{url:"/war-on-board/js/app.4bcba45d.js",revision:null},{url:"/war-on-board/js/chunk-vendors.df646629.js",revision:null},{url:"/war-on-board/js/webfontloader.3bcb350a.js",revision:null},{url:"/war-on-board/manifest.json",revision:"3c51975481e21c61633b738c9712fb75"},{url:"/war-on-board/robots.txt",revision:"b6216d61c03e6ce0c9aea6ca7808f7ca"}],{})}));
//# sourceMappingURL=service-worker.js.map
