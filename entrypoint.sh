#!/bin/sh
set -eu

cd "$(dirname "$0")"
export WORLD_TREE_HOST="${WORLD_TREE_HOST:-0.0.0.0}"
exec node server.mjs
