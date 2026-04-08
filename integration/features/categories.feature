@story:cons-5
Feature: Product categories API
  As staff
  I want to list categories via the API

  Scenario: Cellarman can list categories
    Given the API is available
    And I am authenticated as a "sotolaria" user
    When I GET "/api/categories"
    Then the response status should be 200
    And the response body should be a JSON array
