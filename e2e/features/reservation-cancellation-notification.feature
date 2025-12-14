Feature: Reservation Cancellation Notifications
  As a user
  I want to receive a notification when an admin cancels my reservation
  So that I know when my reservation has been cancelled

  Background:
    Given the application is running
    And I open the login page
    And I log in as a bazkide user
    And I should see the dashboard instead of the login form
    And I navigate to the reservations page

  Scenario: User receives notification when admin cancels their reservation
    When I click the new reservation button
    Then I should see the reservation dialog
    And I fill in the reservation details
    And I select the reservation date
    And I set the number of guests to 5
    And I select a table
    And I keep kitchen equipment disabled
    Then I should see the correct cost calculation without kitchen
    When I save the reservation
    Then I should see a reservation success message
    And the reservation should appear in the list
    And I should see the reservation in my reservations list
    
    When I open the login page
    And I log in as a admin user
    And I should see the dashboard instead of the login form
    And I navigate to the reservations page
    And I find the user's reservation
    And I cancel the user's reservation
    Then the reservation should be marked as cancelled
    
    When I open the login page
    And I log in as a bazkide user
    And I should see the dashboard instead of the login form
    And I navigate to the notifications page
    Then I should see a cancellation notification
    And the notification should be in the correct language
