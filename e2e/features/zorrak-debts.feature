Feature: Zorrak Debts Management
  As an administrator
  I want to view all user debts for the current month
  So that I can track outstanding payments and verify totals
  @only
  Scenario: Admin views Zorrak debts page and verifies total sum
    Given the application is running
    When I open the login page
    And I log in as a admin user
    When I navigate to the Zorrak debts page
    Then I should see the debts management interface
    And I should see a list of users with their debts
    And each debt should show the user name and amount
    And I should see a total sum displayed
    When I calculate the sum of all individual debts
    Then the calculated sum should match the displayed total

  @only
  Scenario: Non-admin user cannot access Zorrak debts page
    Given the application is running
    When I open the login page
    And I log in as a bazkide user
    When I try to navigate to the Zorrak debts page
    Then I should be denied access or redirected
    And I should not see the debts management interface
