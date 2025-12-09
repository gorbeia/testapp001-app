@society-management
Feature: Society Management
  As an administrator
  I want to modify society data
  So that I can update the society information

  Background:
    Given the application is running
    And I open the login page
    And I log in as a admin user
    And I should see the dashboard instead of the login form

  Scenario: Modify society basic information
    When I navigate to the society page
    Then I should see the current society information
    When I update the society name to "Gure Txokoa Berria"
    And I update the society IBAN to "ES91 2100 0418 4502 0005 1331"
    And I update the society phone to "+34 943 111 223"
    And I save the society changes
    Then I should see a society success message
    And I should see the updated society name
    And I should see the updated society IBAN
    And I should see the updated society phone

  Scenario: Modify society address information
    When I navigate to the society page
    Then I should see the current society information
    When I update the society address to "Kale Berria 25, 20001 Donostia"
    And I update the society email to "info@guretxokoberria.eus"
    And I save the society changes
    Then I should see a society success message
    And I should see the updated society address
    And I should see the updated society email
