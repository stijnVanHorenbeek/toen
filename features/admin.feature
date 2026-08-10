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
    And I request publication
    Then I see that nothing was written to GitHub

  Scenario: Do not restore a stale preview after an edit
    Given Markdown preview responses are delayed
    And I open the event admin
    When I complete a valid event draft
    And I request the Markdown preview
    And I change the title before the preview returns
    Then the stale draft cannot be published

  Scenario: Do not publish the same successful draft twice
    Given GitHub publishing commits and triggers deployment
    And I open the event admin
    When I complete a valid event draft
    And I request the Markdown preview
    And I request publication
    Then the created commit is shown
    And the same draft cannot be published again

  Scenario: Retry deployment after the commit was saved
    Given GitHub publishing saves a commit before deployment triggering fails
    And I open the event admin
    When I complete a valid event draft
    And I request the Markdown preview
    And I request publication
    Then I see that the commit was saved but deployment needs a retry
    When I request publication again
    Then the created commit is shown
