@story:cred-2
Feature: Credits API
  As treasurer
  I want to list society credits

  Scenario: Treasurer lists credits grid
    Given the API is available
    And I am authenticated as a "diruzaina" user
    When I GET "/api/credits"
    Then the response status should be 200
    And the response body should include property "data"
