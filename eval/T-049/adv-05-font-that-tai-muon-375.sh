#!/usr/bin/env bash
# Adversary T-049 (evalplus): đường thật ở production. Font "Be Vietnam Pro" thật (lib/BeVietnamPro-Regular.ttf, OFL) tải muộn 2,5s,
# tức sau khi mũi và nhãn đã dựng bằng font dự phòng (eval tầng 1 chặn font nên chưa bao giờ đo font thật).
# Mong đợi (spec T-047 mục 4, T-039 4.1 "không che chữ", 1.3 "cỡ giống nhau ở mọi viewport"): sau khi font nạp, ở 375x667 (iPhone SE/8), 412x915, 390x844, 390 phóng to, 844, 1280:
# mọi kiểm tra MEASURE T-047 xanh (không che chữ, nhãn chỉ nhích khi chạm, cỡ, tỉ lệ, nét...); ở 360x800 không mũi nào che chữ (K1).
# Trên PR #16 @006098d: 375x667 đỏ: mũi cuối p_gate_kr che nhãn "spec đã duyệt" 2,2u (dfe8a20 xanh ở 375: hồi quy do mũi to hơn); 360 đỏ 2,0u.
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"; H="$(cd "$(dirname "$0")" && pwd)"
exec node -e '
const A=require(process.argv[1]);const font=process.argv[2];(async()=>{const b=await A.chromium.launch();
for(const [w,h,z,codes] of [[375,667,0,null],[412,915,0,null],[390,844,0,null],[390,844,1,null],[844,900,0,null],[1280,900,0,null],[360,800,0,["C4.text"]]]){
 const {ctx,page,errs}=await A.open(b,{width:w,height:h},{font,fontDelay:2500});if(z)await A.zoom(page);await page.waitForTimeout(3300);
 const ok=await page.evaluate(()=>[...document.fonts].some(f=>f.family.includes("Be Vietnam")&&f.status==="loaded"));if(!ok||errs.length)A.fail();
 A.show(`Be Vietnam Pro tải muộn ${w}x${h}${z?" phóng to":""}${codes?" (chỉ K1)":""}`,await A.meas(page),codes,`font nạp=${ok} errs=${errs.length}`);await ctx.close();}
await b.close();A.done();})();' "$H/lib/adv.cjs" "$H/lib/BeVietnamPro-Regular.ttf"
