Feature: Refunds
  As a treasurer
  I want to issue refunds
  So that members receive credit on the ledger

  Scenario: Admin issues a refund and member sees it
    Given the application is running
    When I open the login page
    And I log in as a admin user
    When I navigate to the refunds page
    And I issue a refund to Miren Urrutia
    When I log out from the sidebar
    And I open the login page
    And I log in as a bazkide user
    When I navigate to my account movements page
    Then I should see a refund line on my movements
