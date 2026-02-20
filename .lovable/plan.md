

# Admin Dashboard – Kringloop Komtgoed

## Overzicht
Een compleet, overzichtelijk admin dashboard met een licht & clean design. Rustige kleuren, veel witruimte, en een duidelijke sidebar-navigatie. Het dashboard wordt gebouwd met authenticatie en een eigen Supabase-server als backend.

---

## 1. Authenticatie & Inlogscherm
- Modern inlogscherm met bedrijfsnaam "Kringloop Komtgoed"
- E-mail/wachtwoord login via Supabase Auth
- Wachtwoord vergeten & reset functionaliteit
- Beschermde routes: alleen ingelogde gebruikers zien het dashboard

## 2. Layout & Navigatie
- Zijbalk (sidebar) met alle tabbladen en iconen
- In te klappen sidebar voor meer werkruimte
- Alle pagina's bereikbaar onder `/admin/*`
- Responsive maar primair desktop-gericht

## 3. Dashboard (Startpagina)
- Overzicht met kernstatistieken: aantal openstaande klussen, aantal klanten, openstaande facturen, omzet
- Snelle acties: nieuwe klus aanmaken, recente activiteit
- Grafiekjes met omzet/klussen per maand

## 4. Klanten
- Overzicht van alle klanten in een tabel (zoeken, filteren)
- Klantdetailpagina met contactgegevens en gekoppelde klussen
- Klant toevoegen/bewerken

## 5. Klussen (Aanvragen)
- Overzicht van alle klussen/aanvragen met statusfilter
- **+ knop** om handmatig een nieuwe klus/aanvraag aan te maken
- Later worden hier ook aanvragen vanuit de frontend website getoond

### Workflow nieuwe klus aanmaken (stappen):
**Stap 1 – Klantgegevens**
- Bestaande klant selecteren of nieuwe klant aanmaken
- Adres invullen → voorrijkosten worden automatisch berekend op basis van afstand:
  - Tot 75 km: €89 incl. BTW
  - 75-150 km: €115 incl. BTW
  - Meer dan 150 km: €145 incl. BTW

**Stap 2 – Type opdracht kiezen**
- **Optie A: Producten** – Producten selecteren uit productcatalogus, prijzen worden overgenomen
- **Optie B: Ontruiming** – Alle relevante producten selecteren, bedragen worden opgeteld tot een totaal adviesprijs. Admin kan adviesprijs aanpassen naar eigen prijs

**Stap 3 – Kosten & Korting**
- Overige kosten toevoegen (wordt bij totaal opgeteld)
- Korting toepassen: percentage óf vast bedrag
- Totaaloverzicht met voorrijkosten, producten, overige kosten en korting

**Stap 4 – Werkadres & Planning**
- Werkadres invullen
- Datum kiezen óf "Direct uitvoeren" aanvinken

**Stap 5 – Offerte versturen**
- Overzicht van de complete offerte
- Offerte versturen (voorbereiding voor Snelstart API-koppeling, later te activeren)

**Stap 6 – Klus uitvoeren**
- Status wijzigen naar "In uitvoering"

**Stap 7 – Oplevering maken**
- Lijst met alle werkzaamheden uit de offerte
- Foto's uploaden per werkzaamheid
- Bedrijfslogo en bedrijfsinformatie worden automatisch toegevoegd
- PDF-generatie van opleveringsdocument

**Stap 8 – Extra bijverkoop**
- Extra producten/diensten toevoegen met bedrag
- Wordt meegenomen op de factuur

**Stap 9 – Factuur versturen**
- Factuur genereren op basis van offerte + eventuele bijverkoop
- Voorbereiding voor Snelstart API-koppeling

## 6. Planbord
- Visuele weekplanning/kalender met ingeplande klussen
- Drag & drop of klik om klussen in te plannen
- Overzicht per dag/week

## 7. Opleveringen
- Overzicht van alle opleveringen
- Status bijhouden (in concept, afgerond)
- Opleveringsdocument bekijken als PDF

## 8. Producten
- Productcatalogus beheren (naam, beschrijving, prijs)
- Producten toevoegen, bewerken, verwijderen
- Categorieën voor overzicht

## 9. Financieel
- Overzicht van alle offertes en facturen
- Status bijhouden: betaald/onbetaald
- Voorbereiding voor synchronisatie met Snelstart API (later)
- Totaaloverzichten en filters op periode

## 10. Gebruikers
- Medewerkers toevoegen/beheren
- Rollen toekennen (admin, medewerker) via aparte roltabel in Supabase
- Medewerker activeren/deactiveren

## 11. Instellingen
- Wachtwoord wijzigen
- Voorrijkosten configureren (de 3 tariefzones aanpasbaar)
- Bedrijfsinformatie & logo instellen (voor op offertes/opleveringen)

---

## Database (Supabase)
Tabellen worden aangemaakt voor: klanten, klussen, producten, offertes, facturen, opleveringen, gebruikersrollen, instellingen. Met Row Level Security (RLS) en authenticatie.

## Wat later komt
- Frontend website voor klantaanvragen
- Snelstart API-koppeling (offertes & facturen)
- Betalingsstatus synchronisatie

