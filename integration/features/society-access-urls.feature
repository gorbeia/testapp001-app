@society-access-urls @story:subdomain-tenancy
Feature: Society access URL reminder (multitenancy)

  @society-access-urls-mail
  Scenario: Sends email with tenant login links when apex multitenancy is enabled
    When I POST to "/api/public/society-access-urls" with body:
      """
      {"email":"admin@txokoa.eus"}
      """
    Then the response status should be 200
    And the last reminder mail should contain tenant link "guretxokoa.example.com"

  @society-access-no-apex
  Scenario: Society access URL endpoint is unavailable without apex configuration
    When I POST to "/api/public/society-access-urls" with body:
      """
      {"email":"admin@txokoa.eus"}
      """
    Then the response status should be 404

  @society-login-apex-block
  Scenario: Society login is rejected from apex host when multitenancy is enabled
    When I POST to "/api/login" from host "example.com" with body:
      """
      {"email":"admin@txokoa.eus","password":"demo","societyId":"GT001"}
      """
    Then the response status should be 403
    And the response body should contain code "LOGIN_REQUIRES_TENANT_HOST"
