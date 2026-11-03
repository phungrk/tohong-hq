#!/usr/bin/env bash
# Adversary T-049: bề rộng điện thoại phổ biến ngoài 390 (320, 360, 375, 412, 414; và 600, 1024), có và không phóng to, sáng: mọi kiểm tra của MEASURE T-047 (cỡ, tỉ lệ, nét còn thấy theo hệ số hiển thị, hướng, mép, che chữ, nhãn, bot).
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"; H="$(cd "$(dirname "$0")" && pwd)"
exec node -e '
const A=require(process.argv[1]);(async()=>{const b=await A.chromium.launch();
for(const [w,h] of [[320,700],[360,800],[375,667],[412,915],[414,896],[600,900],[1024,768]])for(const z of [0,1]){
  const {ctx,page,errs}=await A.open(b,{width:w,height:h});if(z)await A.zoom(page);const m=await A.meas(page);
  const sw=await page.evaluate(()=>document.documentElement.scrollWidth);if(sw>w+1||errs.length)A.fail();
  A.show(`${w}x${h}${z?" phóng to":""}`,m,null,`sc=${(m.sc||0)} scrollW=${sw} errs=${errs.length}`);await ctx.close();}
await b.close();A.done();})();' "$H/lib/adv.cjs"
