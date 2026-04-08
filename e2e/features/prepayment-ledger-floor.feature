@prepayment-ledger-floor
Feature: Prepayment minimum ledger balance (E2E)
  Exercises the member banner and UI when balance is below the society floor (API 403 is covered by `integration/features/reservations.feature`).
  DB fixtures are applied in a Before hook (`pnpm db:seed:prepayment-floor-e2e`) and torn down after (`pnpm db:undo:prepayment-floor-e2e`).

  Scenario: Member below floor sees banner and cannot save reservation
    Given the application is running
    When I open the login page
    And I log in as a bazkide user
    Then I should see the prepayment ledger floor banner
    When I navigate to the calendar page
    And I click the new reservation button
    Then I should see the reservation dialog
    When I fill in the reservation details
    And I select the reservation date
    And I set the number of guests to 10
    And I select the "Gela Pribatua" table
    Then the reservation save button should be disabled for prepayment ledger floor
