Feature: My Debts (Nire Zorrak)
  As a regular user
  I want to view my personal debts
  So that I can track my outstanding payments and see how new consumptions affect my total

  Scenario: User views their personal debts and sees real-time updates
    Given the application is running
    When I open the login page
    And I log in as a bazkide user
    And I navigate to the "Nire Zorrak" page
    Then I should see my personal debts interface
    And I should see my current month debt
    And I should see the debt details including amount and status

  Scenario: User adds consumption and sees debt increase in real-time
    Given the application is running
    When I open the login page
    And I log in as a bazkide user
    And I navigate to the "Nire Zorrak" page
    Then I should see my current debt amount
    And I navigate to the consumptions page
    And I add "Patata Frita" to the cart
    And I click the close account button
    And I navigate back to the "Nire Zorrak" page
    Then I should see my debt has increased
    And I should see the updated total debt
