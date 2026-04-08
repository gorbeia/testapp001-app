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
