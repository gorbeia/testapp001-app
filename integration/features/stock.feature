@story:inv-3 @story:inv-4
Feature: Stock movements API
  As cellarman
  I want to view stock history and post adjustments

  Background:
    Given the API is available
    And I am authenticated as a "sotolaria" user

  Scenario: List stock movements
    When I GET "/api/stock-movements"
    Then the response status should be 200

  Scenario: Post manual stock adjustment
    Given I have a manual stock product id from the catalog
    When I post a stock adjustment of 1 for the catalog product
    Then the response status should be 201
