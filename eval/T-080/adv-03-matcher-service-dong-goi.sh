#!/usr/bin/env bash
# Tầng 3 (adversary, T-080). Đóng gói matcher-service: dựng lại đúng bố cục image của matcher-service/Dockerfile
# (COPY matcher /app/matcher; COPY matcher-service /app/matcher-service) CHỈ từ file git theo dõi (git archive HEAD),
# rồi import engine như server.py làm (sys.path = <server>/../matcher) và chạy WeddingMatcher một lượt.
# Bắt: module mới (style_contract) chưa vào git, hoặc Dockerfile không chép nó. Repo: TOHONG_BACK_REPO, rồi cwd, rồi ../tohong-back.
set -u
REPO=""
for c in "${TOHONG_BACK_REPO:-}" "$PWD" "$PWD/../tohong-back"; do
  [ -n "$c" ] && [ -f "$c/matcher-service/Dockerfile" ] && REPO="$(cd "$c" && pwd)" && break
done
[ -z "$REPO" ] && { echo "ERROR không tìm thấy tohong-back/matcher-service"; exit 2; }
grep -qE '^COPY[[:space:]]+matcher[[:space:]]+/app/matcher$' "$REPO/matcher-service/Dockerfile" || { echo "FAIL Dockerfile không chép nguyên thư mục matcher/"; exit 1; }
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
mkdir -p "$T/app"
git -C "$REPO" archive HEAD matcher matcher-service | tar -x -C "$T/app" || { echo "FAIL git archive"; exit 1; }
OUT="$(cd "$T/app/matcher-service" && python3 -I - "$T/app/matcher-service" <<'PY' 2>&1
import sys, warnings; warnings.filterwarnings("ignore")
from pathlib import Path
sys.path.insert(0, str(Path(sys.argv[1]).resolve().parent / "matcher"))
from profile import CoupleMatchProfile
from matcher import WeddingMatcher
from match import load_vendors, make_demo_pool
from datetime import date, timedelta
p = CoupleMatchProfile(category="photography", city="HCMC", wedding_date=date.today() + timedelta(days=180),
                       budget_for_category=30_000_000, style_preferences=["korean"])
r = WeddingMatcher(make_demo_pool()).match(p, top_k=3)
print("OK", len(r.matches))
PY
)"
case "$OUT" in *"OK "*) echo "PASS image matcher-service (chỉ file git theo dõi) import được engine + style_contract và chạy match: ${OUT##*OK }";; *) echo "FAIL ${OUT: -300}"; exit 1;; esac
