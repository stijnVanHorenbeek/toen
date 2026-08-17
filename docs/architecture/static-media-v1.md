# Static media v1

## Purpose

No-domain deployment serves curated event media through Workers Static Assets. Public requests do not invoke Worker code or R2. Git remains authoritative for media identity, provenance, display text, expected dimensions, and expected SHA-256.

## Source and output

Tracked source renditions live under `media/sources`. They remain local and recoverable but are outside `public`, so build cannot deploy source filenames accidentally.

Each media record defines:

- Stable media ID
- Trusted source path
- Content-addressed public path
- Width and height
- Alt text and caption
- Credit, license, and license rationale
- Source and original URLs
- Derivative description and focal point
- Expected SHA-256

`pnpm assets:media` validates sources and stages one public file per unique hash at:

```text
public/media/assets/<sha256>.webp
```

Generated public files and `.generated/media-assets.json` are ignored projections. Build config verifies every staged file against pointer path, byte length, and SHA-256 before Next.js runs.

## Accepted WebP profile

Version 1 accepts only bounded, metadata-free lossy VP8 WebP sources. Pipeline validates:

- Exact RIFF and WEBP headers and declared file length
- Complete chunk boundaries and padding
- One valid VP8 frame
- No EXIF, ICCP, or XMP metadata chunks
- No animation, transparency sidecars, lossless frames, or unknown chunks
- Maximum 2 MiB per file
- Maximum 2,400 pixels per dimension
- Maximum 6,000,000 pixels
- Dimensions equal canonical metadata
- SHA-256 equals canonical metadata

Current curated files already satisfy this stripped profile. Pipeline copies bytes without another lossy re-encode. Future ingestion must use trusted offline tooling to create this profile before metadata is accepted.

Existing content-addressed targets are immutable. If a target exists with different bytes, staging fails instead of overwriting it. Source, public, generated, and active output roots must be real directories; symbolic-link redirection fails closed. Directory and pointer activation use temporary paths and restore prior output on pre-commit failure. Pointer swap is commit point; obsolete backup cleanup is best-effort and cannot roll back committed assets.

## Current measurement

| Measurement | Result |
| --- | ---: |
| Media IDs | 4 |
| Unique public files | 4 |
| Aggregate bytes | 914,702 |
| Largest file | 564,158 bytes |
| Linear 5,000-file projection | 1,143,377,500 bytes |

Linear byte projection uses current four-file average. Final editorial catalog may deduplicate media IDs and use different image complexity.

## Capacity

Worst-case no-domain public projection reserves:

- 10,000 article and classroom HTML files
- 281 archive files
- 128 shared assets
- 5,000 unique media files

Total is 15,409 files. Release generation uses complete media-registry count and fails at 18,000 projected files, below Cloudflare Free 20,000-file limit. Next build verifies media directory exactly matches pointer inventory. Post-OpenNext gate recursively counts final Static Assets, rejects symbolic links, and fails above 18,000 before deployment.

## Security and ownership

- AI import cannot select or alter media ID.
- Release event DTO contains only trusted media ID.
- Build-only `media.json` owns public provenance and expected rendition hash.
- Source filesystem path never enters public DTO.
- Runtime uses no image transformation service.
- `r2.dev` and Worker media proxy remain prohibited.
- Optional private R2 build storage requires separate approval and does not change public paths.

## Validation

- Four current media files stage as 914,702 checksum-verified bytes.
- Next/OpenNext package contains four hash-named public media files and no legacy `/media/events` files.
- Clean temporary application and content repositories completed exact non-development `build:worker`; post-build gate counted 44 Static Assets.
- Two Wrangler dry-runs read the same 53-asset package and reported identical 10,618.78 KiB raw / 2,175.95 KiB gzip upload sizes. Dry-run metadata and source-map files vary by output directory, so remote changed-asset deduplication still requires approved canary evidence.
- Media pipeline tests cover metadata chunks, malformed VP8 interframes, source and output symlinks, conflicting immutable targets, exact directory inventory, and cleanup-failure commit behavior.

## Rollback

Each Worker version retains its own Static Assets manifest and content-addressed media. New release never mutates an existing hash path. Keep tracked source files and previous Worker version until rollback window closes. Media deletion remains outside this task.
