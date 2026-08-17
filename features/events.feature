Feature: Historical events

  Scenario: Read a published event
    Given I open the homepage
    When I open the first recommended event
    Then the event heading matches the page title
    And the event shows at least one attributed source
    And the article quietly introduces the classroom activity
    And the article has one prominent classroom activity action at the end

  Scenario: Edit a year without turning an empty field into zero
    Given I open the homepage
    When I clear the from year
    Then the from year remains empty while I edit
    When I enter the from year "1500"
    Then the from year is "1500"

  Scenario: Enter a BCE year in the period filter
    Given I open the homepage
    When I type the BCE from year "-44"
    Then the from year is "-44"

  Scenario: Keep recommendations useful when a period has no content
    Given I open the homepage
    When I choose the week "2026-08-10"
    And I set the period from "1500" to "1600"
    Then I see that the period was widened
    And I see at least one recommended event
