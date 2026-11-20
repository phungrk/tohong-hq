"""T-217: mô phỏng Sync (regen-pool-styles.sh --photos-for all) hai lần trên bản sao tạm: A = cây làm việc hiện tại; B = cùng cây nhưng tập S đặt lại auto_scraped (nền so sánh).
So A với B tách đúng tác động của việc đánh dấu verified, không lẫn trôi dạt khác của pool nền. Dùng chung cho check_3 và check_4."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t217 as T


def simulate(full_back=False):
    """Trả (fxA, fxB, S, bản ghi nguồn theo id). Người gọi phải đóng cả hai."""
    S, vs = T.target_ids(T.tohong())
    notv = [i for i in S if next(v for v in vs if v["id"] == i).get("verification_status") != "verified"]
    if not S or notv:
        raise T.Fail(f"điều kiện đầu: {len(notv)}/{len(S)} vendor thuộc S chưa verified, chưa có gì để mô phỏng")
    A = T.R.build(full_back=full_back)
    try:
        def revert(fx):
            ss = set(S)
            def f(vs2):
                for v in vs2:
                    if v["id"] in ss:
                        v["verification_status"] = "auto_scraped"
            fx.edit_venue(f)
        B = T.R.build(prepare=revert)
    except Exception:
        A.close(); raise
    try:
        A.regen(); B.regen()
    except Exception:
        A.close(); B.close(); raise
    return A, B, S, {v["id"]: v for v in vs}
