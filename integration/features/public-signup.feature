@story:public-signup
Feature: Public society self-signup

  Scenario: Check subdomain availability for an unused label
    When I GET "/api/public/check-subdomain?value=integration-test-avail-xyz"
    Then the response status should be 200
    And the response body should include property "available"
    And the response body should include "available" equal to "true"

  Scenario: Signup creates society with bootstrap category and table
    When I submit a valid public society signup
    Then the response status should be 201
    And the last signup society should have default provision data

  Scenario: Signup creates society and login requires verified email
    When I submit a valid public society signup
    Then the response status should be 201
    And the response body should include property "alphabeticId"
    When I attempt login with the last public signup user
    Then the response status should be 403
    When I mark the last signup user as email verified in the database
    When I attempt login with the last public signup user
    Then the response status should be 200
    And the response should set cookie "auth-token"
