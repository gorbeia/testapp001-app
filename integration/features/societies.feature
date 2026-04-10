@story:soc-1
Feature: Societies API
  As treasurer or admin
  I want to read and update own society settings

  Background:
    Given the API is available
    And I am authenticated as a "diruzaina" user
    And I have loaded my society id from the user endpoint

  Scenario: Update society phone
    When I update my society phone via API
    Then the response status should be 200
    And the response body should include property "phone"

  @society-reservation-meal-types-put @story:soc-1
  Scenario: Update reservation meal types via API
    When I update my society reservation meal types to the integration test list via API
    Then the response status should be 200
    And my society from the user endpoint should include the integration test meal type ids
