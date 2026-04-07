Feature: Stock takes (inbentarioa)
  As an admin
  I want to start and cancel a draft stock take
  So that inventory workflows stay usable without finalizing in E2E

  Background:
    Given the application is running
    And I open the login page
    And I log in as a admin user
    And I should see the dashboard instead of the login form

  Scenario: Create a stock take draft and cancel it
    Given I navigate to the stock take page
    And I clear any stock take draft if present
    When I open the new stock take dialog
    And I confirm creating the stock take
    Then I should see the stock take detail with cancel action
    When I cancel the stock take from the detail view
    Then I should see a success toast message
    And the new stock take button should be enabled
