Feature: SEPA billing frequency per society
  As a treasurer
  I want to configure how often we bill via SEPA
  So that export periods match our society

  Scenario: Admin sets quarterly SEPA mode and sees quarter options on export page
    Given the application is running
    When I open the login page
    And I log in as a admin user
    And I navigate to the society page
    And I set SEPA mode to quarterly
    And I save the society changes
    And I navigate to the SEPA export page
    Then I should see quarterly hints on the SEPA export step
    When I navigate to the society page
    And I set SEPA mode to monthly
    And I save the society changes

  Scenario: Admin sets on-demand SEPA mode and sees month range selectors
    Given the application is running
    When I open the login page
    And I log in as a admin user
    And I navigate to the society page
    And I set SEPA mode to on_demand
    And I save the society changes
    And I navigate to the SEPA export page
    Then I should see on-demand month range selectors on SEPA export
    When I navigate to the society page
    And I set SEPA mode to monthly
    And I save the society changes

  Scenario: Admin disables SEPA and sidebar hides link; page shows disabled state
    Given the application is running
    When I open the login page
    And I log in as a admin user
    And I navigate to the society page
    And I set SEPA mode to disabled
    And I save the society changes
    And I open the login page
    And I log in as a admin user
    Then I should not see the SEPA sidebar link
    When I navigate to the SEPA export page by URL
    Then I should see SEPA export disabled empty state
    When I navigate to the society page
    And I set SEPA mode to monthly
    And I save the society changes
