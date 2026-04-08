@story:cons-9
Feature: Cash settlement API
  As a member
  I can query pending cash items when enabled

  Scenario: Pending cash items endpoint responds
    Given the API is available
    And cash settlement is enabled for the demo society
    And I am authenticated as a "bazkide" user
    When I GET "/api/me/pending-cash-items"
    Then the response status should be 200
