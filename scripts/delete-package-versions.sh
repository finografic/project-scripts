#!/usr/bin/env bash

# delete-package-versions.sh
#
# Deletes ALL published versions of @finografic/project-scripts from GitHub Packages.
# Run with --dry-run first to preview. Omit flag to actually delete.
#
# Requirements: gh CLI, authenticated with a token that has delete:packages scope
#   gh auth status   — check current auth
#   gh auth refresh -s delete:packages   — add scope if missing
#
# Usage:
#   ./scripts/delete-package-versions.sh            # dry run (default, safe)
#   ./scripts/delete-package-versions.sh --delete   # actually delete
#

set -euo pipefail

ORG="finografic"
PACKAGE_TYPE="npm"
PACKAGE_NAME="project-scripts"
DRY_RUN=true

if [[ "${1:-}" == "--delete" ]]; then
  DRY_RUN=false
fi

if $DRY_RUN; then
  echo "DRY RUN — pass --delete to actually remove versions"
  echo ""
fi

echo "Fetching all versions of @${ORG}/${PACKAGE_NAME}..."

page=1
total=0
deleted=0

while true; do
  response=$(gh api \
    "users/${ORG}/packages/${PACKAGE_TYPE}/${PACKAGE_NAME}/versions?per_page=100&page=${page}" \
    --jq '.[] | "\(.id)\t\(.name)"' 2>/dev/null || echo "")

  if [[ -z "$response" ]]; then
    break
  fi

  while IFS=$'\t' read -r id name; do
    ((total++))
    if $DRY_RUN; then
      echo "  [dry-run] would delete  v${name}  (id: ${id})"
    else
      echo "  deleting  v${name}  (id: ${id})..."
      gh api --method DELETE \
        "users/${ORG}/packages/${PACKAGE_TYPE}/${PACKAGE_NAME}/versions/${id}" \
        --silent
      ((deleted++))
    fi
  done <<< "$response"

  ((page++))
done

echo ""
if $DRY_RUN; then
  echo "Found ${total} version(s). Re-run with --delete to remove them all."
else
  echo "Done. Deleted ${deleted}/${total} version(s)."
  echo ""
  echo "Next: push a commit or manually trigger your publish workflow to re-publish v1.0.1."
fi
