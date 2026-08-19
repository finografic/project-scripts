# triage-docs

`triage-docs` scans common agent planning directories and moves markdown artifacts into durable
specs, ignored drafts, or the bin.

```sh
pnpm --package=@finografic/project-scripts dlx triage-docs
pnpm --package=@finografic/project-scripts dlx triage-docs --scan-dir=custom/path
pnpm --package=@finografic/project-scripts dlx triage-docs --root=/path/to/repo
```

The default scan root is the current working directory. Use `--root` only when you intentionally want
to triage another repository path.
