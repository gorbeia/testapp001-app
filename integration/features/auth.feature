@story:auth-1 @story:auth-4
Feature: Authentication API
  As a society member
  I want to authenticate via the API
  So that I receive a valid session

  Background:
    Given the API is available

  Scenario: Successful login returns user and tokens
    When I POST to "/api/login" with body:
      """json
      {
        "email": "admin@txokoa.eus",
        "password": "demo",
        "societyId": "GT001"
      }
      """
    Then the response status should be 200
    And the response body should include property "user"
    And the response should set cookie "auth-token"
    And the response should set cookie "refresh-token"

  Scenario: Login with wrong password returns 401
    When I POST to "/api/login" with body:
      """json
      {
        "email": "admin@txokoa.eus",
        "password": "wrong",
        "societyId": "GT001"
      }
      """
    Then the response status should be 401

  Scenario: Login with nonexistent society returns 401
    When I POST to "/api/login" with body:
      """json
      {
        "email": "admin@txokoa.eus",
        "password": "demo",
        "societyId": "NOPE"
      }
      """
    Then the response status should be 401

  Scenario: Refresh token renews access token
    Given I am authenticated as a "admin" user
    When I POST to "/api/refresh" with stored cookies
    Then the response status should be 200
    And the response should set cookie "auth-token"

  Scenario: Logout returns success
    Given I am authenticated as a "admin" user
    When I POST to "/api/logout"
    Then the response status should be 200
