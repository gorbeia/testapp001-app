Feature: Stock changes log and audited adjustments
  As an admin or cellarman
  I want to adjust stock with a reason and see the history
  So that inventory stays traceable (separate from account movements)

  Background:
    Given the application is running
    And I open the login page
    And I log in as a admin user
    And I should see the dashboard instead of the login form

  Scenario: Stock changes page is reachable
    When I navigate to the stock changes page
    Then the stock changes page should be visible

  Scenario: Stock adjustment is listed on the stock changes page
    Given I navigate to the products page
    When I click the new product button
    And I fill in the product name with "E2E Stock Product"
    And I fill in the product description with "Stock E2E"
    And I select the category "Edariak"
    And I fill in the price with "1.00"
    And I fill in the stock with "20"
    And I fill in the minimum stock with "2"
    And I fill in the supplier with "E2E Supplier"
    And I click the save product button
    Then I should see a success toast message
    When I open the stock adjustment dialog for the current product
    And I fill the adjustment quantity with "2"
    And I fill the adjustment reason with "E2E inventory adjustment"
    And I apply the stock adjustment
    Then I should see a success toast message
    When I navigate to the stock changes page
    Then I should see a stock log row containing "+2"
    And I should see a stock log row containing "E2E inventory adjustment"
