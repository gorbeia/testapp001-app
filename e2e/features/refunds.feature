Feature: Refunds
  As a treasurer
  I want to issue refunds
  So that members receive credit on the ledger

  Scenario: Admin issues a refund and member sees it
    Given the application is running
    When I open the login page
    And I log in as a admin user
    When I navigate to the prepayments page
    And I open the issue refund dialog
    And I issue a refund to Miren Urrutia
    When I log out from the sidebar
    And I re-login as a bazkide user
    When I navigate to my account movements page
    Then I should see the my movements page
    And I should see a refund line on my movements
