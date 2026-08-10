# Content publishing

## Current migration phase

The dedicated content repository stores and validates the canonical Markdown catalog. Before verification or a build, the application resolves its `main` branch once, checks out that exact immutable commit, runs the content repository validation, and generates the local `content/events` directory. Runtime requests never fetch from GitHub.

The publisher still uses the bootstrap pull-request flow until direct content commits and the deployment hook are implemented.

## Target model

A dedicated content repository stores the canonical Markdown files. Trusted editors commit content through the Access-protected admin interface. They do not need a human approval for each change.

The application repository stores the application code. The GitHub App must not have write access to this repository after the migration.

## Trust boundary

- Cloudflare Access authenticates each editor.
- The Worker validates the Access JWT before a write.
- The Worker records the editor identity with the content commit.
- The Worker validates and serializes all Markdown.
- The browser never receives GitHub credentials.
- The GitHub App installation includes only the content repository.
- The GitHub App writes only canonical content paths.

## Publish flow

1. The editor reviews the canonical Markdown preview.
2. The Worker validates the content request.
3. The Worker gets a short-lived GitHub App installation token.
4. The GitHub App commits the Markdown file to the default content branch.
5. A Cloudflare Deploy Hook starts an application build. Rapid commits may coalesce to the latest content snapshot.
6. The build resolves the content branch once and checks out that exact commit SHA.
7. The build validates the complete content catalog and records the application and content revisions.
8. The build deploys the Worker only when all checks pass.

A failed deployment must keep the previous Worker version active. The admin interface must show the commit and deployment result.

## Runtime behavior

The Worker must not fetch historical content from GitHub during a request. The build must bundle the validated Markdown files. This keeps public requests fast and makes each deployment reproducible.

## Migration conditions

Complete the migration before another editor gets admin access.

1. Create the content repository.
2. Move the Markdown catalog to the content repository.
3. Install the GitHub App only in the content repository.
4. Change the publisher from pull requests to direct commits.
5. Add catalog validation and deployment for an exact content commit SHA.
6. Remove the GitHub App installation from the application repository.
7. Verify commit attribution, rollback, and failed-deployment behavior.
