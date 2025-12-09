Feature: Consumption Management
  As a user
  I want to add consumptions
  So that I can track my purchases and the system can manage inventory

  Background:
    Given the application is running
    And I open the login page
    And I log in as a bazkide user
    And I should see the dashboard instead of the login form
    And I navigate to the consumptions page

  Scenario: Add a consumption with multiple products
    When I add "Txakoli" to the cart
    And I add "Garagardoa" to the cart
    And I increase the quantity of "Txakoli" to 2
    And I click the close account button
    And I should see the confirmation dialog
    And I should see the member name in the confirmation dialog
    And I should see the total amount in the confirmation dialog
    And I should see "Txakoli" in the items table with quantity 2
    And I should see "Garagardoa" in the items table with quantity 1
    And the total amount should be the sum of all items
    And I confirm the consumption
    Then I should see a success message
    And the cart should be empty

  Scenario: Add a single product consumption
    When I add "Txakoli" to the cart
    And I click the close account button
    And I confirm the consumption
    Then I should see a success message
    And the cart should be empty

  Scenario: Cancel consumption confirmation
    When I add "Txakoli" to the cart
    And I click the close account button
    And I should see the confirmation dialog
    And I cancel the consumption
    Then the cart should still contain "Txakoli"
    And no consumption should be saved in the database
