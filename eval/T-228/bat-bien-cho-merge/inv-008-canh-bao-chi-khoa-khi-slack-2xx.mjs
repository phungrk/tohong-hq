// Nguồn: T-228 (spec products/T-228-canh-bao-slack-chi-khoa-khi-2xx.md, hành vi 2; ADR-148, ADR-149; rút bởi spec-critic khi spec qua Spec Gate v1, từ check_1).
// Vùng: planner/back/chat. Chờ merge PR T-228; Chief of Staff đưa file này và lib/t228_* vào eval/invariants/planner/back/chat/ (cạnh lib/ đã có) sau merge.
// Bất biến: cảnh báo chỉ được tính là đã gửi (khoá chống lặp) khi Slack trả 2xx. Slack trả mã không phải 2xx (500, 429, 404) hay ném lỗi mạng
// ở tin đạt ngưỡng thì tin chat lỗi kế tiếp (ngưỡng vẫn đạt) phải POST lại. Đối chứng không chân không: Slack 2xx thì tin kế tiếp im lặng.
// Không gắn tham số vận hành (ngưỡng, 60 phút, 10 giây): trạng thái được dồn tới khi có POST đầu tiên, tối đa 30 tin, rồi mới kiểm tin kế.
// Offline (fetch giả, KV giả tệp, mỗi tin một tiến trình). Repo back: TOHONG_BACK_REPO, rồi ../tohong-back cạnh gốc HQ. Thoát 0 = đạt.
import { chat, newKv, check, done, T0 } from "./lib/t228_harness.mjs";
const fails = [];
function scenario(first) {
  const kv = newKv(); let t = 0;
  for (let i = 0; i < 30; i++) {
    const o = chat({ kvFile: kv, now: T0 + ++t * 1000, slack: first });
    if (o.slackPosts.length) return chat({ kvFile: kv, now: T0 + ++t * 1000, slack: "ok" }).slackPosts.length;
  }
  return null;
}
for (const bad of [500, 429, 404, "throw"]) {
  const n = scenario(bad);
  check(fails, n === 1, `Slack ${bad} ở lần cảnh báo đầu: tin lỗi kế tiếp POST lại đúng 1 lần (nhận ${n === null ? "không có cảnh báo nào trong 30 tin" : n})`);
}
for (const good of [200, 204]) {
  const n = scenario(good);
  check(fails, n === 0, `đối chứng Slack ${good}: tin lỗi kế tiếp im lặng (nhận ${n === null ? "không có cảnh báo nào trong 30 tin" : n})`);
}
done(fails);
