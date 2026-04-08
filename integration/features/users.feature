@story:user-1
Feature: Users API
  As staff
  I want to query user aggregates via the API

  Scenario: Treasurer can read users count
    Given the API is available
    And I am authenticated as a "diruzaina" user
    When I fetch the users count
    Then the response status should be 200
    And the response body should include count at least 1
