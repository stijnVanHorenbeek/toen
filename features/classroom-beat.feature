Feature: Classroom history beat

  Scenario: Run the five-minute vote and revote route
    Given I open the Apollo 11 classroom beat
    Then the preparation heading has not stolen keyboard focus
    And the 8 minute beat route is selected
    When I choose the 5 minute beat route
    And I start the classroom beat
    Then beat phase "opening" is visible
    And the classroom stage has keyboard focus
    And the expected student action and stage timing are visible
    And the Apollo historical image and attribution are visible
    And visual-stage labels and attribution remain readable
    And the stage transition moves forward
    And stage motion is brief and blur-free
    When I use the classroom control "Volgende"
    Then beat phase "commitment" is visible
    And the stage transition moves forward
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
    And leaving the completed activity is the primary action
    And replaying the completed activity is a tertiary action

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
    And the stage transition moves back
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
    And classroom transitions are disabled
    When I press the classroom key "Space"
    Then beat phase "evidence" is visible
    And the classroom stage has visible focus

  Scenario: Rapid activation advances only one state
    Given I open the Apollo 11 classroom beat
    When I start the classroom beat
    And I rapidly activate the classroom control "Volgende" twice
    Then beat phase "commitment" is visible

  Scenario Outline: Presenter guidance remains glanceable
    Given the classroom viewport is <width> by <height>
    And I open the Apollo 11 classroom beat
    When I start the classroom beat
    Then teacher and student guidance are separate aligned chunks
    And stage timing is labeled as suggested

    Examples:
      | width | height |
      | 390   | 844    |
      | 1920  | 1080   |

  Scenario: Stop presentation safely without feeling trapped
    Given I open the Apollo 11 classroom beat
    When I start the classroom beat
    Then the current teacher cue is visible
    And the close control is in the top-right header
    When I choose to stop but cancel
    Then beat phase "opening" is visible
    When I stop the classroom beat with the control and confirm
    Then I return to the homepage

  Scenario: Finish presentation with the same keyboard control
    Given I open the Apollo 11 classroom beat
    When I start the classroom beat
    And I advance to classroom phase "lesson-bridge"
    And I press the classroom key "ArrowRight"
    Then I see that the classroom beat is complete

  Scenario: Classroom controls communicate pointer, focus, and disabled state
    Given I open the Apollo 11 classroom beat
    Then duration choices show visible keyboard focus
    And enabled classroom actions use the pointer cursor
    When I start the classroom beat
    Then disabled classroom actions do not look interactive

  Scenario: Classroom preparation gives long titles usable measure on a medium teacher screen
    Given the classroom viewport is 834 by 1112
    And I open the Belgian independence classroom activity
    Then classroom preparation fits the viewport without scrolling
    And the preparation title has a readable line measure

  Scenario Outline: Classroom preparation keeps launch actions reachable
    Given the classroom viewport is <width> by <height>
    And I open the Belgian independence classroom activity
    Then classroom preparation actions are visible without scrolling

    Examples:
      | width | height |
      | 320   | 568    |
      | 720   | 500    |

  Scenario Outline: Visual classroom stages use the available stage height
    Given the classroom viewport is <width> by <height>
    And I open the Apollo 11 classroom beat
    When I start the classroom beat
    Then the visual classroom stage uses the available stage height

    Examples:
      | width | height |
      | 390   | 844    |
      | 1920  | 1080   |

  Scenario Outline: Essential classroom content remains reachable at high zoom
    Given the classroom viewport is 640 by 360
    And I open classroom activity "<event>"
    When I start the classroom beat
    Then the classroom stage uses accessible overflow when content cannot fit
    And the classroom signals that more stage content is available
    And all essential visual stage content is reachable

    Examples:
      | event   |
      | Apollo  |
      | D-Day   |

  Scenario: A source comparison never hides canonical evidence at high zoom
    Given the classroom viewport is 640 by 360
    And I open the Belgian independence classroom activity
    When I start the classroom beat
    Then all source comparison content is complete or recoverably scrollable
    And projected source identity is readable

  Scenario: Scrolling constrained content requires a fresh wheel gesture to advance
    Given the classroom viewport is 640 by 360
    And I open the Apollo 11 classroom beat
    When I start the classroom beat
    And one wheel gesture scrolls the classroom content to its boundary
    Then beat phase "opening" is visible
    When I begin a fresh wheel gesture at the content boundary
    Then beat phase "commitment" is visible

  Scenario: A touch gesture that starts by scrolling never advances the deck
    Given the classroom viewport is 640 by 360
    And I open the Apollo 11 classroom beat
    When I start the classroom beat
    And one touch gesture scrolls the classroom content to its boundary
    Then beat phase "opening" is visible

  Scenario: Low-resolution and line-mode wheels navigate with one burst
    Given I open the Apollo 11 classroom beat
    When I start the classroom beat
    And I send one low-resolution wheel burst down
    Then beat phase "commitment" is visible
    When I send one fresh line-mode wheel notch up
    Then beat phase "opening" is visible

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

  Scenario Outline: Choice cards remain balanced across classroom layouts
    Given the classroom viewport is <width> by <height>
    And I open classroom activity "<event>"
    When I start the classroom beat
    Then four projected choices have equal height and centered labels
    And choice cards are visually subordinate to the stage question

    Examples:
      | event          | width | height |
      | Apollo         | 390   | 844    |
      | Constantinople | 1920  | 1080   |

  Scenario: Projected choices stack one per row on mobile
    Given the classroom viewport is 390 by 844
    And I open classroom activity "Constantinople"
    When I start the classroom beat
    Then projected choices stack one per row
    When I use the classroom control "Volgende"
    Then beat phase "commitment" is visible
    And projected choices stack one per row

  Scenario: Resolution support remains subordinate to the conclusion
    Given the classroom viewport is 1920 by 1080
    And I open classroom activity "Constantinople"
    When I start the classroom beat
    And I advance to classroom phase "resolution"
    Then the resolution support is visually subordinate to the conclusion

  Scenario Outline: Text-only prompts use an optically centered stage position
    Given the classroom viewport is <width> by <height>
    And I open the Belgian independence classroom activity
    When I start the classroom beat
    And I use the classroom control "Volgende"
    Then the text-only stage is optically centered with a slight upper bias

    Examples:
      | width | height |
      | 390   | 844    |
      | 1920  | 1080   |

  Scenario: Classroom controls reflow on a narrow teacher screen
    Given the classroom viewport is 320 by 568
    And I open the Apollo 11 classroom beat
    Then the classroom sensitivity guidance is visible before starting
    And classroom preparation attribution is not clipped
    And classroom preparation fits the viewport without scrolling
    When I start the classroom beat
    Then the mobile classroom stage uses the available width
    And the mobile classroom slide fits without scrolling
    And classroom footer controls share one aligned row
    And classroom controls fit without horizontal clipping
    And visual attribution does not cover stage content
    When I scroll down once in the classroom deck
    Then beat phase "commitment" is visible
    And scrolling the classroom deck emits no console errors
    When I scroll up once in the classroom deck
    Then beat phase "opening" is visible
    When I swipe up once in the classroom deck
    Then beat phase "commitment" is visible

  Scenario Outline: Compare both sources in the Belgian independence activity
    Given the classroom viewport is <width> by <height>
    And I open the Belgian independence classroom activity
    When I start the classroom beat
    Then the classroom presentation stays within the viewport
    And all source comparison content is complete or recoverably scrollable
    And two attributed source cards are visible
    And projected source card content remains readable
    When I use the classroom control "Volgende"
    Then beat phase "commitment" is visible
    When I use the classroom control "Toon meer"
    Then beat phase "evidence" is visible

    Examples:
      | width | height |
      | 1024  | 576    |
      | 320   | 568    |

  Scenario Outline: Fully present both opening sources when screen space permits
    Given the classroom viewport is <width> by <height>
    And I open the Belgian independence classroom activity
    When I start the classroom beat
    Then all source comparison content is complete or recoverably scrollable
    And the source duel uses the available stage height
    And the classroom presentation stays within the viewport

    Examples:
      | width | height |
      | 720   | 500    |
      | 401   | 558    |
      | 320   | 568    |

  Scenario Outline: Keep source-duel evidence and citations together
    Given the classroom viewport is <width> by <height>
    And I open the Belgian independence classroom activity
    When I start the classroom beat
    Then source citations remain close to their excerpts
    And projected source identity is readable
    And source cards use a readable comparison layout

    Examples:
      | width | height |
      | 390   | 844    |
      | 1920  | 1080   |

  Scenario: Mobile header preserves the full event identity
    Given the classroom viewport is 320 by 568
    And I open the D-Day classroom activity
    When I start the classroom beat
    Then the classroom header shows the complete event title without clipping

  Scenario: Use full source-duel stage in a short classroom viewport
    Given the classroom viewport is 401 by 441
    And I open the Belgian independence classroom activity
    When I start the classroom beat
    Then all source comparison content is complete or recoverably scrollable
    And the source duel uses the available stage height
    And the classroom presentation stays within the viewport

  Scenario Outline: Keep the D-Day decision inside its historical limits
    Given the classroom viewport is <width> by <height>
    And I open the D-Day classroom activity
    When I start the classroom beat
    Then the classroom state fits without scrolling
    And the context decision perspective is visible
    When I use the classroom control "Volgende"
    Then beat phase "commitment" is visible
    When I use the classroom control "Toon meer"
    Then beat phase "evidence" is visible
    When I advance to classroom phase "resolution"
    Then visual attribution does not cover stage content
    And the classroom state fits without scrolling

    Examples:
      | width | height |
      | 1280  | 720    |
      | 1024  | 576    |
