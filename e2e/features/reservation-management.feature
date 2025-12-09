@reservation-management
Feature: Reservation Management
  As a logged-in user
  I want to create and manage reservations
  So that I can book events and manage reservations

  Background:
    Given the application is running
    And I open the login page
    And I log in as a bazkide user
    And I should see the dashboard instead of the login form
    And I navigate to the reservations page

  Scenario: Create a new reservation
    When I click the new reservation button
    Then I should see the reservation dialog
    And I fill in the reservation details
    And I select the reservation date
    And I set the number of guests to 15
    And I enable kitchen equipment
    Then I should see the correct cost calculation
    And I save the reservation
    Then I should see a reservation success message
    And the reservation should appear in the list

  Scenario: Create a reservation without kitchen
    When I click the new reservation button
    Then I should see the reservation dialog
    And I fill in the reservation details
    And I select the reservation date
    And I set the number of guests to 8
    And I keep kitchen equipment disabled
    Then I should see the correct cost calculation without kitchen
    And I save the reservation
    Then I should see a reservation success message
    And the reservation should appear in the list

  Scenario: Validate cost calculation updates
    When I click the new reservation button
    Then I should see the reservation dialog
    And I fill in the reservation details
    And I set the number of guests to 10
    Then I should see the base cost calculation
    When I enable kitchen equipment
    Then I should see the updated cost with kitchen
    When I change guests to 5
    Then I should see the recalculated cost
    When I disable kitchen equipment
    Then I should see the cost without kitchen
