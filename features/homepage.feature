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

  Scenario Outline: Reach filters before the featured recommendation
    Given the homepage viewport is <width> by <height>
    When I open the homepage
    Then compact filter access appears before the featured recommendation
    When I open the homepage filters
    Then the activity search receives focus

    Examples:
      | width | height |
      | 390   | 844    |
      | 834   | 1112   |

  Scenario: Topic choices explain preference behavior
    Given I open the homepage
    When I open the homepage filters if needed
    Then topic choices say they give matching activities priority
    And filter grouping is quiet while filter controls remain bounded

  Scenario: Secondary recommendations are compact
    Given I open the homepage
    Then only the first recommendation uses the featured treatment
    And a secondary recommendation is shorter than the featured recommendation
    And secondary recommendation titles open background reading
    And secondary classroom starts use quiet actions
    And recommendation cards follow the page heading hierarchy

  Scenario: Server and hydrated homepage agree on the first recommendation
    Given I record the server-rendered first recommendation
    When I open the homepage
    Then the hydrated first recommendation is unchanged

  Scenario: Find an activity for a lesson context
    Given I open the homepage
    When I open the homepage filters if needed
    And I search activities for "D Day"
    And I choose the topic "Oorlog"
    Then the first recommended activity starts "/events/d-day-de-geallieerde-landing-in-normandie-1944/play"
    And the recommendation explains why it fits
    And activity fit is exposed as a named list

  Scenario: Discard stale search work
    Given I open the homepage
    When I open the homepage filters if needed
    And I rapidly replace the activity search with "Apollo" and "D Day"
    Then the first recommended activity starts "/events/d-day-de-geallieerde-landing-in-normandie-1944/play"

  Scenario: Browse events without worker search
    Given I open the homepage
    Then a static event archive link is available
    When I open the static event archive
    Then period and topic archive links are available

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
