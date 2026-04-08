@story:ledger-1 @story:ledger-4 @story:ledger-6
Feature: Account movements API
  As a member or treasurer
  I want to read movements and staff to post adjustments via API

  Background:
    Given the API is available

  Scenario: Member reads own movements
    Given I am authenticated as a "bazkide" user
    When I GET "/api/account-movements/me"
    Then the response status should be 200
    And the response body should include property "movements"

  Scenario: Treasurer records a refund for a member
    Given I am authenticated as a "admin" user
    When I record a refund for Miren via API
    Then the response status should be 201

  Scenario: SEPA bounce returns 404 for unknown credit
    Given I am authenticated as a "admin" user
    When I POST SEPA bounce with a non-existent credit id
    Then the response status should be 404
