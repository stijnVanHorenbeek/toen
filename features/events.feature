Feature: Historical events

  Scenario: Read a published event
    Given I open the homepage
    When I open the event "D-Day: de geallieerde landing in Normandië"
    Then I see the event heading "D-Day: de geallieerde landing in Normandië"
    And the page title is "D-Day: de geallieerde landing in Normandië | Toen."
    And I see the source "D-Day"

  Scenario: Keep recommendations useful when a period has no content
    Given I open the homepage
    When I choose the week "2026-08-10"
    And I set the period from "1500" to "1600"
    Then I see that the period was widened
    And I see at least one recommended event
