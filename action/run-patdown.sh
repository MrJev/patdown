#!/usr/bin/env bash
set -euo pipefail

# Thin wrapper around the published patdown CLI. Output shape stays with the CLI
# or with an embedded PatdownOutput layer; this script only chooses args.

version="${PATDOWN_VERSION:-}"
if [ -z "$version" ]; then
	version="$(node -p "require('${GITHUB_ACTION_PATH}/apps/patdown/package.json').version")"
fi

files_from="${PATDOWN_FILES_FROM:-}"
if [ -z "$files_from" ]; then
	files_from="changed.txt"
fi

args=(--files-from "$files_from")

if [ "${PATDOWN_VERBOSE:-true}" = "true" ]; then
	args+=(--verbose)
fi

if [ "${PATDOWN_NO_GITHUB:-false}" = "true" ]; then
	args+=(--no-github)
fi

if [ -n "${PATDOWN_RULES:-}" ]; then
	args+=(--rules "$PATDOWN_RULES")
fi

if [ -n "${PATDOWN_GITHUB_ANNOTATION:-}" ]; then
	args+=(--github-annotation "$PATDOWN_GITHUB_ANNOTATION")
fi

if [ -n "${PATDOWN_YES_THRESHOLD:-}" ]; then
	args+=(--yes-threshold "$PATDOWN_YES_THRESHOLD")
fi

echo "patdown: running patdown@${version}"
npx --yes "patdown@${version}" "${args[@]}"
