// Phần dựng "twin" dùng chung cho planner/vendor inv-004, inv-005, inv-006 (ADR-139 bổ sung điểm 6, cùng cách làm ADR-131).
// Không phải bất biến (gate.py chỉ chạy file bắt đầu bằng "inv-"). Không đo gì, chỉ dựng tình huống.
// Trước đây các bất biến lọc pool thật lấy venue có rating === 0 && styles.length === 0 (+ isVerified, HCMC, đủ 12 tháng).
// Sau Sync T-216, pool thật không còn venue nào có styles rỗng, nên phần dựng ném lỗi. Bản này không đòi pool có sẵn vendor như vậy:
// lấy n vendor thật của hạng mục theo thứ tự id (ổn định, không phụ thuộc thứ tự pool), giữ id và tên thật của từng vendor,
// rồi chép MỌI trường khác từ một vendor gốc (vendor có id nhỏ nhất của hạng mục) và đặt lại đúng các trường mà bộ lọc cũ đòi:
// rating 0, reviewCount 0, styles [] (tags [] theo styles), isVerified, HCMC, đủ 12 tháng; venue có sức chứa 100–300 như twin cũ.
// Kết quả: các twin giống hệt nhau trừ id/tên (đúng ý "chỉ khác giá/nguồn" của khung T-172), và giống tình trạng twin của pool trước T-216.
// Chỉ sửa mảng pool trong bản sao tạm của back (stampedBack.mut); không đụng repo sản phẩm.
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
export function makeTwins(arr, cat, n, used = {}) {
  const all = arr.filter((v) => v.category === cat).sort(byId);
  const pick = all.filter((v) => !used[v.id]).slice(0, n);
  if (!all.length || pick.length < n) throw new Error(`_twin: pool chỉ có ${pick.length} vendor hạng mục ${cat} chưa dùng, cần ${n}`);
  const base = structuredClone(all[0]);
  for (const v of pick) {
    const { id, name } = v;
    for (const k of Object.keys(v)) delete v[k];
    Object.assign(v, structuredClone(base), { id, name, isVerified: true, city: "HCMC", availability: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], rating: 0, reviewCount: 0, styles: [], tags: [] });
    if (cat === "venue") v.capacity = { min: 100, max: 300 }; else delete v.capacity;
    used[id] = 1;
  }
  return pick;
}
