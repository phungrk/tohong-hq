#!/usr/bin/env bash
# Adversary T-049 v2: việc dựng lại khi font nạp (da7718a) không làm dot hay nhân vật giật/nhân đôi.
# 10 sự kiện trực tiếp qua WebSocket, cách nhau 350ms, (dot + nhân vật giao/nhận) chạy qua đúng lúc Be Vietnam Pro nạp (2,5s), dữ liệu BUSY (11 bot), ở 1280 và 375. Lấy mẫu mỗi khung hình trong 9s:
#  phải có ít nhất 1 lần dựng lại lớp #arrows trong lúc có dot đang hiện (không thì đỏ: kịch bản không chạm tới);
#  không giật theo chuẩn của vùng (T-028: không có hai khung liên tiếp cách nhau quá 300 ms), kể cả khung dựng lại; số dot ≤ 10 đã phát, về 0 khi xong;
#  (in thêm, không chấm: tốc độ dot tệ nhất so với trung vị của đoạn; trên da7718a lần dựng lại là một longtask ~110-130ms, dot đứng rồi đuổi kịp ~7u, dưới ngưỡng 300ms);
#  đúng 1 lớp #arrows và 30 mũi tên mọi khung; nhân vật (g.mch) không bị tạo lại/nhân đôi: cùng phần tử DOM, cùng số, không trùng data-block, mọi khung.
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"; H="$(cd "$(dirname "$0")" && pwd)"
exec node -e '
const fs=require("fs");const A=require(process.argv[1]);const font=process.argv[2];
const s=fs.readFileSync(process.argv[3],"utf8").split("\n").slice(19,34).join("\n");const M=new Function(s+";return {BUSY,dash,live};")();
(async()=>{const b=await A.chromium.launch();
for(const [w,h] of [[1280,900],[375,667]]){const {ctx,page,errs,send}=await A.open(b,{width:w,height:h},{font,fontDelay:2500,settle:600,until:"domcontentloaded",data:M.dash(M.BUSY())});
 const EV=[["product","spec-critic","review"],["engineering","adversary","review"],["adversary","engineering","doing"],["spec-critic","engineering","new"],["chief-of-staff","product","doing"]];
 const P=page.evaluate(()=>new Promise(res=>{const svg=document.querySelector("#model svg");
  const out={frames:0,maxDots:0,badLayer:0,badAh:0,mchBad:0,rebuildsWithDots:0,rebuilds:0,worst:0,worstAt:"",segs:0};
  let dotsNow=0;new MutationObserver(()=>{out.rebuilds++;if(dotsNow)out.rebuildsWithDots++}).observe(svg.querySelector("#arrows"),{childList:true});
  const mch0=[...svg.querySelectorAll("g.mch")];const seg=new Map();let last=performance.now();const t0=last;
  const close=c=>{const q=seg.get(c);if(!q)return;seg.delete(c);if(q.r.length<5)return;out.segs++;const m=q.r.slice().sort((a,b)=>a-b)[q.r.length>>1];const mx=Math.max(...q.r);if(m>0&&mx/m>out.worst){out.worst=mx/m;out.worstAt=`${mx.toFixed(3)} vs trung vị ${m.toFixed(3)} u/ms`}};
  const f=now=>{const dt=now-last;last=now;out.frames++;if(out.frames>1)out.maxGap=Math.max(out.maxGap||0,dt);const cs=[...svg.querySelectorAll("#fx_f circle")];out.maxDots=Math.max(out.maxDots,cs.length);
   dotsNow=cs.filter(c=>+c.getAttribute("opacity")>0).length;
   if(svg.querySelectorAll("#arrows").length!==1)out.badLayer++;if(svg.querySelectorAll("[data-part=ah]").length!==30)out.badAh++;
   for(const c of cs){const x=+c.getAttribute("cx"),y=+c.getAttribute("cy"),o=+c.getAttribute("opacity");
     if(!(o>=1)){close(c);continue}const q=seg.get(c);if(q&&dt>0){q.r.push(Math.hypot(x-q.x,y-q.y)/dt);q.x=x;q.y=y}else seg.set(c,{x,y,r:[]})}
   for(const c of [...seg.keys()])if(!c.isConnected)close(c);
   const ms=[...svg.querySelectorAll("g.mch")];const ids=ms.map(m=>m.getAttribute("data-block"));if(ms.length!==mch0.length||ms.some((m,i)=>m!==mch0[i])||new Set(ids).size!==ids.length)out.mchBad++;
   if(now-t0<9000)requestAnimationFrame(f);else{[...seg.keys()].forEach(close);out.endDots=svg.querySelectorAll("#fx_f circle").length;out.nMch=mch0.length;res(out)}};
  requestAnimationFrame(f)}));
 for(let i=0;i<10;i++){const [f,t,st]=EV[i%5];send(M.live({task:"T-"+(i%9+1),event:i%5==2?"evalplus":"handoff",from:f,to:t,state:st,holder:t,owner:t}));await page.waitForTimeout(350);}
 const r=await P;const bad=[];
 if(!r.rebuildsWithDots)bad.push(`không có lần dựng lại nào lúc dot đang chạy (dựng lại ${r.rebuilds} lần) - kịch bản không chạm`);
 if(r.maxGap>300)bad.push(`giật: hai khung cách ${r.maxGap.toFixed(0)}ms > 300ms`);if(!r.segs)bad.push("không có dot nào chạy để đo");if(r.maxDots>10)bad.push(`có ${r.maxDots} dot > 10 đã phát (nhân đôi)`);if(r.endDots)bad.push(`còn ${r.endDots} dot sau 9s`);
 if(r.badLayer)bad.push(`${r.badLayer} khung số lớp #arrows ≠ 1`);if(r.badAh)bad.push(`${r.badAh} khung số mũi ≠ 30`);if(r.mchBad)bad.push(`${r.mchBad} khung nhân vật bị tạo lại/nhân đôi`);if(errs.length)bad.push("lỗi console: "+errs[0]);
 if(bad.length)A.fail();console.log(`${bad.length?"FAIL":"PASS"} ${w}: ${r.frames} khung, ${r.segs} đoạn dot, dựng lại ${r.rebuilds} lần (${r.rebuildsWithDots} lúc có dot), bot=${r.nMch}, khung dài nhất ${r.maxGap.toFixed(0)}ms, tốc độ dot tệ nhất ${r.worst.toFixed(1)}x trung vị ${bad.join("; ")}`);await ctx.close();}
await b.close();A.done();})();' "$H/lib/adv.cjs" "$H/lib/BeVietnamPro-Regular.ttf" "$H/../invariants/hq/dashboard/model/lib/char_inv.cjs"
