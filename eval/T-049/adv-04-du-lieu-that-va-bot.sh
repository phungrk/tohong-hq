#!/usr/bin/env bash
# Adversary T-049: dữ liệu sổ cái thật (scripts/export_dashboard.py) cộng khối model số lớn (chữ khối dài, có hàng "khác" trong cây bể), và dữ liệu BUSY của inv char (nhiều bot). Đo ngay, sau 5s, và sau đổi cỡ, ở 1280, 844, 390, 390 phóng to: mũi không che chữ, không đè bot, mọi kiểm tra MEASURE T-047.
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"; H="$(cd "$(dirname "$0")" && pwd)"
OUT="$(mktemp -d)"; ( cd "$H/../.." && python3 scripts/export_dashboard.py --out "$OUT" >/dev/null ) || { echo "FAIL không xuất được dashboard.json"; exit 1; }
exec node -e '
const fs=require("fs");const A=require(process.argv[1]);const real=JSON.parse(fs.readFileSync(process.argv[2]+"/dashboard.json","utf8"));
real.model={invariants:{"_shared":2,"hq/dashboard/model":31,"planner/chat":12,"planner/budget":9,"hq/scripts":7},invariants_total:999,adversarial_evals:888,regression_evals:777,insight_reports:123,last_insight:"2026-11-02T08:00",specs:456};
const s=fs.readFileSync(process.argv[3],"utf8").split("\n").slice(19,34).join("\n");const M=new Function(s+";return {BUSY,dash};")();
(async()=>{const b=await A.chromium.launch();
for(const [name,data] of [["sổ cái thật + số lớn",real],["BUSY",M.dash(M.BUSY())]])
for(const [w,h,z] of [[1280,900,0],[844,900,0],[390,844,0],[390,844,1]]){const {ctx,page,errs}=await A.open(b,{width:w,height:h},{data});if(z)await A.zoom(page);
 const nb=await page.evaluate(()=>document.querySelectorAll("g.mch").length);
 A.show(`${name} ${w}${z?" phóng to":""} bot=${nb} t0`,await A.meas(page),null);await page.waitForTimeout(5000);A.show(`  t+5s`,await A.meas(page),null);
 await page.setViewportSize({width:w===1280?390:1280,height:844});await page.waitForTimeout(800);A.show(`  sau đổi cỡ`,await A.meas(page),null,"errs="+errs.length);if(errs.length){A.fail();console.log(errs.slice(0,3))}await ctx.close();}
await b.close();A.done();})();' "$H/lib/adv.cjs" "$OUT" "$H/../invariants/hq/dashboard/model/lib/char_inv.cjs"
