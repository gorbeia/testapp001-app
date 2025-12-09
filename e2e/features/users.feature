Feature: User management table
  As an administrator
  I want to manage users
  So that I can add new members and companions

  Background:
    Given the application is running
    When I open the login page
    And I log in as a admin user

  Scenario: Add a new random user
    When I open the users management page
    And I create a new random user
    Then I should see a success notification for the new user
