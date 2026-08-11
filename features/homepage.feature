Feature: Homepage

  Scenario: Identify the teacher start page
    Given I open the homepage
    Then the page title is "Toen."
    And the site name "Toen." is visible
    And the heading "Kies een activiteit" is visible
    And I can create a new activity

  Scenario: Start a recommended classroom activity
    Given I open the homepage
    Then a classroom start action is visible in the first viewport
    When I start the first recommended classroom activity
    Then I see the classroom activity preparation

  Scenario: Find an activity for a lesson context
    Given I open the homepage
    When I search activities for "D Day"
    And I choose the topic "Oorlog"
    Then the first recommended activity starts "/events/d-day-de-geallieerde-landing-in-normandie-1944/play"
    And the recommendation explains why it fits
    And activity fit is exposed as a named list

  Scenario: Reach classroom launch by keyboard
    Given I open the homepage
    When I tab to the first classroom start action
    Then the first classroom start action has keyboard focus

  Scenario: Name recommendations and filters for assistive technology
    Given I open the homepage
    Then recommendation and filter regions have accessible names

  Scenario Outline: Homepage actions reflow and remain usable
    Given the homepage viewport is <width> by <height>
    When I open the homepage
    Then the homepage fits without horizontal scrolling
    And homepage controls have touch-sized targets

    Examples:
      | width | height |
      | 390   | 844    |
      | 1280  | 720    |

  Scenario: Homepage reflows at a 200 percent equivalent width
    Given the homepage viewport is 640 by 900
    When I open the homepage
    Then the homepage fits without horizontal scrolling
    And homepage controls have touch-sized targets
