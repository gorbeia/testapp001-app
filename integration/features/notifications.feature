@story:comm-4
Feature: Notifications API
  As a member
  I want to read notifications

  Scenario: List notifications
    Given the API is available
    And I am authenticated as a "bazkide" user
    When I GET "/api/notifications"
    Then the response status should be 200
