#!/usr/bin/env bash
# Usage: bash "${CLAUDE_SKILL_DIR}/scripts/module-imports.sh" <src-dir-containing-modules/>   (e.g. src or apps/api/src)
# Prints one line per cross-module import: "<from-module> -> <to-module>  (<file>:<line>)"
# then flags module pairs that import each other (a dependency cycle).
set -euo pipefail
root="${1:?path to a src dir that contains modules/}"
mods="$root/modules"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
for f in $(find "$mods" -name '*.ts' ! -name '*.test.ts' | sort); do
  from="$(echo "${f#$mods/}" | cut -d/ -f1)"
  { grep -nE "from '\.\./[a-z0-9_-]+/" "$f" || true; } | { grep -v "from '\.\./\.\./" || true; } | while IFS= read -r hit; do
    line="${hit%%:*}"
    to="$(echo "$hit" | sed -E "s/.*from '\.\.\/([a-z0-9_-]+)\/.*/\1/")"
    [ "$to" = "$from" ] && continue
    echo "$from -> $to  (${f#$root/}:$line)" | tee -a "$tmp"
  done
done
echo "--- cycles (A -> B and B -> A) ---"
awk '{print $1" "$3}' "$tmp" | sort -u | awk '{ if (e[$2" "$1]) print $2" <-> "$1; e[$1" "$2]=1 }' || true
