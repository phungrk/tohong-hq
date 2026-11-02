// Eval đối kháng T-040 (adversary): đổi cỡ liên tục, 320px, phóng to bật/tắt, xoay, tối lúc chạy, DPR 2/3, font tải muộn; đo bằng MEASURE của inv-029..031.
const fs=require('fs');const {chromium}=require('playwright');
const LIB='/home/user/tohong-hq/eval/invariants/dashboard/model/lib/t039_inv.cjs';
const src=fs.readFileSync(LIB,'utf8');const MS=src.slice(src.indexOf('const MEASURE = ')+16,src.indexOf('\n\n(async')).trim().replace(/;$/,'');
const CFG={ LEN:[5,7], WID:[4,7], GAP:[0.8,3.5], ANG:20, EXT:8, LONG:220, OVER:0.5, ONPATH:1.5 };
const D3=[process.env.D3,'/opt/npm-tools/node_modules/d3/dist/d3.min.js','/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3pkg/package/dist/d3.min.js'].find(p=>p&&fs.existsSync(p));
const INDEX=require('path').join(process.env.TOHONG_DASHBOARD_REPO||'/home/user/tohong-hq-dashboard','index.html');
const DATA={generated_at:'2026-11-01T11:00',timezone:'Asia/Ho_Chi_Minh',public:true,tasks:[],events:[],roster:[],model:{invariants:{'dashboard/model':1},invariants_total:1,adversarial_evals:0,regression_evals:0,insight_reports:0,last_insight:'',specs:0}};
const FONT=process.env.FONT; // path to font file to serve as Be Vietnam Pro
async function open(b,vp,o={}){const ctx=await b.newContext({viewport:vp,deviceScaleFactor:o.dpr||1,colorScheme:o.dark?'dark':'light'});const page=await ctx.newPage();
 const errs=[];page.on('pageerror',e=>errs.push(String(e)));page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await page.route('**/cdnjs.cloudflare.com/**',r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync(D3)}));
 await page.route('**/fonts.g*apis.com/**',async r=>{ if(!o.font) return r.fulfill({contentType:'text/css',body:''});
   r.fulfill({contentType:'text/css',body:"@font-face{font-family:'Be Vietnam Pro';font-weight:400;font-display:swap;src:url(https://fonts.gstatic.com/x.ttf) format('truetype')}@font-face{font-family:'Be Vietnam Pro';font-weight:500;font-display:swap;src:url(https://fonts.gstatic.com/x.ttf) format('truetype')}"});});
 await page.route('**/fonts.gstatic.com/**',async r=>{await new Promise(s=>setTimeout(s,o.fontDelay||2500));r.fulfill({contentType:'font/ttf',body:fs.readFileSync(o.font)});});
 await page.route('**/raw.githubusercontent.com/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(o.data||DATA)}));
 await page.routeWebSocket(/\/ws$/,ws=>{ws.send(JSON.stringify({type:'snapshot',server_time:Date.now(),events:[],activity:[]}))});
 await page.goto('file://'+INDEX);await page.waitForSelector('#model svg');await page.waitForTimeout(1500);return {ctx,page,errs};}
const meas=p=>p.evaluate(`(${MS})(${JSON.stringify(CFG)})`);
let FAILS=0;process.on('exit',c=>{if(c===0){console.log(FAILS?`FAIL ${FAILS} kịch bản có lỗi`:'PASS mọi kịch bản');process.exitCode=FAILS?1:0;}});
const show=(n,m,extra='')=>{if(m.probs.length||m.nEnd!==24||m.nMid!==6)FAILS++;console.log(`== ${n}: sc=${m.sc.toFixed(3)} end=${m.nEnd} mid=${m.nMid} probs=${m.probs.length} ${extra}`);m.probs.slice(0,8).forEach(p=>console.log('   '+p));};
module.exports={open,meas,show,chromium};
if(require.main===module)(async()=>{const b=await chromium.launch();const which=process.argv[2]||'all';
 try{
 if(which==='all'||which==='resize'){const {ctx,page}=await open(b,{width:1280,height:900});
   for(const w of [390,1280,800,320,1024,390,1280,600]){await page.setViewportSize({width:w,height:844});await page.waitForTimeout(30);}
   await page.setViewportSize({width:390,height:844});await page.waitForTimeout(700);show('rapid resize -> 390',await meas(page));
   await page.setViewportSize({width:1280,height:900});await page.waitForTimeout(700);show('-> 1280',await meas(page));
   // label positions vs original
   const lab=await page.evaluate(()=>[...document.querySelectorAll('#model text.lbl')].filter(t=>t.hasAttribute('data-x0')&&(t.getAttribute('x')!=t.getAttribute('data-x0')||t.getAttribute('y')!=t.getAttribute('data-y0'))).map(t=>t.textContent+' '+t.getAttribute('data-x0')+','+t.getAttribute('data-y0')+'->'+t.getAttribute('x')+','+t.getAttribute('y')));console.log('  labels moved @1280:',lab);if(lab.length)FAILS++;
   await ctx.close();}
 if(which==='all'||which==='320'){const {ctx,page,errs}=await open(b,{width:320,height:700});const m=await meas(page);const sw=await page.evaluate(()=>document.documentElement.scrollWidth);if(sw>320||errs.length)FAILS++;show('320',m,'scrollW='+sw);console.log('  errs',errs);
   await page.click('#model-zoom');await page.waitForTimeout(800);show('320 zoom',await meas(page));await ctx.close();}
 if(which==='all'||which==='zoomtoggle'){const {ctx,page}=await open(b,{width:390,height:844});for(let i=0;i<5;i++){await page.click('#model-zoom');await page.waitForTimeout(50);}await page.waitForTimeout(800);show('zoom x5 (on)',await meas(page));
   await page.click('#model-zoom');await page.waitForTimeout(700);show('zoom off',await meas(page));
   await page.setViewportSize({width:844,height:390});await page.waitForTimeout(700);show('rotate 844x390',await meas(page));
   await ctx.close();}
 if(which==='all'||which==='darkrt'){const {ctx,page}=await open(b,{width:1280,height:900});await page.emulateMedia({colorScheme:'dark'});await page.waitForTimeout(300);show('dark runtime toggle',await meas(page));await ctx.close();}
 if(which==='all'||which==='dpr'){for(const dpr of [2,3]){const {ctx,page}=await open(b,{width:390,height:844},{dpr});show('390 dpr'+dpr,await meas(page));await ctx.close();}}
 if(which==='all'||which==='font'){for(const vp of [{width:1280,height:900},{width:390,height:844}]){const {ctx,page}=await open(b,vp,{font:process.env.FONT||'/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'});await page.waitForTimeout(3000);
   const fam=await page.evaluate(()=>document.fonts.check("10.5px 'Be Vietnam Pro'")+' '+[...document.fonts].map(f=>f.family+':'+f.status).join(','));show('late font '+vp.width,await meas(page),fam);await ctx.close();}}
 if(which==='rework'){for(const z of [0,1]){const {ctx,page}=await open(b,{width:390,height:844});if(z){await page.click('#model-zoom');await page.waitForTimeout(800);}
   const r=await page.evaluate(()=>{const sv=document.querySelector('#model svg'),k=sv.getBoundingClientRect().width/1000;return [...sv.querySelectorAll('[data-part=ah]')].filter(e=>e.getAttribute('data-for')==='p_rework_exec').map(e=>{const bb=e.getBBox();return {at:e.getAttribute('data-at'),w:(bb.width*k).toFixed(2),h:(bb.height*k).toFixed(2)}})});console.log('rework_exec zoom='+z,JSON.stringify(r));if(r.some(a=>+a.w>5.3))FAILS++;await ctx.close();}}
 }finally{await b.close();}})();
