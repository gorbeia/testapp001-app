@society-setup-checklist
Feature: Society setup checklist API

  Admin-only endpoint that returns go-live checklist progress for the authenticated tenant.

  Scenario: Admin can fetch the society setup checklist
    Given I am authenticated as a "admin" user
    When I GET "/api/societies/setup-checklist"
    Then the response status should be 200
    And the response body should include property "items"
    And the setup checklist items should include the core ids

  Scenario: Non-admin cannot fetch the society setup checklist
    Given I am authenticated as a "bazkide" user
    When I GET "/api/societies/setup-checklist"
    Then the response status should be 403
