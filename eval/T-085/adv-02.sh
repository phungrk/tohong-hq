#!/usr/bin/env bash
# T-085 eval đối kháng 02: actionlint (kiểm context availability, cú pháp expression, kiểu inputs).
# Dùng $ACTIONLINT hoặc actionlint trong PATH; không có thì thử cài actionlint-py vào thư mục tạm.
# Cài không được -> ERROR (exit 2), không tự coi là PASS.
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
AL="${ACTIONLINT:-$(command -v actionlint || true)}"
if [ -z "$AL" ]; then
  T="$(mktemp -d)"
  pip install -q --target "$T" actionlint-py >/dev/null 2>&1 && AL="$T/bin/actionlint"
fi
[ -x "${AL:-}" ] || { echo "ERROR không có actionlint"; exit 2; }
if out="$("$AL" -shellcheck= "$ROOT"/.github/workflows/*.yml 2>&1)"; then
  echo "PASS actionlint sạch mọi workflow"
else
  echo "FAIL"; echo "$out"; exit 1
fi
