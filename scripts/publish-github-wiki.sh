#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/publish-github-wiki.sh [--remote <wiki-git-url>] [--message <commit-message>]

Publishes the repository's ./wiki Markdown pages to the GitHub Wiki git
repository. GitHub stores the visible Wiki tab in a separate repository named
<owner>/<repo>.wiki.git, so committing ./wiki alone does not update the Wiki tab.

Examples:
  scripts/publish-github-wiki.sh --remote git@github.com:OWNER/REPO.wiki.git
  WIKI_REMOTE=https://github.com/OWNER/REPO.wiki.git scripts/publish-github-wiki.sh
USAGE
}

remote="${WIKI_REMOTE:-}"
message="${WIKI_COMMIT_MESSAGE:-docs: publish project wiki}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote)
      remote="${2:-}"
      shift 2
      ;;
    --message)
      message="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

repo_root="$(git rev-parse --show-toplevel)"
wiki_source="$repo_root/wiki"

if [[ ! -d "$wiki_source" ]]; then
  echo "Missing wiki source directory: $wiki_source" >&2
  exit 1
fi

if [[ -z "$remote" ]]; then
  if origin_url="$(git -C "$repo_root" config --get remote.origin.url)" && [[ -n "$origin_url" ]]; then
    case "$origin_url" in
      git@github.com:*.git)
        remote="${origin_url%.git}.wiki.git"
        ;;
      git@github.com:*)
        remote="${origin_url}.wiki.git"
        ;;
      https://github.com/*.git)
        remote="${origin_url%.git}.wiki.git"
        ;;
      https://github.com/*)
        remote="${origin_url}.wiki.git"
        ;;
    esac
  fi
fi

if [[ -z "$remote" ]]; then
  echo "Could not infer GitHub Wiki remote. Pass --remote or set WIKI_REMOTE." >&2
  exit 1
fi

tmpdir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT

if ! git clone "$remote" "$tmpdir/wiki-repo"; then
  cat >&2 <<MSG
Failed to clone $remote.
Make sure the GitHub Wiki feature is enabled and that you have permission to push.
If the wiki has never been created in the UI, create the first page once or verify
that GitHub accepts pushes to the .wiki.git repository for this project.
MSG
  exit 1
fi

find "$tmpdir/wiki-repo" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R "$wiki_source"/. "$tmpdir/wiki-repo"/

git -C "$tmpdir/wiki-repo" add -A
if git -C "$tmpdir/wiki-repo" diff --cached --quiet; then
  echo "GitHub Wiki already matches ./wiki; nothing to publish."
  exit 0
fi

git -C "$tmpdir/wiki-repo" commit -m "$message"
git -C "$tmpdir/wiki-repo" push origin HEAD

echo "Published ./wiki to $remote"
