Feature: Classroom history beat

  Scenario: Run the five-minute vote and revote route
    Given I open the Apollo 11 classroom beat
    Then the preparation heading has not stolen keyboard focus
    And the 8 minute beat route is selected
    When I choose the 5 minute beat route
    And I start the classroom beat
    Then beat phase "opening" is visible
    And the classroom stage has keyboard focus
    When I use the classroom control "Volgende"
    Then beat phase "commitment" is visible
    When I use the classroom control "Toon meer"
    Then beat phase "evidence" is visible
    When I use the classroom control "Volgende"
    Then beat phase "discussion" is visible
    When I use the classroom control "Volgende"
    Then beat phase "revision" is visible
    When I use the classroom control "Volgende"
    Then beat phase "resolution" is visible
    When I use the classroom control "Volgende"
    Then beat phase "lesson-bridge" is visible
    When I use the classroom control "Klaar"
    Then I see that the classroom beat is complete
    And the completion heading has keyboard focus

  Scenario: Skip optional evidence, go back safely, and reset
    Given I open the Apollo 11 classroom beat
    When I start the classroom beat
    And I use the classroom control "Volgende"
    And I use the classroom control "Toon meer"
    And I use the classroom control "Volgende"
    And I use the classroom control "Toon meer"
    Then beat phase "evidence" is visible
    And classroom progress is step 5 of 10
    When I use the classroom control "Overslaan"
    Then beat phase "discussion" is visible
    And classroom progress is step 6 of 10
    When I use the classroom control "Terug"
    Then beat phase "discussion" is visible
    And classroom progress is step 4 of 10
    When I use the classroom control "Volgende"
    Then classroom progress is step 6 of 10
    When I use the classroom control "Overslaan"
    Then beat phase "revision" is visible
    When I reset and confirm the classroom beat
    Then I see the classroom beat preparation again
    And the preparation heading has keyboard focus
    And the 8 minute beat route is selected

  Scenario: Reload safely returns to preparation
    Given I open the Apollo 11 classroom beat
    When I start the classroom beat
    And I reload the classroom beat
    Then I see the classroom beat preparation again

  Scenario: Classroom keyboard navigation works with reduced motion
    Given reduced motion is enabled
    And I open the Apollo 11 classroom beat
    When I start the classroom beat
    And I press the classroom key "ArrowRight"
    Then beat phase "commitment" is visible
    And the classroom stage has keyboard focus
    When I press the classroom key "Space"
    Then beat phase "evidence" is visible
    And the classroom stage has visible focus

  Scenario: Rapid activation advances only one state
    Given I open the Apollo 11 classroom beat
    When I start the classroom beat
    And I rapidly activate the classroom control "Volgende" twice
    Then beat phase "commitment" is visible

  Scenario Outline: Classroom state fits supported projector sizes
    Given the classroom viewport is <width> by <height>
    And I open the Apollo 11 classroom beat
    When I start the classroom beat
    Then the classroom state fits without scrolling
    And classroom controls have touch-sized targets
    When I advance to classroom phase "resolution"
    Then the classroom state fits without scrolling

    Examples:
      | width | height |
      | 1920  | 1080   |
      | 1280  | 720    |
      | 1024  | 576    |

  Scenario: Compare both sources in the Belgian independence activity
    Given the classroom viewport is 1024 by 576
    And I open the Belgian independence classroom activity
    When I start the classroom beat
    Then the classroom state fits without scrolling
    And two attributed source cards are visible
    When I use the classroom control "Volgende"
    Then beat phase "commitment" is visible
    When I use the classroom control "Toon meer"
    Then beat phase "evidence" is visible

  Scenario: Keep the D-Day decision inside its historical limits
    Given the classroom viewport is 1024 by 576
    And I open the D-Day classroom activity
    When I start the classroom beat
    Then the classroom state fits without scrolling
    And the context decision perspective is visible
    When I use the classroom control "Volgende"
    Then beat phase "commitment" is visible
    When I use the classroom control "Toon meer"
    Then beat phase "evidence" is visible
