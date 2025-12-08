Feature: Login page
  As a visitor
  I want to access the login page
  So that I can authenticate into the Elkartearen App

  Scenario: Visit the login page
    Given the application is running
    When I open the login page
    Then I should see the login form

  Scenario: Successful login as bazkide
    Given the application is running
    When I open the login page
    And I log in as a bazkide user
    Then I should see the dashboard instead of the login form

  Scenario: Bazkide login fails with wrong password
    Given the application is running
    When I open the login page
    And I try to log in as a bazkide user with a wrong password
    Then I should see a login error message and still see the login form
