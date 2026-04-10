@story:inv-1
Feature: Products API
  As cellarman or admin
  I want to manage products via the API

  Background:
    Given the API is available
    And I am authenticated as a "sotolaria" user
    And I store the first category id from the catalog

  Scenario: Create and delete a product
    When I create a unique integration test product via API
    Then the response status should be 201
    When I delete the last created product via API
    Then the response status should be 204

  Scenario: Create product with predefined catalog image
    When I create a unique integration test product with catalog image via API
    Then the response status should be 201
    And the response body should include "imageUrl" equal to "/catalog/products/cocacola.png"
    When I delete the last created product via API
    Then the response status should be 204

  Scenario: Create product rejects invalid catalog image path
    When I create an integration test product with invalid catalog imageUrl via API
    Then the response status should be 400

  Scenario: Update product with catalog image via PUT
    When I create a unique integration test product via API
    Then the response status should be 201
    When I PUT the catalog tortilla image on the last created product via API
    Then the response status should be 200
    And the response body should include "imageUrl" equal to "/catalog/products/tortilla.png"
    When I delete the last created product via API
    Then the response status should be 204
