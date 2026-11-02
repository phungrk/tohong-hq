const fs=require('fs');const {open,meas,show,chromium}=require('./adv_probe.cjs');
const s=fs.readFileSync('/home/user/tohong-hq/eval/invariants/dashboard/model/lib/char_inv.cjs','utf8').split('\n').slice(19,34).join('\n');
const M=new Function(s+';return {BUSY,dash};')();
(async()=>{const b=await chromium.launch();
for(const [vp,z] of [[{width:1280,height:900},0],[{width:390,height:844},0],[{width:390,height:844},1],[{width:320,height:700},0]]){
 const {ctx,page,errs}=await open(b,vp,{data:M.dash(M.BUSY())});if(z){await page.click('#model-zoom');await page.waitForTimeout(800);}
 const nb=await page.evaluate(()=>document.querySelectorAll('g.mch').length);
 for(const t of [0,4000,8000]){await page.waitForTimeout(t?4000:0);show(`busy ${vp.width}${z?' zoom':''} bots=${nb} t+${t}`,await meas(page));}
 await page.setViewportSize({width:vp.width===1280?390:1280,height:844});await page.waitForTimeout(800);show('  after resize',await meas(page));
 if(errs.length)console.log('errs',errs.slice(0,3));await ctx.close();}
await b.close();})();
