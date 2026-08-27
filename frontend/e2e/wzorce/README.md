# Wzorce zrzutów ekranu

Cztery katalogi (`zrzuty-{telefon,komputer}`, `scenariusze-{telefon,komputer}`)
odpowiadają projektom Playwrighta w `playwright.config.ts`. Pliki wchodzą do repo
WYŁĄCZNIE po etykiecie `zrzuty:zaakceptuj` na PR-ze — `.github/dopisz-wzorce.sh`
w `wizualne.yml`. Szczegóły mechanizmu i uzasadnienie („dlaczego nie cicho") są
w AGENTS.md, sekcja „Regresja wizualna".

**Pułapka, którą trzeba znać:** `wizualne.yml` ma filtr `paths: frontend/**`, więc
PR bez ŻADNEJ zmiany pod `frontend/` nie uruchamia workflowu wcale — nawet po
nadaniu etykiety na zdarzeniu `labeled`. Ten plik istnieje częściowo właśnie po to,
żeby dedykowany PR „tylko odśwież wzorce" miał czym przekroczyć ten filtr, zamiast
zgadywać za każdym razem, który plik dotknąć.

Ostatnie pełne odświeżenie: 2026-08-27 (`docs/seo-geo-strategia.md`, rozdział 0 —
dryf od PR #217).

**Druga pułapka, odkryta w tym samym PR-ze:** gdy `.github/dopisz-wzorce.sh`
wypycha commit jako `github-actions[bot]`, kolejny przebieg CI na tym PR-ze
ląduje w stanie `action_required` — GitHub wymaga wtedy ręcznej zgody
(„Approve and run") od kogoś z dostępem do zapisu, zanim `ci.yml` i
`wizualne.yml` w ogóle wystartują na tym commicie. Push zwykłego współpracownika
nad tym commitem odblokowuje kolejny przebieg bez zgody. Jeśli PR z etykietą
`zrzuty:zaakceptuj` utknie bez zielonego CI po dopisaniu wzorców — to jest ten
mechanizm, nie błąd w skrypcie.
