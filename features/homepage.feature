Feature: Homepage

  Scenario: Identify the site
    Given I open the homepage
    Then the page title is "Toen."
    And the heading "Toen." is visible
