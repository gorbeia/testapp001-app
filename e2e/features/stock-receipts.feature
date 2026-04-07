Feature: Stock receipts (hornidurak)
  As an admin
  I want to register an incoming supply
  So that stock increases with a purchase movement

  Background:
    Given the application is running
    And I open the login page
    And I log in as a admin user
    And I should see the dashboard instead of the login form

  Scenario: Create a supply receipt with one line
    Given I navigate to the supplies page
    When I open the new supply receipt dialog
    And I fill the receipt supplier with "E2E Hornidura"
    And I fill the first receipt line with the first available product and quantity "3"
    And I save the supply receipt
    Then I should see a success toast message
    And I should see "E2E Hornidura" in the supplies table
