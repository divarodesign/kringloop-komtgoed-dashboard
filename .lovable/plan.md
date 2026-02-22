

# Klus Workflow Uitbreiding: Inplannen, Toewijzen, Opleveren, PDF & Agenda

## Samenvatting
Na het versturen van een offerte ontbreken er nu actieknoppen op de klus-detailpagina. Dit plan voegt vier grote onderdelen toe:
1. **Workflow-actieknoppen** op de klus-detailpagina (inplannen, medewerker toewijzen)
2. **Opleveringsproces** met foto-uploads per kamer
3. **PDF-generatie** van het opleveringsdocument met bedrijfsbranding, permanent opgeslagen in Supabase Storage
4. **Agenda-integratie** -- toegewezen medewerker tonen op agenda-items

---

## 1. Workflow-actieknoppen op KlusDetail

Op de klus-detailpagina komen contextafhankelijke actieknoppen, afhankelijk van de huidige status:

| Status | Actie | Wat er gebeurt |
|--------|-------|----------------|
| `offerte_verstuurd` | **Inplannen** | Opent formulier voor datum, tijd en medewerker. Slaat op en zet status naar `in_uitvoering`. |
| `in_uitvoering` | **Oplevering starten** | Maakt een `delivery` record aan (status "concept"), zet jobstatus naar `oplevering`. |
| `oplevering` | Opleveringssectie zichtbaar | Foto-upload per kamer + knop "Oplevering voltooien". |

### Inplan-formulier
- Datumpicker (bestaande Calendar component)
- Tijdveld (tekst input)
- Medewerker-dropdown (uit profiles tabel)
- Opslaan knop die `scheduled_date`, `scheduled_time` en `assigned_to` op de job updatet

---

## 2. Opleveringsproces

### Hoe het werkt
- Per kamer (afgeleid uit de `job_items` groepering op `room_name`) moet minimaal 1 foto worden geupload.
- Foto's worden geupload naar de bestaande `delivery-photos` storage bucket.
- Referenties worden opgeslagen in de `delivery_photos` tabel.
- Zolang niet alle kamers een foto hebben, is de knop "Oplevering voltooien" uitgeschakeld.
- Bij voltooien: PDF wordt gegenereerd, delivery status wordt `afgerond`, job status wordt `gefactureerd`.

### UI op de klus-detailpagina
Een nieuwe Card "Oplevering" verschijnt wanneer een delivery record bestaat:
- Per kamer een sectie met kamernaam als header
- Upload-knop voor foto's per kamer
- Thumbnail-preview van geuploadde foto's met verwijder-optie
- Onderaan: knop "Oplevering voltooien" (disabled totdat elke kamer minimaal 1 foto heeft)
- Na voltooiing: knop "PDF downloaden" om het opgeslagen document te openen

---

## 3. PDF-generatie (Edge Function)

Een nieuwe Edge Function `generate-delivery-pdf` genereert het opleveringsdocument.

### PDF Structuur

**Pagina 1: Overzicht**
- Bedrijfslogo en bedrijfsgegevens (uit `settings` tabel, key `company_info`)
- Klantgegevens (naam, adres, contactgegevens)
- Klusnaam en uitvoeringsdatum
- Per kamer: lijst van uitgevoerde werkzaamheden (alleen beschrijvingen, geen prijzen)

**Volgende pagina's: Foto's**
- 1 foto per pagina
- Kamernaam als bijschrift bovenaan elke pagina
- Foto groot gecentreerd op de pagina

### Opslag
- PDF wordt geupload naar een nieuwe storage bucket `delivery-pdfs` (public)
- De publieke URL wordt opgeslagen in het nieuwe `pdf_url` veld op de `deliveries` tabel
- De PDF blijft permanent beschikbaar en kan altijd worden bekeken of gedownload

---

## 4. Agenda-integratie

De agenda toont nu al klussen met een ingeplande datum. De uitbreiding:
- Bij het opbouwen van agenda-items worden de `profiles` opgehaald
- De naam van de toegewezen medewerker wordt getoond op de agenda-kaart (onder de klantnaam)
- Zichtbaar als een klein label, bijv. "Medewerker: Jan de Vries"

---

## 5. Opleveringen overzichtspagina

De bestaande Opleveringen pagina wordt uitgebreid:
- Rijen zijn klikbaar en navigeren naar de klus-detailpagina
- Bij afgeronde opleveringen verschijnt een PDF download-knop

---

## Technische Details

### Database wijzigingen
1. **`deliveries` tabel**: nieuw veld `pdf_url` (text, nullable)
2. **Nieuwe storage bucket**: `delivery-pdfs` (public) -- aangemaakt via SQL migratie

### Nieuwe Edge Function: `generate-delivery-pdf`
- Ontvangt `delivery_id` als parameter
- Gebruikt Supabase service role key om data op te halen
- Haalt op: delivery, job, klant, job_items (gegroepeerd per room_name), delivery_photos, company_info setting
- Genereert PDF met `jsPDF` library (beschikbaar via CDN import in Deno)
- Laadt bedrijfslogo als base64 vanuit `company-assets` bucket (indien aanwezig)
- Uploadt PDF naar `delivery-pdfs` bucket
- Slaat `pdf_url` op in delivery record
- Retourneert de publieke URL
- Config: `verify_jwt = false` in `supabase/config.toml`

### Bestanden die worden aangepast

| Bestand | Wijziging |
|---------|-----------|
| `src/pages/admin/KlusDetail.tsx` | Workflow-actieknoppen, inplan-formulier, opleveringssectie met foto-uploads en PDF download |
| `src/pages/admin/Agenda.tsx` | Profiles ophalen, medewerker-naam tonen op agenda-items |
| `src/pages/admin/Opleveringen.tsx` | Klikbaar naar klus, PDF download-knop |
| `src/types/database.ts` | `pdf_url` veld toevoegen aan Delivery type |
| `supabase/functions/generate-delivery-pdf/index.ts` | Nieuwe edge function (nieuw bestand) |
| `supabase/config.toml` | Config voor nieuwe edge function |
| Database migratie | `pdf_url` kolom + `delivery-pdfs` bucket |

### Volgorde van implementatie
1. Database migratie (kolom + bucket)
2. Type-update in `database.ts`
3. Edge function `generate-delivery-pdf`
4. KlusDetail uitbreiden (workflow knoppen, inplannen, oplevering)
5. Agenda uitbreiden (medewerker tonen)
6. Opleveringen pagina uitbreiden

