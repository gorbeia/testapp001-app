@story:soc-3
Feature: Subscription types API
  As admin
  I want to read subscription types

  Scenario: List subscription types
    Given the API is available
    And I am authenticated as a "admin" user
    When I GET "/api/subscription-types"
    Then the response status should be 200
    And the response body should be a JSON array
