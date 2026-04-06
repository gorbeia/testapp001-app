Feature: Bank transfer validation
  As a treasurer
  I want to validate incoming transfers
  So that member balances are updated

  Scenario: Admin validates a bank transfer and member sees ledger entry
    Given the application is running
    When I open the login page
    And I log in as a admin user
    When I navigate to the bank transfers page
    And I create a pending bank transfer for Miren Urrutia
    And I validate the first pending bank transfer
    When I log out from the sidebar
    And I open the login page
    And I log in as a bazkide user
    When I navigate to my account movements page
    Then I should see a bank transfer line on my movements

  Scenario: Member proposes a bank transfer and treasurer validates it
    Given the application is running
    When I open the login page
    And I log in as a bazkide user
    When I navigate to my account movements page
    And I submit a bank transfer proposal from my movements page
    When I log out from the sidebar
    And I open the login page
    And I log in as a admin user
    When I navigate to the bank transfers page
    And I validate the first pending bank transfer
    When I log out from the sidebar
    And I open the login page
    And I log in as a bazkide user
    When I navigate to my account movements page
    Then I should see a bank transfer line on my movements
