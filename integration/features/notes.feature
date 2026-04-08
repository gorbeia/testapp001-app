@story:comm-1
Feature: Notes API
  As a member
  I want to read society notes

  Scenario: List notes
    Given the API is available
    And I am authenticated as a "bazkide" user
    When I GET "/api/notes"
    Then the response status should be 200
    And the response body should be a JSON array
