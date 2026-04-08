Feature: SEPA billing frequency per society
  As a treasurer
  I want to configure how often we bill via SEPA
  So that export periods match our society

  Background:
    Given the application is running
    When I open the login page
    And I log in as a admin user
    And I navigate to the society page

  Scenario: Admin disables SEPA and sidebar hides link; page shows disabled state
    And I set SEPA mode to disabled
    And I save the society changes
    When I re-login as a admin user
    Then I should not see the SEPA sidebar link
    When I navigate to the SEPA export page by URL
    Then I should see SEPA export disabled empty state
    When I navigate to the society page
    And I set SEPA mode to monthly
    And I save the society changes
