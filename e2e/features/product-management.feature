Feature: Product Management
  As an admin user
  I want to add and delete products
  So that I can manage the inventory

  Background:
    Given the application is running
    And I open the login page
    And I log in as a admin user
    And I should see the dashboard instead of the login form
    And I navigate to the products page

  Scenario: Add a new product
    When I click the new product button
    And I fill in the product name with "E2E Test Product 12345"
    And I fill in the product description with "Test Description"
    And I select the category "Edariak"
    And I fill in the price with "5.50"
    And I fill in the stock with "10"
    And I fill in the minimum stock with "2"
    And I fill in the supplier with "Test Supplier"
    And I click the save product button
    Then I should see a success toast message
    And I should see the product "E2E Test Product 12345" in the products table

  Scenario: Add and delete a product in one flow
    When I click the new product button
    And I fill in the product name with "E2E Test Product"
    And I fill in the product description with "E2E Test Description"
    And I select the category "Janariak"
    And I fill in the price with "3.25"
    And I fill in the stock with "15"
    And I fill in the minimum stock with "5"
    And I fill in the supplier with "E2E Supplier"
    And I click the save product button
    Then I should see the product "E2E Test Product" in the products table
    When I click the menu button for product "E2E Test Product"
    And I click the delete option
    Then I should see a confirmation dialog
    When I confirm the deletion
    Then I should see a success toast message
    And I should not see the product "E2E Test Product" in the products table
