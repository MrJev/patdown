#!/usr/bin/env bash
set -euo pipefail

# Build a cwd-relative changed-file list for --files-from. Empty files still mean
# patdown: passed after filtering.

if [ "${GITHUB_EVENT_NAME}" = "pull_request" ]; then
	BASE="${PULL_REQUEST_BASE_SHA}"
else
	BASE="${GITHUB_EVENT_BEFORE:-}"
	if [ "$BASE" = "0000000000000000000000000000000000000000" ] || [ -z "$BASE" ]; then
		BASE="$(git rev-parse HEAD^)"
	fi
fi

git diff --name-only --diff-filter=ACMR "$BASE"...HEAD > changed.txt

if [ ! -s changed.txt ]; then
	echo "No changed files."
fi

cat changed.txt
