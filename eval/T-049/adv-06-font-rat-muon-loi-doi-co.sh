#!/usr/bin/env bash
# Adversary T-049 v2: ba ca biên của việc dựng lại khi font nạp (da7718a):
#  (a) Be Vietnam Pro thật tải rất muộn (8s): đo ở 6s (chưa có font) và 9,5s (đã nạp) ở 375x667 và 390 phóng to: mọi kiểm tra MEASURE T-047 xanh cả hai lúc;
#  (b) font lỗi (gstatic trả 404 / byte rác): không lỗi JS (pageerror), mũi và nhãn vẫn đúng ở 375 và 1280 (lỗi mạng "Failed to load resource"/"downloadable font" không tính);
#  (c) đổi cỡ liên tục (360..420px mỗi 80ms trong 4s) đúng lúc font nạp ở 2,5s, dừng ở 375: MEASURE xanh và vị trí nhãn trùng với lần tải mới đã có font.
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"; H="$(cd "$(dirname "$0")" && pwd)"
exec node -e '
const fs=require("fs"),os=require("os"),path=require("path");const A=require(process.argv[1]);const font=process.argv[2];
const junk=path.join(os.tmpdir(),"t049-junk.ttf");fs.writeFileSync(junk,Buffer.from("khong phai font ".repeat(64)));
const pos=p=>p.evaluate(()=>[...document.querySelectorAll("#model text.lbl")].map(t=>t.textContent+"@"+t.getAttribute("x")+","+t.getAttribute("y")).join("|"));
const jsErr=e=>e.filter(s=>!/Failed to load resource|downloadable font|OTS parsing/i.test(s));
(async()=>{const b=await A.chromium.launch();
for(const [w,h,z] of [[375,667,0],[390,844,1]]){const {ctx,page,errs}=await A.open(b,{width:w,height:h},{font,fontDelay:8000});if(z)await A.zoom(page);
 await page.waitForTimeout(z?3700:4500);A.show(`(a) font 8s, lúc 6s ${w}${z?" phóng to":""}`,await A.meas(page),null);
 await page.waitForTimeout(3500);const ok=await page.evaluate(()=>[...document.fonts].some(f=>f.family.includes("Be Vietnam")&&f.status==="loaded"));if(!ok||jsErr(errs).length)A.fail();
 A.show(`(a) font 8s, lúc 9,5s ${w}${z?" phóng to":""}`,await A.meas(page),null,`font nạp=${ok} errs=${jsErr(errs).length}`);await ctx.close();}
for(const [kind,f] of [["404",null],["byte rác",junk]])for(const [w,h] of [[375,667],[1280,900]]){
 const o=await A.open(b,{width:w,height:h},{font:f||font,fontDelay:500,fontFail:!f});await o.page.waitForTimeout(1500);
 const st=await o.page.evaluate(()=>[...document.fonts].filter(x=>x.family.includes("Be Vietnam")).map(x=>x.status).join(","));if(jsErr(o.errs).length)A.fail();
 A.show(`(b) font lỗi ${kind} ${w}`,await A.meas(o.page),null,`trạng thái font=${st} lỗi JS=${jsErr(o.errs).length}`);await o.ctx.close();}
{const ref=await A.open(b,{width:375,height:667},{font,fontDelay:100});await ref.page.waitForTimeout(1500);const p0=await pos(ref.page);await ref.ctx.close();
 const {ctx,page,errs}=await A.open(b,{width:375,height:667},{font,fontDelay:2500,settle:300});const t0=Date.now();let i=0;
 while(Date.now()-t0<4000){await page.setViewportSize({width:360+(i++*7)%61,height:667});await page.waitForTimeout(80);}
 await page.setViewportSize({width:375,height:667});await page.waitForTimeout(900);A.show(`(c) đổi cỡ ${i} lần lúc font nạp -> 375`,await A.meas(page),null,`errs=${jsErr(errs).length}`);
 const p1=await pos(page);const same=p0===p1;if(!same||jsErr(errs).length)A.fail();console.log(`${same?"PASS":"FAIL"} (c) vị trí nhãn trùng lần tải mới có font`+(same?"":`\n   mới: ${p0}\n   sau: ${p1}`));await ctx.close();}
await b.close();A.done();})();' "$H/lib/adv.cjs" "$H/lib/BeVietnamPro-Regular.ttf"
