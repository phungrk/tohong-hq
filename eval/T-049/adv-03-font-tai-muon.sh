#!/usr/bin/env bash
# Adversary T-049: font "Be Vietnam Pro" tải muộn 2,5s và rộng hơn mặc định (thay bằng DejaVu Sans / DejaVu Sans Mono): chữ rộng ra sau khi mũi đã dựng. Ở 1280, 844, 390, 390 phóng to: mũi không che chữ (K1), nhãn chỉ nhích khi chạm (K8), cỡ và các kiểm tra khác giữ.
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"; H="$(cd "$(dirname "$0")" && pwd)"
exec node -e '
const A=require(process.argv[1]);(async()=>{const b=await A.chromium.launch();
for(const font of ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf","/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"])
for(const [w,h,z] of [[1280,900,0],[844,900,0],[390,844,0],[390,844,1]]){const {ctx,page}=await A.open(b,{width:w,height:h},{font});if(z)await A.zoom(page);await page.waitForTimeout(3200);
 const ok=await page.evaluate(()=>[...document.fonts].some(f=>f.family.includes("Be Vietnam")&&f.status==="loaded"));if(!ok)A.fail();
 A.show(`font muộn ${font.split("/").pop()} ${w}${z?" phóng to":""}`,await A.meas(page),null,"font nạp="+ok);await ctx.close();}
await b.close();A.done();})();' "$H/lib/adv.cjs"
