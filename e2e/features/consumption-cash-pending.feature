@consumption-cash-pending
Feature: Cash pending payments on consumptions page
  As a member
  I want to pay unpaid reservations and subscription charges in cash from the bar
  So that my ledger is settled when the society accepts cash

  Scenario: Pending payments category is hidden when no cash method is enabled
    Given the application is running
    When I open the login page
    And I log in as a admin user
    And I navigate to the society page
    And I disable cash manual payment on the society page
    And I disable cash change machine payment on the society page
    And I save the society changes
    When I open the login page
    And I log in as a bazkide user
    And I should see the dashboard instead of the login form
    And I navigate to the consumptions page
    Then I should not see pending payments category on the consumptions page

  Scenario: Seeded unpaid reservation can be paid from pending payments
    Given the application is running
    When I open the login page
    And I log in as a admin user
    And I navigate to the society page
    And I enable cash manual payment on the society page
    And I save the society changes
    When I open the login page
    And I log in as a bazkide user
    And I should see the dashboard instead of the login form
    And I navigate to the consumptions page
    When I open the pending payments category on the consumptions page
    Then I should see the seeded pending reservation card for cash E2E
    When I add the seeded pending reservation to the cart on the consumptions page
    And I click the close account button
    And I confirm the consumption
    Then I should see consumptions save success
    When I open the pending payments category on the consumptions page
    Then I should not see the seeded pending reservation card for cash E2E
