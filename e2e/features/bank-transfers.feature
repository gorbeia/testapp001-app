Feature: Prepayment validation (treasurer)
  As a treasurer
  I want to validate prepayment proposals
  So that member balances are updated

  Scenario: Treasurer validates a prepayment and member sees ledger entry
    Given the application is running
    When I open the login page
    And I log in as a admin user
    When I navigate to the prepayments page
    And I create a pending prepayment for Miren Urrutia
    And I validate the first pending prepayment
    When I log out from the sidebar
    And I re-login as a bazkide user
    When I navigate to my account movements page
    Then I should see the my movements page
    And I should see a prepayment line on my movements
