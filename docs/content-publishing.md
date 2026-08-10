# Content publishing

## Current model

During bootstrap, the GitHub App creates a branch, commit, and pull request in the application repository. A human reviews and merges the pull request.

This model stays in use until the content repository is ready.

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
5. The deployment workflow validates the complete content catalog.
6. The workflow checks out the exact content commit SHA.
7. The workflow builds the application with that content revision.
8. The workflow deploys the Worker only when all checks pass.

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
