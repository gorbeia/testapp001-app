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

  Scenario: Admin creates a correction for a movement
    Given I am authenticated as a "admin" user
    And a consumption movement exists for "Miren"
    When I create a correction for that movement with amount "10.00" and reason "Overcharged"
    Then the response status should be 201
    And the response body should include property "type" with value "correction"
    And the response body should include property "isCorrection" with value true
    And the response body should include property "referenceType" with value "movement_correction"

  Scenario: Cannot correct a non-existent movement
    Given I am authenticated as a "admin" user
    When I create a correction for movement "00000000-0000-4000-8000-000000000000" with amount "10.00" and reason "Test"
    Then the response status should be 404

  Scenario: Cannot correct a correction
    Given I am authenticated as a "admin" user
    And a correction movement exists for "Miren"
    When I create a correction for that correction movement with amount "5.00" and reason "Test"
    Then the response status should be 400

  Scenario: Cannot correct an already corrected movement
    Given I am authenticated as a "admin" user
    And a consumption movement exists for "Miren"
    And that movement has been corrected
    When I create a correction for that movement with amount "5.00" and reason "Test"
    Then the response status should be 400

  Scenario: Correction requires a reason
    Given I am authenticated as a "admin" user
    And a consumption movement exists for "Miren"
    When I create a correction for that movement with amount "10.00" and reason ""
    Then the response status should be 400

  Scenario: Correction requires non-zero amount
    Given I am authenticated as a "admin" user
    And a consumption movement exists for "Miren"
    When I create a correction for that movement with amount "0" and reason "Test"
    Then the response status should be 400
