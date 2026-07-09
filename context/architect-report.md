---
title: Raport architektoniczny — Moduł 4 (10xArchitect)
created: 2026-07-09
type: architect-report
---

# Raport architektoniczny — Moduł 4 (10xArchitect)

Wszystkie cztery wejścia (L2–L5) powstały na **jednym repozytorium: `a11y-sdk`**. Nie ma tu materiału z różnych projektów — każdy artefakt jest odnotowany osobno poniżej dla zgodności ze strukturą raportu, ale wskazuje na to samo repo.

## 1. Opisane projekty

| Repo | Stack | Skala (orientacyjnie) | Artefakt(y) |
|---|---|---|---|
| **a11y-sdk** | TypeScript (`src/*.ts`, budowane przez `tsup`), dystrybuowane jako CLI-toolkit (`toolkit/scripts/*.cjs`) + hand-written bash (`setup.sh`) + deklaratywne ESLint flat-configi (`toolkit/config/eslint/*.cjs`) dla React/Vue/Svelte/Angular. `product_type: developer_tool` (`prd.md` frontmatter). | Mała-średnia: 5 plików logiki domenowej w `src/` (`detect-framework.ts`, `config-loader.ts`, `rule-filter.ts`, `pre-commit.ts`, `audit.ts`), 4 sample-apps do walidacji, jeden pipeline CI. Brak bazy danych, brak UI graficznego — jedyny trwały stan to jeden plik JSON konfiguracji w projekcie konsumenta. | L2, L3, L4, L5 (wszystkie) |

Produkt (z `prd.md`, kontekst do sekcji 1): a11y-sdk wstrzykuje wymuszanie dostępności (WCAG 2.1 AA) w trzech miejscach na raz — w kontekście AI-asystenta, przy commicie (blokująco) i on-demand (audyt żywej strony). Trzy Success Criteria (`prd.md:20-22`) to: AI generuje kod zgodny z WCAG bez pytania, commit z naruszeniem jest blokowany z cytatem WCAG, audyt zwraca naruszenia pogrupowane po kryterium WCAG i sortowane po impakcie.

## 2. Mapa projektu (z L2)

- **Kluczowy, zweryfikowany fakt strukturalny:** `toolkit/scripts/*.cjs` to prawdziwe build-outputy `src/*.ts` (drugi target `tsup.config.ts`, wymuszany przez CI-krok `pnpm build:toolkit` + `test -f` na trzech plikach), **nie** ręcznie duplikowane pliki — hipoteza odwrotna została explicite postawiona i odrzucona (`repo-map.md:48-61`).
- **Odwrócona konwencja "nie commituj build-outputu":** zbudowane `.cjs` są mimo to trzymane w git, bo dystrybucja to `cp -r toolkit/` bez żadnego kroku instalacji/budowania po stronie konsumenta — build-output musi być zawsze aktualny na dysku, inaczej świeży copy-paste natychmiast się psuje (`repo-map.md:57`).
- **Lokalne centrum poza pipeline'em:** `toolkit/config/eslint/*.cjs` (4 pliki) są celowo ręcznie pisane, bez odpowiednika w `src/` — deklaratywne, testowane end-to-end przez `pre-commit-integration.test.ts`, nie unit-testami (`repo-map.md:61`).
- **Entry pointy:** `src/pre-commit.ts` (Layer 2, git hook) i `src/audit.ts` (Layer 3, CLI) — najbliższe odpowiedniki "API" w projekcie bez klienta/serwera.
- **Najważniejszy unknown / kruchość:** dwa miejsca z niejawnym, relative-path sprzężeniem między katalogami (`toolkit/scripts/` ↔ `toolkit/config/eslint/`, oraz `toolkit/hooks/pre-commit` ↔ `../scripts/pre-commit.cjs`) — działa dziś, ale nic nie wymusza, że te ścieżki zostają siostrzane, jeśli layout się zmieni (`repo-map.md:71-74`).

## 3. Analiza ficzera (z L3)

**Uwaga o naturze tego artefaktu.** L3 tutaj nie jest studium ryzykownego, już zaimplementowanego przepływu — jest to *feature research* nad pytaniem, czy przekształcić copy-paste-dystrybuowany toolkit w wersjonowany, wydany artefakt (npm lub GitHub Releases). Motywacja: certyfikacja 10xChampion nazywa "artifact registry" (lista wydanych wersji) jako wymóg, a ten wymóg jest dziś niespełniony nie z powodu odrzuconej próby, ale bo proces wydawania w ogóle nie istnieje (`research.md:14-16`) — to jest kontekst wystarczający do zrozumienia motywacji, bez dalszego wchodzenia w mechanikę certyfikacji.

**Który przepływ i dlaczego (link do mapy):** Badany "przepływ" to nie runtime-flow, a decyzja architektoniczna nad tym, co dziś jest "źródłem prawdy" wg L2 — cały `toolkit/` na commicie HEAD jest tym, co się kopiuje, bez packaging-step (`research.md:26`). To bezpośrednio rozszerza strefę ryzyka z L2 (odwrócona konwencja build-outputu w git) na pytanie "co to znaczy zapakować/zawersjonować tę samą rzecz".

**Feature overview:** Input to obecny stan repo — brak `git tag`, brak `gh release`, `package.json` z `version: "0.1.0"`, ale nic nie zamienia tego w wydany artefakt (`research.md:14`). Stan zmienia się przez wybór jednego z trzech mechanizmów: npm publish, GitHub Releases z tagowanym tarballem, albo oba, sekwencjonowane (`research.md:49`). Co wraca: rekomendacja (nie ostateczna decyzja) — GitHub Releases pasuje lepiej do dzisiejszej filozofii "copy once, own it", npm dawałby coś bliższego formalnemu rejestrowi wersji, ale wymaga potwierdzenia, czego dokładnie wymaga rubryka certyfikacyjna (`research.md:47,53`).

**Technical debt — najważniejsze ryzyka:**
1. **Semver jest niejednoznaczny na granicy ESLint 9/10.** Naprawa wsparcia ESLint 10 nie jest oczywiście patch/minor/major — zależy, czy zmiana jest addytywna czy zmienia deklarowany zakres peer-dependency; dziś ten constraint żyje tylko w komentarzach kodu, nie jako formalna deklaracja (`research.md:37`).
2. **Cztery frameworkowe ESLint-configi starzeją się niezależnie od siebie**, więc jeden numer wersji dla całego toolkitu zawsze konflatuje "React bump" z "Svelte bez zmian" — realny koszt niezależnie od wybranego mechanizmu wydawania (`research.md:38`).
3. **Weryfikacja potwierdzona bezpośrednim grepem/Read, nie ast-grepem.** W tej sesji nie użyto ast-grep — weryfikacja rozjazdów w L5 (`01-domain-distillation.md`, `03-anti-corruption-layer.md`) była wykonana przez bezpośredni `grep -rn "eslint" src/ toolkit/` i `grep -rln "axe-core\|playwright" src/ toolkit/` (`03-anti-corruption-layer.md:23,43,188`), Read pełnych plików, oraz **żywe uruchomienie ESLint-a** (Node.js + `eslint@9.39.4` + `eslint-plugin-svelte@3.19.0` z zainstalowanych `node_modules`) przeciw `svelte.cjs` i `samples/svelte-app/src/App.svelte`, potwierdzające, że każde naruszenie Svelte raportuje `ruleId === "svelte/valid-compile"`, nieobecny w `WCAG_MAP` (`01-domain-distillation.md:93-100`). Bezpośrednio powiązane z tym research: dotąd nieudokumentowana drobna niekonsekwencja wersji `@angular-eslint` między `setup.sh` (`^18.0.0`) a własnym `package.json` (`^19.8.1`) — cytowana w L3 (`research.md:38,55`) i w L4 jako item #1 (patrz sekcja 4).

## 4. Plan refaktoryzacji (z L4)

**Co refaktoryzowane:** L4 zawiera cztery nazwane kandydaty (nie jedną "wybraną opcję" w formacie invariant/ACL — to jest osobny, ogólny plan refaktoru repo, odrębny od L5's agregatowego/ACL projektu). Priorytet #1: **drift wersji `@angular-eslint` między `package.json` (`^19.8.1`), `setup.sh` (`^18.0.0`) i komentarzami w `angular.cjs`** — realny, dziś-żywy bug dla nowych adopterów Angulara, niewidoczny w CI, bo CI nigdy nie uruchamia `setup.sh` przeciw świeżej instalacji npm (`refactoring-plan.md:5-13`). Docelowy kształt: zsynchronizować trzy miejsca, docelowo wydzielić jedno źródło prawdy dla numerów wersji (opcjonalnie, odłożone).

**Czego świadomie NIE robimy:** (a) nie tworzymy wspólnej bazy dla czterech `toolkit/config/eslint/*.cjs` — sprawdzone i explicite odrzucone: współdzielą wzorzec, nie treść, wspólna baza dodałaby indirection bez realnej redukcji duplikacji (`refactoring-plan.md:36-45`); (b) nie budujemy `FRAMEWORK_REGISTRY` teraz dla czwartego itemu (duplikacja four-way switch dla frameworków) — odłożone do momentu, gdy piąty framework będzie realnie planowany (`refactoring-plan.md:53`).

**Fazy planu (jedna linijka + weryfikacja):**
1. Bump wersji Angular w `setup.sh` + dodanie `@angular-eslint/template-parser` jako explicit install target + poprawka trzech komentarzy w `angular.cjs` — weryfikacja: ręczna (brak automatycznego testu dziś na to explicite wskazanego).
2. Dodanie cheap CI/test-checku diffującego trzy root-level stub files (`CLAUDE.md`/`AGENTS.md`/`.cursorrules`) vs. `toolkit/wrappers/` — weryfikacja: automatyczna (proponowany CI step).
3. (Odrzucone, nie fazowane) — cztery ESLint-configi pozostają bez zmian.
4. (Odłożone, nie fazowane) — `FRAMEWORK_REGISTRY` dla four-way switch, tylko gdy piąty framework się pojawi.

## 5. Domena wg DDD (z L5)

**Ubiquitous language — kluczowe pojęcia:**
- **Framework** — jedyny współdzielony typ domenowy między warstwami (`bounded-contexts.md:39`, cytowane w `01-domain-distillation.md:23`).
- **WCAG_MAP / RULE_TO_WCAG** — dwie niezależne mapy reguła→kryterium WCAG, jedna per warstwa (statyczna/dynamiczna) — legitimate separation, nie duplikacja do naprawienia (`01-domain-distillation.md:73`).
- **FrameworkProfile / FrameworkProfileRegistry** (projektowany w L5, nie istniejący w kodzie) — agregat wiążący rozszerzenia plików + plik ESLint-config + WCAG-submapę jako jedną, walidowaną-atomowo trójkę.
- **A11yFinding** (projektowany w L5, nie istniejący w kodzie) — domenowy model wyniku audytu, zamiast dzisiejszych `AxeViolation`/`AxeResults`.

**Najważniejszy rozjazd model-vs-kod:** dokument (`prd.md:63`) opisuje framework resolution jako **jedną** decyzję determinującą trzy powiązane wybory; kod realizuje to jako **trzy textually niezależne struktury** (`getExtensionsForFramework()`, `frameworkToFile`/`getEslintConfigPath()`, płaska nieindeksowana-po-frameworku `WCAG_MAP`) bez żadnego typu wiążącego je razem (`01-domain-distillation.md:69`). Najdotkliwszy, empirycznie zweryfikowany symptom: **cały framework Svelte** raportuje naruszenia WCAG przez cichy fallback `WCAG_MAP[msg.ruleId] ?? "WCAG"` (`src/pre-commit.ts:286`) — zero prawdziwych cytatów WCAG dla Svelte, nieudokumentowane w żadnym z siedmiu wcześniej istniejących dokumentów, potwierdzone live-run ESLint-a (sekcja 3 powyżej).

**Niezmiennik #1 i agregat:** **Niezmiennik A — spójność framework resolution** ("wybrany Framework MUSI determinować identyczny, zgodny ze sobą zestaw: config-plik, filtr rozszerzeń, WCAG-mapa", `prd.md:63`), z niezmiennikiem B (kompletność cytatu WCAG) jako jego najdotkliwszym symptomem. Należy do projektowanego agregatu **`FrameworkProfile`** (+ `FrameworkProfileRegistry`, ładujący wszystkie cztery profile atomowo — jeśli jeden jest niekompletny, całość rzuca, żaden częściowy sukces) — `02-invariant-aggregate-refactor.md:39-41,83`.

**Anti-Corruption Layer — która zależność przecieka:** Wybrana jako gorszy przeciek (nie ESLint, mimo że ESLint dotyka więcej plików liczbowo): **axe-core + Playwright w `src/audit.ts`**. Powód wyboru: typy `AxeViolation`/`AxeResults` **udają** izolację domenową (wyglądają jak internal DTO), ale są w rzeczywistości wypełniane rzutowaniem typu (`as AxeViolation[]`, `src/audit.ts:175`), nie mapowaniem pole-po-polu — więc wymiana axe-core na inny scanner dotknęłaby **cały plik `src/audit.ts`** (typy, `RULE_TO_WCAG`, `main()`, `formatResults()`) — dosłownie zero miejsc odizolowanych dziś (`03-anti-corruption-layer.md:63,173`). To przecieka przez **1 plik źródłowy, ale przez wszystkie jego odpowiedzialności na raz** (typy, mapowanie domenowe, browser-automation, prezentacja) — potwierdzone grepem `grep -rln "axe-core\|playwright" src/ toolkit/`, który dziś zwraca `src/audit.ts`, `toolkit/audit-results.json`, `toolkit/context.md`, `toolkit/scripts/audit.cjs` (`03-anti-corruption-layer.md:188-195`).

## 6. Decyzje, które należą do mnie

Ten raport i trzy dokumenty domenowe (L5) zostały wygenerowane przez AI w tej sesji na żądanie Zenobii Gawlikowskiej. Poniżej rozdzielenie: co jest jej wyraźną decyzją, a co jest osądem architektonicznym AI wykonanym w ramach tej decyzji.

**Decyzje podjęte explicite przez Zenobię:** zastosowanie technik DDD (destylacja domeny, projekt agregatu-strażnika, Anti-Corruption Layer) bezpośrednio na tym repo, bez uprzedniego wyszukiwania dokładnych promptów z lekcji kursu; pokrycie **obu** powiązanych repozytoriów w ramach tej sesji certyfikacyjnej (a11y-sdk oraz drugie repo pracy, poza zakresem tego raportu); decyzja o **zachowaniu** wcześniejszych, bardziej ogólnych notatek domenowych (`ubiquitous-language.md`, `bounded-contexts.md`) obok nowych trzech plików L5, zamiast ich nadpisania lub usunięcia; oraz decyzja o wypchnięciu (push) i scaleniu (merge) całej pracy do `main`.

**Osądy architektoniczne wykonane przez AI w ramach tego zakresu:** wybór, **który** niezmiennik (A, spójność framework-resolution) i **który** kandydat ACL (axe-core/Playwright, nie ESLint) był wart wyróżnienia jako priorytet #1 — to były decyzje AI, uzasadnione w dokumentach L5 na podstawie kryteriów (rdzeniowość, siła egzekwowania, stopień, w jakim izolacja jest udawana vs. rzeczywista), ale nie były z góry zadane przez użytkowniczkę. W szczególności, wybór axe-core/Playwright ponad ESLint jako "gorszy przeciek" jest osądem wymagającym interpretacji (mniej plików, ale głębszy fałszywy-comfort problem) — inny analityk mógłby rozsądnie wybrać ESLint z powodu jego szerszego rozsmarowania po plikach.

**Uwaga (widoczna, do zachowania):** *Draft only — the lesson expects you to read this like a reviewer and rewrite this section in your own words before submitting; it should describe decisions you actually made, not summarize what was generated for you.*
