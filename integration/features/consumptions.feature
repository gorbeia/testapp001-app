@story:cons-1 @story:cons-4 @story:cons-7
Feature: Consumption API
  As a member
  I want to open a consumption session, add items, and close it
  So that bar purchases are recorded

  Background:
    Given the API is available
    And I am authenticated as a "bazkide" user
    And I have loaded the first catalog product id

  Scenario: Create consumption, add item, close
    Given I have an open consumption session
    When I add one unit of the catalog product to the open consumption
    Then the response status should be 201
    When I close the open consumption
    Then the response status should be 200
    And the closed consumption appears in my history
