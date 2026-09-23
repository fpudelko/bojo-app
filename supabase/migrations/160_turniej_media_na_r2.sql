-- 160_turniej_media_na_r2.sql — galeria i sponsorzy turnieju przenoszą się
-- z bucketu Supabase Storage `turniej-media` (założony w migracji `159`,
-- ale NIGDY realnie nie utworzony w Dashboardzie) na Cloudflare R2.
-- ============================================================================
-- PO CO. Decyzja właściciela z 2026-09-23: R2 zamiast Supabase Storage dla
-- tego jednego bucketu (zero opłat za transfer, osobny limit od reszty
-- Storage). Reszta modułu (`covers`, `avatars`) zostaje na Supabase Storage
-- bez zmian — to dotyczy WYŁĄCZNIE galerii/sponsorów turnieju.
--
-- Tabele `turniej_zdjecia`/`turniej_sponsorzy` i ich RLS (migracja `159`)
-- ZOSTAJĄ bez zmian — kolumny `sciezka`/`sciezka_logo` trzymają teraz klucz
-- obiektu w R2 zamiast ścieżki w Supabase Storage, ale to ten sam tekst,
-- baza nie widzi różnicy.
--
-- Kasujemy wyłącznie polityki `storage.objects`, które i tak nigdy nie miały
-- czego pilnować (bucket nigdy nie powstał) — autoryzację zapisu przejął
-- serwerowy endpoint `/api/turniej-media/*` (Next.js, weryfikuje token
-- Supabase i woła TĘ SAMĄ funkcję `czy_zarzadza_turniejem()`, zanim wyda
-- podpisany URL do R2). Odczyt jest publiczny wprost pod adresem R2, poza
-- bazą — patrz docs/domena.md#turniej-media-cloudflare-r2.
-- ============================================================================

DROP POLICY IF EXISTS "Media turnieju sa publiczne" ON storage.objects;
DROP POLICY IF EXISTS "Media turnieju wgrywa zarzadzajacy" ON storage.objects;
DROP POLICY IF EXISTS "Media turnieju kasuje zarzadzajacy" ON storage.objects;
