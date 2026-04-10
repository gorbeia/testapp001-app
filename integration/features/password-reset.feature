@story:auth-8
Feature: Password reset (society members)
  As a society member
  I want to reset my password by email
  So that I can sign in if I forgot it

  Background:
    Given the API is available

  @password-reset-mail
  Scenario: Forgot password sends email and reset allows login with new password
    When I POST to "/api/public/forgot-password" with body:
      """json
      {
        "email": "admin@txokoa.eus",
        "societyId": "GT001"
      }
      """
    Then the response status should be 200
    And the response body should include property "ok"
    And the last outbound mail should contain a password reset link
    When I POST to "/api/public/reset-password" with body from last mail token and new password "newpass999"
    Then the response status should be 200
    When I POST to "/api/login" with body:
      """json
      {
        "email": "admin@txokoa.eus",
        "password": "newpass999",
        "societyId": "GT001"
      }
      """
    Then the response status should be 200

  Scenario: Forgot password returns 200 for unknown email without leaking
    When I POST to "/api/public/forgot-password" with body:
      """json
      {
        "email": "nobody-known@example.test",
        "societyId": "GT001"
      }
      """
    Then the response status should be 200
    And the response body should include property "ok"

  Scenario: Reset password rejects invalid token
    When I POST to "/api/public/reset-password" with body:
      """json
      {
        "token": "not-a-valid-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "newPassword": "somepass12"
      }
      """
    Then the response status should be 400

  Scenario: Forgot password requires society id on apex
    When I POST to "/api/public/forgot-password" with body:
      """json
      {
        "email": "admin@txokoa.eus"
      }
      """
    Then the response status should be 400
