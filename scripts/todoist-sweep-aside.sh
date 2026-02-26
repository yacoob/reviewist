#!/usr/bin/env bash
#
# Closes uncompletable (* ) tasks from the Aside project that are due today.
# Designed for daily cron execution. Silent on success, prints errors to stderr.
#
# set -x
set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "-n" ]] && DRY_RUN=true

# Check dependencies
for cmd in curl jq; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "${cmd} is required but not found" >&2
    exit 1
  }
done

# Require API token
: "${TODOIST_API_TOKEN:?TODOIST_API_TOKEN not set}"

API="https://api.todoist.com/api/v1"
AUTH="Authorization: Bearer ${TODOIST_API_TOKEN}"
FILTER="$(printf '%s' '#Aside & today & uncompletable' | jq -sRr @uri)"

# Fetch matching task IDs
ids=$(curl -sf -H "$AUTH" "${API}/tasks/filter?query=${FILTER}" | jq -r '.results[]?.id // empty')

# Close each task (POST /tasks/{id}/close returns 204, idempotent for already-closed tasks)
for id in $ids; do
  if $DRY_RUN; then
    echo "${API}/tasks/${id}/close"
  else
    curl -sf -X POST -H "$AUTH" "${API}/tasks/${id}/close" || {
      echo "Failed to close task ${id}" >&2
      exit 1
    }
  fi
done
