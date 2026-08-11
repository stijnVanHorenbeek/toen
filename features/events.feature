Feature: Historical events

  Scenario: Read a published event
    Given I open the homepage
    When I open the first recommended event
    Then the event heading matches the page title
    And the event shows at least one attributed source

  Scenario: Keep recommendations useful when a period has no content
    Given I open the homepage
    When I choose the week "2026-08-10"
    And I set the period from "1500" to "1600"
    Then I see that the period was widened
    And I see at least one recommended event
