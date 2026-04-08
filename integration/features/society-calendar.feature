@story:cal-1 @story:cal-3
Feature: Society calendar API and reservation blocking
  As staff
  I want society calendar events to block reservations when configured
  So that closures and parties are enforced

  Background:
    Given the API is available

  Scenario: Member can list society events for a month
    Given I am authenticated as a "bazkide" user
    When I GET "/api/society-events?month=2030-06"
    Then the response status should be 200
    And the response body should be a JSON array

  Scenario: Member cannot create society calendar events
    Given I am authenticated as a "bazkide" user
    When I POST to "/api/society-events" with body:
      """json
      {
        "title": "Unauthorized",
        "type": "other",
        "isFullDay": true,
        "startDate": "2030-07-01T00:00:00.000Z",
        "endDate": "2030-07-01T23:59:59.999Z",
        "blocksAllReservations": false,
        "blocksKitchen": false,
        "blockedTableIds": [],
        "notes": ""
      }
      """
    Then the response status should be 403

  # Offsets use a large gap between block-all (low) and per-table tests (high). Calendar steps add a
  # per-run salt in [0,399]; with only ~80 days between 250 and 330, two runs could place block-all and
  # table-test bookings on the same calendar day (250+s1 = 330+s2 → s1-s2=80), causing stray 409s.
  Scenario: Reservation returns 409 when society blocks all reservations
    Given I am authenticated as a "diruzaina" user
    When I create a full-day society event blocking all reservations for integration test day 100
    And I am authenticated as a "bazkide" user
    When I POST to "/api/reservations" with calendar test reservation body
    Then the response status should be 409
    And the response body should include property "message"

  Scenario: Reservation succeeds when assembly event does not block
    Given I am authenticated as a "diruzaina" user
    When I create a full-day society assembly event without blocking for integration test day 120
    And I am authenticated as a "bazkide" user
    When I POST to "/api/reservations" with calendar test reservation body
    Then the response status should be 201

  Scenario: Reservation returns 409 when kitchen is blocked and reservation uses kitchen
    Given I am authenticated as a "diruzaina" user
    When I create a full-day society event blocking kitchen only for integration test day 140
    And I am authenticated as a "bazkide" user
    When I POST to "/api/reservations" with calendar test reservation body and kitchen true
    Then the response status should be 409

  Scenario: Reservation succeeds when kitchen is blocked but reservation does not use kitchen
    Given I am authenticated as a "diruzaina" user
    When I create a full-day society event blocking kitchen only for integration test day 160
    And I am authenticated as a "bazkide" user
    When I POST to "/api/reservations" with calendar test reservation body and kitchen false
    Then the response status should be 201

  Scenario: Reservation returns 409 when the table is blocked by a calendar event
    Given I am authenticated as a "bazkide" user
    When I note table "Mahaia 1" id for calendar block tests
    And I am authenticated as a "diruzaina" user
    When I create a society event blocking only the noted table for integration test day 800
    And I am authenticated as a "bazkide" user
    When I POST to "/api/reservations" with calendar test reservation body for noted table "Mahaia 1"
    Then the response status should be 409

  Scenario: Reservation succeeds on same day when a different table is blocked
    Given I am authenticated as a "bazkide" user
    When I note table "Mahaia 1" id for calendar block tests
    And I am authenticated as a "diruzaina" user
    When I create a society event blocking only the noted table for integration test day 800
    And I am authenticated as a "bazkide" user
    When I POST to "/api/reservations" with calendar test reservation body for noted table "Mahaia 2"
    Then the response status should be 201
