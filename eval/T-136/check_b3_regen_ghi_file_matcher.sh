#!/usr/bin/env bash
# T-136 tiêu chí 6 (móc vào luồng pool): chạy NGUYÊN VĂN `bash tools/regen-pool-styles.sh --back <bản chép back>` (cách T-131/check.sh: chép hai repo vào thư mục tạm, không đụng bản gốc, không mạng)
# rồi: <back>/matcher-service/vendors.json tồn tại, định dạng {"vendors":[...]}, tập id == tập id của <back>/lib/vendorPool.generated.js sau khi tạo lại (không thừa, không thiếu).
# Chạy: bash eval/T-136/check_b3_regen_ghi_file_matcher.sh   (TOHONG_REPO, TOHONG_BACK_REPO; mặc định /home/user/tohong, /home/user/tohong-back)
set -u
T="${TOHONG_REPO:-/home/user/tohong}"; B="${TOHONG_BACK_REPO:-/home/user/tohong-back}"
W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT
mkdir -p "$W/t" "$W/b"; (cd "$T" && tar --exclude=./node_modules --exclude=./.git -cf - .) | (cd "$W/t" && tar xf -); (cd "$B" && tar --exclude=./.git -cf - .) | (cd "$W/b" && tar xf -)
[ -e "$W/t/node_modules" ] || { [ -d "$T/node_modules" ] && ln -s "$T/node_modules" "$W/t/node_modules"; }
rm -f "$W/b/matcher-service/vendors.json"
( cd "$W/t" && bash tools/regen-pool-styles.sh --back "$W/b" ) >"$W/regen.log" 2>&1 || { echo "FAIL regen-pool-styles.sh lỗi"; tail -3 "$W/regen.log"; exit 1; }
python3 -I - "$W/b" <<'PY'
import json, os, sys
b = sys.argv[1]; f = os.path.join(b, "matcher-service", "vendors.json")
if not os.path.isfile(f): print("FAIL regen không sinh matcher-service/vendors.json"); sys.exit(1)
s = open(os.path.join(b, "lib", "vendorPool.generated.js"), encoding="utf-8").read()
pool = [v["id"] for v in json.loads(s[s.index("= [") + 2:s.rindex("]") + 1])]
d = json.load(open(f, encoding="utf-8")); ids = [v["id"] for v in d["vendors"]]
if set(ids) != set(pool) or len(ids) != len(set(ids)): print(f"FAIL id file matcher != id pool (pool {len(pool)}, file {len(ids)}, thừa {len(set(ids)-set(pool))}, thiếu {len(set(pool)-set(ids))})"); sys.exit(1)
print("PASS")
PY
