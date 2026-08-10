Feature: Admin drafting

  Scenario: Preview a Git-backed event document
    Given I open the event admin
    Then the heading "Nieuwe gebeurtenis" is visible
    When I complete a valid event draft
    And I request the Markdown preview
    Then the target event path is "content/events/val-van-constantinopel-1453.md"
    And the Markdown preview contains "title: Constantinopel valt"

  Scenario: Clearly report a safe GitHub dry run
    Given GitHub publishing is in dry-run mode
    And I open the event admin
    When I complete a valid event draft
    And I request the Markdown preview
    And I request a pull request
    Then I see that nothing was written to GitHub

  Scenario: Do not restore a stale preview after an edit
    Given Markdown preview responses are delayed
    And I open the event admin
    When I complete a valid event draft
    And I request the Markdown preview
    And I change the title before the preview returns
    Then the stale draft cannot be published

  Scenario: Do not publish the same successful draft twice
    Given GitHub publishing creates a pull request
    And I open the event admin
    When I complete a valid event draft
    And I request the Markdown preview
    And I request a pull request
    Then the created pull request is shown
    And the same draft cannot be published again
