Feature: SEPA bounce controls on Zorrak
  As a treasurer
  I want the Zorrak page to expose SEPA bounce actions
  So that failed debits can be reverted

  Scenario: Admin sees treasurer actions column on Zorrak
    Given the application is running
    When I open the login page
    And I log in as a admin user
    When I navigate to the Zorrak debts page
    Then I should see the Zorrak treasurer actions column
