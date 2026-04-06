Feature: My Debts (Nire Zorrak)
  As a regular user
  I want to view my personal debts
  So that I can track my outstanding payments and see how new consumptions affect my total

  Background:
    Given the application is running
    When I open the login page
    And I log in as a bazkide user

  Scenario: User views debts and consumption increases total
    When I navigate to the "Nire Zorrak" page
    Then I should see my personal debts interface
    And I should see my current month debt
    And I should see the debt details including amount and status
    And I should see my current debt amount
    And I navigate to the consumptions page
    And I add "Patata Frita" to the cart
    And I click the close account button
    And I navigate to the "Nire Zorrak" page
    Then I should see my debt has increased
    And I should see the updated total debt
