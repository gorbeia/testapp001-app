Feature: Account movements ledger pages
  As a member or treasurer
  I want to view account movements
  So that I can audit balances

  Scenario: Member opens my movements page
    Given the application is running
    When I open the login page
    And I log in as a bazkide user
    When I navigate to my account movements page
    Then I should see the my movements page

  Scenario: Admin opens society-wide movements page
    Given the application is running
    When I open the login page
    And I log in as a admin user
    When I navigate to admin account movements page
    Then I should see the admin movements page
