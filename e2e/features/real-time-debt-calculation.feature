Feature: Real-time Debt Calculation
  As a treasurer/admin, I want to see that debts are updated in real-time when users make consumptions, so that I always have accurate financial information.

  Scenario: Admin checks user debt before and after consumption
    Given the application is running
    And I open the login page
    When I log in as a admin user
    And I navigate to the credits page
    Then I should see the debts for all members
    And I find the debt amount for "Miren Urrutia"
    When I open the login page
    And I log in as a bazkide user
    And I navigate to the consumptions page
    And I add "Kalea Garagardoa" to the cart
    And I add "Ardoa" to the cart
    And I click the close account button
    And I should see the confirmation dialog
    And I capture the consumption amount from the confirmation dialog
    And I confirm the consumption
    And I wait 3 seconds for debt calculation to complete
    When I open the login page
    And I log in as a admin user
    And I navigate to the credits page
    Then I should see that "Miren Urrutia"'s debt has increased by the consumption amount
    And the debt increase should match the consumption total
