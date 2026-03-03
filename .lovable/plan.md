
## Plan: Leads systeem (admin) + voorbereiding marketing website

### Wat er gebouwd wordt

**In dit admin project:**
1. `leads` tabel in de database (migratie)
2. Leads overzichtspagina in admin
3. "Omzetten naar klus" functionaliteit (navigeert naar NieuweKlus met lead data)
4. NieuweKlus uitbreiden om `lead_id` parameter te lezen en data voor te vullen
5. Sidebar entry "Leads" toevoegen

---

### Database migratie

Nieuwe `leads` tabel:
```sql
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  address text,
  city text,
  postal_code text,
  rooms jsonb DEFAULT '[]'::jsonb,  -- zelfde structuur als NieuweKlus rooms
  advised_price numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'nieuw',  -- nieuw | omgezet | afgewezen
  job_id uuid,                           -- gevuld na omzetten
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: publiek INSERT (voor marketing website), alleen authenticated SELECT/UPDATE
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Publiek kan leads aanmaken"
  ON public.leads FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Authenticated kan leads beheren"
  ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

---

### Nieuwe pagina: `src/pages/admin/Leads.tsx`

- Tabel met alle leads (naam, email, telefoon, stad, prijs, status, datum)
- Filter op status (nieuw / omgezet / afgewezen)
- Per rij: knop "Bekijken" → opent detail dialog
  - Detail toont: contactgegevens, kamers + producten, berekende prijs
  - Knop "Omzetten naar klus" → navigeert naar `/admin/klussen/nieuw?lead_id=xxx`
  - Knop "Afwijzen" → zet status op 'afgewezen'
- Badge teller "nieuw" zichtbaar in sidebar

---

### NieuweKlus aanpassen

In `useEffect` bij mount: als `searchParams.get("lead_id")` bestaat:
- Haal lead op uit Supabase
- Vul voor: naam/email/telefoon/adres (nieuwe klant formulier)
- Vul rooms voor (met producten)
- Sla `advised_price` over als startwaarde

Na succesvol aanmaken van de klus: update `leads` record met `status: 'omgezet'` en `job_id: newJobId`

---

### Sidebar & routing

- `AdminSidebar.tsx`: "Leads" toevoegen met `Inbox` icon, tussen Klussen en Agenda
- `AdminLayout.tsx`: bottom nav bijwerken
- `App.tsx`: route `/admin/leads` toevoegen

---

### Bestanden die worden aangepast/aangemaakt

| Bestand | Wijziging |
|---------|-----------|
| Database migratie | `leads` tabel + RLS |
| `src/pages/admin/Leads.tsx` | Nieuw — overzicht + detail dialog |
| `src/pages/admin/NieuweKlus.tsx` | lead_id param lezen, data prefill, lead markeren als omgezet |
| `src/components/AdminSidebar.tsx` | "Leads" menu item toevoegen |
| `src/components/AdminLayout.tsx` | "Leads" in bottom nav |
| `src/App.tsx` | Route toevoegen |
| `src/types/database.ts` | `Lead` type toevoegen |

---

### Marketing website (apart project)

Na dit plan heb je alles klaar om een apart Lovable project te starten dat:
- Dezelfde Supabase URL + anon key gebruikt
- `products` en `product_categories` leest (publiek SELECT al toegestaan via huidige RLS? Nee — huidige policies zijn "authenticated only". We voegen ook publieke SELECT toe aan products/categories in deze migratie)
- Leads insert (al geregeld met bovenstaande RLS)

In de migratie voegen we ook toe:
```sql
-- Publiek kan producten en categorieën lezen (voor marketing website)
CREATE POLICY "Publiek kan producten lezen" ON public.products FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "Publiek kan categorieën lezen" ON public.product_categories FOR SELECT TO anon USING (true);
CREATE POLICY "Publiek kan category links lezen" ON public.product_category_links FOR SELECT TO anon USING (true);
```
