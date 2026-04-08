@story:res-1 @story:res-2
Feature: Reservation API
  As a member
  I want to manage reservations through the API
  So that bookings are validated and persisted

  Background:
    Given the API is available
    And I am authenticated as a "bazkide" user

  Scenario: Create a valid reservation
    When I POST to "/api/reservations" with a valid reservation body
    Then the response status should be 201
    And the created reservation type should be "bazkaria"
    And the last created reservation should appear in my reservations list

  Scenario: Missing required fields returns 400
    When I POST to "/api/reservations" with body:
      """json
      { "guests": 4 }
      """
    Then the response status should be 400

  @prepayment-ledger-floor @story:res-5b-10
  Scenario: Reservation blocked when below prepayment floor
    Given the member balance is below the society floor
    When I POST to "/api/reservations" with a valid reservation body
    Then the response status should be 403
    And the response body "code" should be "prepayment_ledger_floor"

  Scenario: Member can list their own reservations payload
    When I GET "/api/reservations/user"
    Then the response status should be 200
    And the response body should include property "data"

  Scenario: Member can delete their own reservation
    Given I have created a reservation
    When I DELETE the last created reservation
    Then the response status should be 204
