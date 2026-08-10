Feature: Gebeurtenissen schrijven

  Scenario: Een gebeurtenis controleren zonder technische velden
    Given I open the event admin
    Then the heading "Nieuwe gebeurtenis" is visible
    And no slug field is shown
    When I complete the story of an exact historical event
    And I continue to classification and sources
    And I complete classification and two sources
    And I request the reader preview
    Then stage heading "Controleren & publiceren" has focus
    And I see the rendered event "Constantinopel valt"
    And I see the source "Tweede bron" in the review
    And I see the historical date "29 mei 1453"
    And the inferred event URL ends with "/events/constantinopel-valt-1453"

  Scenario: Een historische schrikkeldatum typen
    Given I open the event admin
    When I complete a story dated "29.02.1500" CE
    And I continue to classification and sources
    Then I reach classification and sources

  Scenario: Een gebeurtenis met een gedeeltelijke datum controleren
    Given I open the event admin
    When I complete a circa BCE story
    And I continue to classification and sources
    And I complete the minimum classification and source
    And I request the reader preview
    Then I see the historical date "ca. 44 v.Chr."

  Scenario Outline: Historische precisie veilig publiceren
    Given GitHub publishing is in dry-run mode
    And I open the event admin
    When I complete a "<precision>" historical story
    And I continue to classification and sources
    And I complete the minimum classification and source
    And I request the reader preview
    Then I see the historical date "<date>"
    When I choose to publish the event
    And I confirm publication
    Then I see that nothing was published

    Examples:
      | precision       | date          |
      | month CE        | november 1918 |
      | year BCE        | 753 v.Chr.    |
      | exact day BCE   | 15 maart 44 v.Chr. |

  Scenario: Een volgende stap krijgt toetsenbordfocus
    Given I open the event admin
    When I complete the story of an exact historical event
    And I continue to classification and sources
    Then stage heading "Indeling & bronnen" has focus

  Scenario: Een nieuw onderwerp zichtbaar toevoegen en verwijderen
    Given I open the event admin
    When I complete the story of an exact historical event
    And I continue to classification and sources
    And I add the new topic "Café-cultuur"
    Then topic "Café-cultuur" is visibly selected
    When I remove topic "Café-cultuur"
    Then topic "Café-cultuur" is no longer shown

  Scenario: Een nieuw onderwerp met zichtbaar label controleren
    Given I open the event admin
    When I complete the story of an exact historical event
    And I continue to classification and sources
    And I add the new topic "Café-cultuur"
    And I complete the minimum classification and source
    And I request the reader preview
    Then I see topic label "Café-cultuur" in the review

  Scenario: Bronnen in de gewenste volgorde zetten
    Given I open the event admin
    When I complete the story of an exact historical event
    And I continue to classification and sources
    And I complete classification and two sources
    And I move source 2 up
    And I request the reader preview
    Then source "Tweede bron" appears before "Fall of Constantinople"

  Scenario: Een extra bron verwijderen
    Given I open the event admin
    When I complete the story of an exact historical event
    And I continue to classification and sources
    And I complete classification and two sources
    And I remove source 2
    And I request the reader preview
    Then source "Tweede bron" is not in the review

  Scenario: Een onmogelijke historische datum direct verbeteren
    Given I open the event admin
    When I complete a story dated 31 April 44 BCE
    And I continue to classification and sources
    Then I see the field error "Kies een mogelijke dag voor deze maand."
    And I remain on the story stage

  Scenario: Een historische dag moet positief zijn
    Given I open the event admin
    When I complete a story dated -1 April 44 BCE
    And I continue to classification and sources
    Then I see the field error "Vul een hele dag groter dan 0 in."
    And I remain on the story stage

  Scenario: Een historisch jaar moet positief zijn
    Given I open the event admin
    When I complete a story dated 1 April 0 BCE
    And I continue to classification and sources
    Then I see the field error "Vul een jaar groter dan 0 in."
    And I remain on the story stage

  Scenario: Een link toevoegen zonder browserprompt
    Given I open the event admin
    When I complete the story of an exact historical event
    And I select story text for a link
    And I choose link formatting
    Then an editor dialog asks for the link URL
    When I apply the link "https://example.org/uitleg"
    And I continue to classification and sources
    And I complete the minimum classification and source
    And I request the reader preview
    Then the rendered story links to "https://example.org/uitleg"
    And canonical Markdown contains "[Meer informatie](https://example.org/uitleg)"

  Scenario: Een onveilige verhaallink weigeren
    Given I open the event admin
    When I select story text for a link
    And I choose link formatting
    And I apply the link "javascript:alert(1)"
    Then the link error "Vul een geldige http- of https-URL in." is announced
    And the link URL has focus

  Scenario: De linkdialoog geeft toetsenbordfocus terug
    Given I open the event admin
    When I choose link formatting
    And I cancel the link dialog
    Then the Link button has focus
    When I choose link formatting
    And I close the link dialog with Escape
    Then the Link button has focus

  Scenario: Publicatie vraagt een duidelijke bevestiging
    Given GitHub publishing commits and triggers deployment
    And I open the event admin
    When I complete a valid event draft through review
    And I choose to publish the event
    Then a publication confirmation names "Constantinopel valt"
    When I confirm publication
    Then the created commit is shown
    And I see that the website update started without claiming the event is live
    And the same draft cannot be published again

  Scenario: Bewerken is geblokkeerd tijdens publiceren
    Given publish responses are delayed
    And I open the event admin
    When I complete a valid event draft through review
    And I choose to publish the event
    And I confirm publication without waiting
    Then review navigation is disabled while publishing
    And publication progress is announced

  Scenario: Opslagproblemen verbergen geen geslaagde publicatie
    Given GitHub publishing commits and triggers deployment
    And browser draft cleanup fails
    And I open the event admin
    When I complete a valid event draft through review
    And I choose to publish the event
    And I confirm publication
    Then I see that the website update started without claiming the event is live
    When I refresh the page
    Then no stale restore notice is shown

  Scenario: Dry-run blijft duidelijk en veilig
    Given GitHub publishing is in dry-run mode
    And I open the event admin
    When I complete a valid event draft through review
    And I choose to publish the event
    And I confirm publication
    Then I see that nothing was published

  Scenario: Een mislukte voorbeeldvraag blijft zichtbaar
    Given preview responses fail without structured errors
    And I open the event admin
    When I complete the story of an exact historical event
    And I continue to classification and sources
    And I complete the minimum classification and source
    And I request the reader preview
    Then I see that the preview could not be made

  Scenario: Een vertraagd voorbeeld maakt gewijzigde inhoud niet publiceerbaar
    Given preview responses are delayed
    And I open the event admin
    When I complete the story of an exact historical event
    And I continue to classification and sources
    And I complete the minimum classification and source
    And I request the reader preview without waiting
    And I change the first source before preview returns
    Then the stale draft does not reach review

  Scenario: Hoofdacties werken met het toetsenbord
    Given GitHub publishing is in dry-run mode
    And I open the event admin
    When I complete the story of an exact historical event
    And I keyboard-activate Continue
    And I complete the minimum classification and source
    And I keyboard-activate Preview
    And I keyboard-activate Publish
    Then a publication confirmation names "Constantinopel valt"

  Scenario: Publicatiebevestiging werkt met toetsenbord
    Given I open the event admin
    When I complete a valid event draft through review
    And I choose to publish the event
    Then safe cancellation has initial focus
    When I close the confirmation with Escape
    Then the publication confirmation is closed
    And publication is still available and focused

  Scenario: Een opgeslagen concept herstellen
    Given a local event draft exists
    When I open the event admin
    And I restore the local draft
    Then the title field contains "Bewaard verhaal"
    And the story editor contains "Een bewaard verhaal."

  Scenario: Een opgeslagen concept verwijderen als browseropslag hapert
    Given a local event draft exists
    And browser draft cleanup fails
    When I open the event admin
    And I discard the local draft
    Then the restore notice is closed
    When I refresh the page
    Then no stale restore notice is shown

  Scenario: Een concept uit de controlefase veilig herstellen
    Given a local review-stage event draft exists
    When I open the event admin
    And I restore the local draft
    Then I resume at classification and sources

  Scenario: Een nieuw concept overleeft verversen
    Given I open the event admin
    When I enter the title "Concept na verversen"
    And I wait until the concept is saved
    And I refresh the page
    And I restore the local draft
    Then the title field contains "Concept na verversen"

  Scenario: Een leeggemaakt concept keert niet terug
    Given I open the event admin
    When I enter the title "Tijdelijk concept"
    And I wait until the concept is saved
    And I clear the title
    And I refresh the page
    Then no stale restore notice is shown

  Scenario: Niet-opgeslagen wijzigingen beschermen
    Given I open the event admin
    When I enter the title "Nog niet opgeslagen"
    And the concept is still being saved
    Then the page warns before leaving

  Scenario: Validering wijst het juiste veld aan
    Given I open the event admin
    When I continue without a title
    Then I see the field error "Vul een titel in."
    And the title field is marked invalid

  Scenario: Servervalidatie keert terug naar het verhaal
    Given I open the event admin
    When I complete a story with the title "!!!"
    And I continue to classification and sources
    And I complete the minimum classification and source
    And I request the reader preview
    Then I remain on the story stage
    And I see the field error "Vul een titel in."

  Scenario: Bronvalidatie blijft bij het juiste veld
    Given I open the event admin
    When I complete the story of an exact historical event
    And I continue to classification and sources
    And I complete classification with an invalid source URL
    And I request the reader preview
    Then the source URL field is marked invalid and described by its error

  Scenario: Deployment opnieuw starten na gedeeltelijk succes
    Given GitHub publishing saves a commit before deployment triggering fails
    And I open the event admin
    When I complete a valid event draft through review
    And I choose to publish the event
    And I confirm publication
    Then I see that the commit was saved but deployment needs a retry
    When I retry the deployment
    Then the created commit is shown
