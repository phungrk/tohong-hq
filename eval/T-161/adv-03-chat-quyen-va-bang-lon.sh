#!/usr/bin/env bash
set -u
exec node "$(cd "$(dirname "$0")" && pwd)/adv-03-chat-quyen-va-bang-lon.mjs" "$@"
