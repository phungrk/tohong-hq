#!/usr/bin/env bash
set -u
exec node "$(cd "$(dirname "$0")" && pwd)/adv-04-cache-cau-ai-theo-vendor.mjs" "$@"
