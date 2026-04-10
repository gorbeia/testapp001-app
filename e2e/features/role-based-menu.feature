Feature: Role-based access control
  As a user with a specific access role
  I want to see only the menu entries and pages I am authorized for
  So that the application enforces role-based permissions

  Background:
    Given the application is running
    When I open the login page

  @role-based
  Scenario: Admin sees all menu entries
    When I log in as a admin user
    Then I should see the dashboard instead of the login form
    And demo society has SEPA billing enabled
    And I should see the main menu entries
    And I should see admin management links
    And I should see config links

  @role-based
  Scenario: Treasurer sees financial management but not user or product admin
    When I log in as a diruzaina user
    Then I should see the dashboard instead of the login form
    And I should see the main menu entries
    And I should not see the announcements menu link
    And I should see treasurer management links
    But I should not see admin-only management links
    And I should not see admin-only config links
    And I should see treasurer config links

  @role-based
  Scenario: Cellarman sees products and consumptions but not financial management
    When I log in as a sotolaria user
    Then I should see the dashboard instead of the login form
    And I should see the main menu entries
    And I should not see the announcements menu link
    And I should see cellarman management links
    But I should not see financial management links

  @role-based
  Scenario: Member sees no management entries
    When I log in as a bazkide user
    Then I should see the dashboard instead of the login form
    And I should see the main menu entries
    And I should not see the announcements menu link
    But I should not see any management entries

  @role-based
  Scenario: Member cannot access protected pages directly
    When I log in as a bazkide user
    Then I should not be able to access protected pages as a member

  @role-based
  Scenario: Treasurer cannot access admin-only pages directly
    When I log in as a diruzaina user
    Then I should not be able to access admin-only pages as a treasurer

  @role-based
  Scenario: Cellarman cannot access financial pages directly
    When I log in as a sotolaria user
    Then I should not be able to access financial pages as a cellarman
