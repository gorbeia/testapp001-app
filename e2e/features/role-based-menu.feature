Feature: Role-based menu access
  As a user with different roles
  I want to see menu entries based on my permissions
  So that I can only access functionality I'm authorized for

  Background:
    Given the application is running
    When I open the login page

  @role-based
  Scenario: Bazkide user sees basic menu but no admin entries
    When I log in as a bazkide user
    Then I should see the dashboard instead of the login form
    And I should see the main menu entries
    But I should not see any admin management entries
    And I should not be able to access admin pages directly

  @role-based
  Scenario: Admin user sees all menu entries including admin
    When I log in as a admin user
    Then I should see the dashboard instead of the login form
    And I should see the main menu entries
    And I should see the admin management section
    And I should be able to access all admin pages

  @role-based
  Scenario: Direct access to admin pages is blocked for bazkide
    When I log in as a bazkide user
    Then I should see the dashboard instead of the login form
    When I try to access the users management page directly
    Then I should be redirected or shown an access denied message

  @role-based
  Scenario: Direct access to admin pages works for admin
    When I log in as a admin user
    Then I should see the dashboard instead of the login form
    When I try to access the users management page directly
    Then I should see the users management page
