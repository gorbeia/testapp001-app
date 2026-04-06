Feature: Society payment methods (non-SEPA rails)
  As an administrator
  I want to toggle accepted payment methods
  So that prepayment UI matches society configuration

  Scenario: Prepayment disabled gates treasurer and member UI
    Given the application is running
    When I open the login page
    And I log in as a admin user
    And I navigate to the society page
    And I disable bank transfer prepayment on the society page
    And I save the society changes
    When I re-login as a admin user
    Then I should not see the prepayments sidebar link
    When I navigate to the prepayments page by URL
    Then I should see the prepayments disabled empty state
    When I re-login as a bazkide user
    And I navigate to my account movements page
    Then I should not see the propose transfer button on my movements
    When I re-login as a admin user
    And I navigate to the society page
    And I enable bank transfer prepayment on the society page
    And I save the society changes
    When I re-login as a admin user
    Then I should see the prepayments sidebar link

  Scenario: Cash payment method flags persist after save
    Given the application is running
    When I open the login page
    And I log in as a admin user
    And I navigate to the society page
    And I enable cash manual payment on the society page
    And I enable cash change machine payment on the society page
    And I save the society changes
    When I navigate to the society page
    Then cash manual payment should be enabled on the society page
    And cash change machine payment should be enabled on the society page
    When I disable cash manual payment on the society page
    And I disable cash change machine payment on the society page
    And I save the society changes
