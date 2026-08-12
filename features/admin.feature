Feature: Gebeurtenissen schrijven

  Scenario: Veilig instructies voor ChatGPT kopiëren
    Given the browser clipboard accepts copied instructions
    And I open the event admin
    When I choose help from ChatGPT
    Then I see that copied content goes to OpenAI and must not contain student data
    When I type the story title "Bestaand privéconcept"
    And I prepare ChatGPT help for "De val van Constantinopel"
    And I make the ChatGPT instructions
    Then the copy action has focus
    When I copy the ChatGPT instructions
    Then the clipboard contains a source-aware request for "De val van Constantinopel"
    And unrelated story fields were not copied
    And I can open ChatGPT without putting the instructions in the address
    And the normal handoff does not show technical protocol terms

  Scenario: Instructies handmatig kopiëren wanneer het klembord wordt geweigerd
    Given the browser clipboard rejects copied instructions
    And I open the event admin
    When I choose help from ChatGPT
    And I prepare ChatGPT help for "De Belgische onafhankelijkheid"
    And I make the ChatGPT instructions
    And I copy the ChatGPT instructions
    Then selectable manual instructions are focused
    And the manual instructions contain "De Belgische onafhankelijkheid"

  Scenario: Een leeg onderwerp voor ChatGPT krijgt bruikbare uitleg
    Given I open the event admin
    When I choose help from ChatGPT
    And I enter only spaces as the ChatGPT topic
    And I make the ChatGPT instructions
    Then the ChatGPT topic is invalid, described in Dutch, and focused

  Scenario: Gewijzigde voorkeuren maken oude ChatGPT-instructies ongeldig
    Given I open the event admin
    When I choose help from ChatGPT
    And I prepare ChatGPT help for "De Belgische onafhankelijkheid"
    And I make the ChatGPT instructions
    And I change the ChatGPT topic to "De maanlanding"
    Then the ChatGPT instructions must be made again

  Scenario: Een geldig ChatGPT-antwoord vult alleen een leeg concept
    Given the browser clipboard accepts copied instructions
    And I open the event admin
    When I choose help from ChatGPT
    And I prepare ChatGPT help for "De val van Constantinopel"
    And I make the ChatGPT instructions
    And I copy the ChatGPT instructions
    And active ChatGPT request storage disappears
    And I paste a complete ChatGPT answer titled "Ingevoerd geschiedenisverhaal"
    And I check and use the ChatGPT answer
    Then the imported story title is "Ingevoerd geschiedenisverhaal"
    And the imported answer remains visible
    And the imported sources and activity are editable
    And publication still requires a server preview
    And the active ChatGPT request was consumed

  Scenario: Een ongeldig ChatGPT-antwoord bewaart tekst en maakt herstelinstructies
    Given the browser clipboard accepts copied instructions
    And I open the event admin
    When I choose help from ChatGPT
    And I prepare ChatGPT help for "De val van Constantinopel"
    And I make the ChatGPT instructions
    And I type the story title "Mijn eigen werk"
    And I paste the malformed ChatGPT answer "vooraf <script>kapot</script>"
    And I check and use the ChatGPT answer
    Then my story title remains "Mijn eigen werk"
    And the pasted ChatGPT answer remains visible
    And a plain Dutch import error has focus
    When I copy the ChatGPT repair instructions
    Then the clipboard contains repair instructions without the hostile paste
    When I remake the ChatGPT instructions
    Then the old import error and repair action are cleared
    And the pasted ChatGPT answer remains visible

  Scenario: Herstelinstructies blijven kopieerbaar zonder klembordtoegang
    Given the browser clipboard rejects copied instructions
    And I open the event admin
    When I choose help from ChatGPT
    And I prepare ChatGPT help for "De val van Constantinopel"
    And I make the ChatGPT instructions
    And I paste the malformed ChatGPT answer "kapot antwoord"
    And I check and use the ChatGPT answer
    And I copy the ChatGPT repair instructions
    Then selectable manual repair instructions are focused
    And the manual repair instructions do not repeat "kapot antwoord"

  Scenario: Een geldig ChatGPT-antwoord overschrijft bestaand werk niet
    Given the browser clipboard accepts copied instructions
    And I open the event admin
    When I choose help from ChatGPT
    And I prepare ChatGPT help for "De val van Constantinopel"
    And I make the ChatGPT instructions
    And I copy the ChatGPT instructions
    And I type the story title "Mijn bewaarde verhaal"
    And I paste a complete ChatGPT answer titled "Mag niet overschrijven"
    And I check and use the ChatGPT answer
    Then my story title remains "Mijn bewaarde verhaal"
    And the pasted ChatGPT answer remains visible
    And I see that ChatGPT import needs an empty draft

  Scenario: Een bewaard concept wordt niet door ChatGPT overschreven
    Given the browser clipboard accepts copied instructions
    And a local event draft exists
    And I open the event admin
    When I choose help from ChatGPT
    And I prepare ChatGPT help for "De val van Constantinopel"
    And I make the ChatGPT instructions
    And I copy the ChatGPT instructions
    And I paste a complete ChatGPT answer titled "Mag bewaard werk niet overschrijven"
    And I check and use the ChatGPT answer
    Then I see that ChatGPT import needs an empty draft
    And the saved draft can still be restored

  Scenario: Een oud of onvolledig ChatGPT-antwoord faalt veilig
    Given the browser clipboard accepts copied instructions
    And I open the event admin
    When I choose help from ChatGPT
    And I prepare ChatGPT help for "De val van Constantinopel"
    And I make the ChatGPT instructions
    And I copy the ChatGPT instructions
    And I paste a stale ChatGPT answer
    And I check and use the ChatGPT answer
    Then I see that the ChatGPT answer belongs to older instructions

  Scenario: ChatGPT kan veilig melden dat bronnen ontbreken
    Given I open the event admin
    When I choose help from ChatGPT
    And I prepare ChatGPT help for "Onvoldoende gedocumenteerd onderwerp"
    And I make the ChatGPT instructions
    And I paste a cannot-complete ChatGPT answer with a long unbroken reason
    And I check and use the ChatGPT answer
    Then I see why ChatGPT could not make a safe proposal
    And the import feedback reflows on a narrow screen
    And the story remains empty

  Scenario: Een AI-voorstel toont beweringen en ongecontroleerde bronnen
    Given the browser clipboard accepts copied instructions
    And I open the event admin
    When I choose help from ChatGPT
    And I prepare ChatGPT help for "De val van Constantinopel"
    And I make the ChatGPT instructions
    And I copy the ChatGPT instructions
    And I paste a complete ChatGPT answer titled "AI-voorstel voor controle" with a long unbroken second source title
    And I check and use the ChatGPT answer
    And I continue the imported AI proposal to review
    Then I see the imported article and exact classroom activity
    And the exact AI classroom preview remains scrollable on a narrow teacher screen
    And I see AI claims, source relationships, and editorial warnings
    And source link choice is not described as proof or reachability
    And AI source confirmations are unchecked before link choice
    And publication is unavailable until the AI review is complete
    And the AI draft review reflows without horizontal page scrolling

  Scenario: Ontbrekend bewijs in een AI-voorstel blokkeert publicatie
    Given the browser clipboard accepts copied instructions
    And I open the event admin
    When I choose help from ChatGPT
    And I prepare ChatGPT help for "De val van Constantinopel"
    And I make the ChatGPT instructions
    And I copy the ChatGPT instructions
    And I paste a complete ChatGPT answer titled "AI-voorstel met bewijs"
    And I check and use the ChatGPT answer
    And I continue the imported AI proposal to review
    And I remove every current source relationship from the first AI claim
    Then the first AI claim reports missing evidence
    And publication is unavailable until the AI review is complete

  Scenario: Een wijziging aan een AI-bewering vraagt nieuwe controle
    Given the browser clipboard accepts copied instructions
    And I open the event admin
    When I choose help from ChatGPT
    And I prepare ChatGPT help for "De val van Constantinopel"
    And I make the ChatGPT instructions
    And I copy the ChatGPT instructions
    And I paste a complete ChatGPT answer titled "AI-voorstel dat wijzigt"
    And I check and use the ChatGPT answer
    And I continue the imported AI proposal to review
    And I choose and confirm every imported source
    And I confirm every current AI claim
    Then publication is available after AI review
    When I edit the imported story after AI review
    And I continue the imported AI proposal to review
    Then the changed AI proposal warning is visible
    And every AI claim needs review again
    And publication is unavailable until the AI review is complete

  Scenario: Een mislukte voorbeeldcontrole bewaart de AI-controle
    Given the browser clipboard accepts copied instructions
    And preview responses fail without structured errors
    And I open the event admin
    When I choose help from ChatGPT
    And I prepare ChatGPT help for "De val van Constantinopel"
    And I make the ChatGPT instructions
    And I copy the ChatGPT instructions
    And I paste a complete ChatGPT answer titled "AI-voorstel met mislukt voorbeeld"
    And I check and use the ChatGPT answer
    And I continue the imported AI proposal to review
    Then I see that the preview could not be made
    And no publication action is available
    And the AI review provenance remains stored

  Scenario: Een hersteld AI-voorstel omzeilt de broncontrole niet
    Given the browser clipboard accepts copied instructions
    And I open the event admin
    When I choose help from ChatGPT
    And I prepare ChatGPT help for "De val van Constantinopel"
    And I make the ChatGPT instructions
    And I copy the ChatGPT instructions
    And I paste a complete ChatGPT answer titled "Bewaard AI-voorstel"
    And I check and use the ChatGPT answer
    And I continue the imported AI proposal to review
    And I wait until the concept is saved
    And I refresh the page
    And I restore the local draft
    And I request the reader preview
    Then I see the restored AI claim
    And publication is unavailable until the AI review is complete

  Scenario: Een volledig gecontroleerd AI-voorstel wordt veilig gepubliceerd
    Given the browser clipboard accepts copied instructions
    And GitHub publishing commits and triggers deployment
    And I open the event admin
    When I choose help from ChatGPT
    And I prepare ChatGPT help for "De val van Constantinopel"
    And I make the ChatGPT instructions
    And I copy the ChatGPT instructions
    And I paste a complete ChatGPT answer titled "Gecontroleerd AI-voorstel"
    And I check and use the ChatGPT answer
    And I continue the imported AI proposal to review
    And I choose and confirm every imported source
    And I confirm every current AI claim
    And I wait until the concept is saved
    And I refresh the page
    And I restore the local draft
    And I request the reader preview
    Then publication is available after AI review
    When I choose to publish the event
    Then a publication confirmation names "Gecontroleerd AI-voorstel"
    When I confirm publication
    Then the created commit is shown
    And I see that the website update started without claiming the event is live
    And all local draft versions are cleared

  Scenario: Een gebeurtenis controleren zonder technische velden
    Given I open the event admin
    Then the heading "Nieuwe gebeurtenis" is visible
    And no slug field is shown
    And ChatGPT preference fields are hidden until requested
    When I complete the story of an exact historical event
    And I continue to classification and sources
    And I complete classification and two sources
    And I request the reader preview
    Then stage heading "Controleren & publiceren" has focus
    And I see the rendered event "Constantinopel valt"
    And I see the source "Tweede bron" in the review
    And I see the historical date "29 mei 1453"
    And the inferred event URL ends with "/events/constantinopel-valt-1453"
    And no AI review is shown for the manual draft

  Scenario: Een klasactiviteit maken en exact controleren
    Given I open the event admin
    When I complete the story of an exact historical event
    And I continue to classification and sources
    And I complete classification and two sources
    And I create a vote activity with response cards
    And I request the reader preview
    Then authored teacher cues are available in review
    And I can open the exact classroom preview
    And the classroom preview shows response cards
    And the vocational connection appears in the lesson bridge

  Scenario: Een wijziging aan de klasactiviteit maakt het oude voorbeeld ongeldig
    Given I open the event admin
    When I complete the story of an exact historical event
    And I continue to classification and sources
    And I complete classification and two sources
    And I create a vote activity with response cards
    And I request the reader preview
    And I change the activity after preview
    Then the activity needs a fresh preview before publication

  Scenario: Een klasactiviteit blijft bewaard wanneer verwijderen wordt geannuleerd
    Given I open the event admin
    When I complete the story of an exact historical event
    And I continue to classification and sources
    And I complete classification and two sources
    And I create a vote activity with response cards
    And I choose article-only but cancel activity removal
    Then the activity and central question remain

  Scenario: Ongeldige activiteit blijft zichtbaar met een bruikbare veldfout
    Given I open the event admin
    When I complete the story of an exact historical event
    And I continue to classification and sources
    And I complete classification and two sources
    And I create a vote activity with response cards
    And I clear the central activity question
    And I request the reader preview
    Then the activity question remains invalid and described in Dutch

  Scenario Outline: Historische precisie controleren
    Given I open the event admin
    When I complete a "<precision>" historical story
    And I continue to classification and sources
    And I complete the minimum classification and source
    And I request the reader preview
    Then I see the historical date "<date>"

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
