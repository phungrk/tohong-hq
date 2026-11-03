#!/usr/bin/env bash
# Adversary T-049: đổi trạng thái lúc chạy (không tải lại): đổi cỡ 8 lần/30ms rồi dừng 390 và 1280; phóng to bật/tắt 5 lần ở 390 và ở 844; xoay 844x390; tối bật lúc chạy; DPR 2 và 3 ở 390; reduced-motion + tối + phóng to. Mọi kiểm tra MEASURE T-047; nhãn về đúng vị trí gốc sau khi về 1280.
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"; H="$(cd "$(dirname "$0")" && pwd)"
exec node -e '
const A=require(process.argv[1]);(async()=>{const b=await A.chromium.launch();const w8=t=>new Promise(s=>setTimeout(s,t));
{const {ctx,page}=await A.open(b,{width:1280,height:900});
 for(const w of [390,1280,800,320,1024,390,1280,600]){await page.setViewportSize({width:w,height:844});await w8(30);}
 await page.setViewportSize({width:390,height:844});await w8(700);A.show("đổi cỡ nhanh -> 390",await A.meas(page),null);
 await page.setViewportSize({width:1280,height:900});await w8(700);A.show("-> 1280",await A.meas(page),null);
 const mv=await page.evaluate(()=>[...document.querySelectorAll("#model text.lbl")].filter(t=>t.getAttribute("x")!=t.getAttribute("data-x0")||t.getAttribute("y")!=t.getAttribute("data-y0")).map(t=>t.textContent));
 const ref=await (async()=>{const o=await A.open(b,{width:1280,height:900});const r=await o.page.evaluate(()=>[...document.querySelectorAll("#model text.lbl")].filter(t=>t.getAttribute("x")!=t.getAttribute("data-x0")||t.getAttribute("y")!=t.getAttribute("data-y0")).map(t=>t.textContent));await o.ctx.close();return r})();
 const same=JSON.stringify(mv)===JSON.stringify(ref);if(!same)A.fail();console.log(`${same?"PASS":"FAIL"} nhãn nhích ở 1280 sau chuỗi đổi cỡ giống lúc tải mới: ${JSON.stringify(mv)} vs ${JSON.stringify(ref)}`);await ctx.close();}
for(const w of [390,844]){const {ctx,page}=await A.open(b,{width:w,height:844});for(let i=0;i<5;i++){await page.click("#model-zoom");await w8(50);}await w8(800);A.show(`${w} phóng to x5 (bật)`,await A.meas(page),null);
 await page.click("#model-zoom");await w8(700);A.show(`${w} tắt phóng to`,await A.meas(page),null);await ctx.close();}
{const {ctx,page}=await A.open(b,{width:390,height:844});await page.setViewportSize({width:844,height:390});await w8(700);A.show("xoay 844x390",await A.meas(page),null);await ctx.close();}
{const {ctx,page}=await A.open(b,{width:1280,height:900});await page.emulateMedia({colorScheme:"dark"});await w8(300);A.show("tối bật lúc chạy 1280",await A.meas(page),null);await ctx.close();}
for(const dpr of [2,3]){const {ctx,page}=await A.open(b,{width:390,height:844},{dpr});A.show("390 DPR"+dpr,await A.meas(page),null);await ctx.close();}
{const {ctx,page,errs}=await A.open(b,{width:390,height:844},{reduce:1,dark:1});await A.zoom(page);A.show("reduced-motion + tối + phóng to 390",await A.meas(page),null,"errs="+errs.length);if(errs.length)A.fail();await ctx.close();}
await b.close();A.done();})();' "$H/lib/adv.cjs"
