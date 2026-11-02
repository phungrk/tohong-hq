#!/usr/bin/env bash
# Bất biến công ty (ADR-011, nguồn: CLAUDE.md "Ranh giới cứng"): repo không chứa khóa API, token hay khóa riêng.
# Chạy cho MỌI việc (thư mục _shared). Đỏ = có chuỗi giống secret trong file được git theo dõi.
set -u
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT" || exit 1
PAT='sk-ant-[A-Za-z0-9_-]{20,}|phx_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[abp]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----'
HITS=$(git ls-files -z | xargs -0 grep -nIE "$PAT" 2>/dev/null | grep -v "eval/invariants/_shared/inv-001" || true)
if [ -n "$HITS" ]; then echo "FAIL chuỗi giống secret trong repo:"; echo "$HITS" | head -5; exit 1; fi
echo "PASS không có secret trong file git theo dõi"
