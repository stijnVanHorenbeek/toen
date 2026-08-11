Feature: Classroom history beat

  Scenario: Run the five-minute Apollo vote and revote route
    Given I open the Apollo 11 classroom beat
    Then the preparation heading has not stolen keyboard focus
    And the 8 minute beat route is selected
    When I choose the 5 minute beat route
    And I start the classroom beat
    Then beat stage "opening" shows "Eagle zit in de laatste fase van de afdaling"
    And the classroom stage has keyboard focus
    When I use the classroom control "Volgende"
    Then beat stage "commitment" shows "Je mag straks nog veranderen"
    When I use the classroom control "Toon meer"
    Then beat stage "crater-evidence" shows "deels handmatig door Armstrong bestuurd"
    When I use the classroom control "Volgende"
    Then beat stage "first-discussion" shows "Welk risico weegt hier het zwaarst"
    When I use the classroom control "Volgende"
    Then beat stage "revision" shows "Blijf je bij je antwoord of verander je"
    When I use the classroom control "Volgende"
    Then beat stage "resolution" shows "Veilig bijsturen"
    When I use the classroom control "Volgende"
    Then beat stage "lesson-bridge" shows "Wanneer volg je een plan precies"
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
    Then beat stage "downrange-evidence" shows "vier mijl voorbij het voorspelde punt"
    When I use the classroom control "Overslaan"
    Then beat stage "second-discussion" shows "Wanneer mag je van een plan afwijken"
    When I use the classroom control "Terug"
    Then beat stage "first-discussion" shows "Welk risico weegt hier het zwaarst"
    When I use the classroom control "Volgende"
    Then beat stage "second-discussion" shows "Wanneer mag je van een plan afwijken"
    When I use the classroom control "Overslaan"
    Then beat stage "revision" shows "Kies opnieuw"
    When I reset and confirm the classroom beat
    Then I see the classroom beat preparation again
    And the preparation heading has keyboard focus
    And the 8 minute beat route is selected

  Scenario: Reload safely returns to preparation
    Given I open the Apollo 11 classroom beat
    When I start the classroom beat
    And I reload the classroom beat
    Then I see the classroom beat preparation again
    And I see the reload reset explanation

  Scenario: Keyboard navigation works with reduced motion
    Given reduced motion is enabled
    And I open the Apollo 11 classroom beat
    When I start the classroom beat
    And I press the classroom key "ArrowRight"
    Then beat stage "commitment" shows "Je mag straks nog veranderen"
    And the classroom stage has keyboard focus
    When I press the classroom key "Space"
    Then beat stage "crater-evidence" shows "deels handmatig door Armstrong bestuurd"
    And the classroom stage has visible focus

  Scenario: Rapid activation advances only one state
    Given I open the Apollo 11 classroom beat
    When I start the classroom beat
    And I rapidly activate the classroom control "Volgende" twice
    Then beat stage "commitment" shows "Je mag straks nog veranderen"

  Scenario Outline: Classroom state fits supported projector sizes
    Given the classroom viewport is <width> by <height>
    And I open the Apollo 11 classroom beat
    When I start the classroom beat
    Then the classroom state fits without scrolling
    And classroom controls have touch-sized targets
    When I advance to classroom stage "resolution"
    Then the classroom state fits without scrolling

    Examples:
      | width | height |
      | 1920  | 1080   |
      | 1280  | 720    |
      | 1024  | 576    |

  Scenario: Legacy article has a safe classroom fallback
    Given I open the Constantinople classroom route
    Then I see that no classroom beat is ready
    And I can return to the Constantinople article
