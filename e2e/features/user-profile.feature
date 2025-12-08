Feature: User Profile Management
  As a logged-in user
  I want to view and edit my profile information
  So that I can keep my personal details up to date

  Scenario: View user profile
    Given the application is running
    And I open the login page
    And I log in as a bazkide user
    Then I should see the dashboard instead of the login form
    When I navigate to the profile page
    Then I should see the profile page
    And I should see my user information
    And I should see the contact information section
    And I should see the edit button

  Scenario: Edit IBAN field
    Given the application is running
    And I open the login page
    And I log in as a sotolaria user
    Then I should see the dashboard instead of the login form
    When I navigate to the profile page
    And I click the edit button
    Then I should see the edit form
    And I should see the IBAN input field
    When I fill in the IBAN field with "ES91 2100 0418 4502 0005 1338"
    And I click the save button
    Then I should see the updated IBAN value
    And I should not see the edit form

  Scenario: Cancel editing
    Given the application is running
    And I open the login page
    And I log in as a laguna user
    Then I should see the dashboard instead of the login form
    When I navigate to the profile page
    And I click the edit button
    Then I should see the edit form
    When I fill in the IBAN field with "ES91 2100 0418 4502 0005 9999"
    And I click the cancel button
    Then I should see the original IBAN value
    And I should not see the edit form
