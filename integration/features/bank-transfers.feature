@story:ledger-3
Feature: Bank transfer prepayment API
  As a treasurer or member
  I want prepayment proposals via the API
  So that balances update when validated

  Background:
    Given the API is available

  Scenario: Member proposes a prepayment
    Given I am authenticated as a "bazkide" user
    When I POST to "/api/bank-transfers/me" with body:
      """json
      {
        "amount": "50.00",
        "transferDate": "2026-06-15",
        "reference": "INT-PROP",
        "notes": "integration"
      }
      """
    Then the response status should be 201
    And the response body should include property "status"
    And the response body should include "status" equal to "pending"

  Scenario: Admin validates a pending prepayment for Miren
    Given I am authenticated as a "admin" user
    And there is a pending bank transfer for Miren
    When I validate the pending bank transfer
    Then the response status should be 200

  Scenario: Admin rejects a pending prepayment for Miren
    Given I am authenticated as a "admin" user
    And there is a pending bank transfer for Miren
    When I reject the pending bank transfer
    Then the response status should be 200

  Scenario: Member cannot validate arbitrary prepayment ids
    Given I am authenticated as a "bazkide" user
    When I PUT to "/api/bank-transfers/00000000-0000-4000-8000-000000000000/validate" with body:
      """json
      {}
      """
    Then the response status should be 403
