@story:auth-2
Feature: Role-based API access control
  As the system
  I want to enforce role-based permissions on API endpoints
  So that unauthorized users cannot access protected resources

  Background:
    Given the API is available

  Scenario: Member cannot list users
    Given I am authenticated as a "bazkide" user
    When I GET "/api/users"
    Then the response status should be 403

  Scenario: Member cannot create users
    Given I am authenticated as a "bazkide" user
    When I POST to "/api/users" with body:
      """json
      {
        "username": "blocked@test.eus",
        "password": "demo",
        "name": "Should Not Create"
      }
      """
    Then the response status should be 403

  Scenario: Treasurer can list users
    Given I am authenticated as a "diruzaina" user
    When I GET "/api/users"
    Then the response status should be 200

  Scenario: Admin can create users
    Given I am authenticated as a "admin" user
    When I create a unique integration test user via API
    Then the response status should be 201

  Scenario Outline: Unauthenticated requests to protected endpoints return 401
    When I <method> "<path>" without authentication
    Then the response status should be 401

    Examples:
      | method | path                    |
      | GET    | /api/users              |
      | GET    | /api/reservations       |
      | GET    | /api/consumptions       |
      | GET    | /api/account-movements  |
      | GET    | /api/products           |
