#!/usr/bin/env bash
set -euo pipefail

# Build a changed-file list for --files-from under RUNNER_TEMP so we never
# overwrite a tracked changed.txt in the consumer checkout. Paths are relative
# to the composite step's working-directory.

if [ -z "${RUNNER_TEMP:-}" ]; then
	echo "patdown: RUNNER_TEMP is unset; cannot write the changed-file list" >&2
	exit 1
fi

list_path="${RUNNER_TEMP}/patdown-changed-files.txt"

if [ "${GITHUB_EVENT_NAME}" = "pull_request" ]; then
	BASE="${PULL_REQUEST_BASE_SHA}"
else
	BASE="${GITHUB_EVENT_BEFORE:-}"
	if [ "$BASE" = "0000000000000000000000000000000000000000" ] || [ -z "$BASE" ]; then
		BASE="$(git rev-parse HEAD^)"
	fi
fi

# --relative: paths are relative to cwd (the action working-directory), and
# changes outside that directory are dropped.
git diff --relative --name-only --diff-filter=ACMR "$BASE"...HEAD > "$list_path"

if [ ! -s "$list_path" ]; then
	echo "No changed files."
fi

cat "$list_path"

if [ -n "${GITHUB_OUTPUT:-}" ]; then
	echo "files-from=${list_path}" >> "$GITHUB_OUTPUT"
fi
