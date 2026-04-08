Feature: Society accounting (Kontabilitatea)
  As a treasurer
  I want to see all society income and expenses on the Kontabilitatea page
  So that I can manage the society finances in one place

  Scenario: Treasurer opens Kontabilitatea and adds a manual expense
    Given the application is running
    When I open the login page
    And I log in as a admin user
    When I navigate to the society accounting page
    Then I should see the society accounting view
    When I add a manual expense entry
    Then I should see the manual expense in the entries list
    And the expense total should reflect the new entry

  Scenario: Prepayment validation shows as derived income on Kontabilitatea
    Given the application is running
    When I open the login page
    And I log in as a admin user
    When I navigate to the prepayments page
    And I create a pending prepayment for Miren Urrutia
    And I validate the first pending prepayment
    When I navigate to the society accounting page
    Then the income total should include the prepayment amount
