---
title: Anti-Corruption Layer Plan — a11y-sdk
created: 2026-07-09
type: refactor-plan
---

# Anti-Corruption Layer — a11y-sdk

## KROK 0 — Kontekst

Dokumenty przeczytane: `context/foundation/prd.md`, `context/architecture/repo-map.md`, `context/architecture/refactoring-plan.md`, `context/domain/ubiquitous-language.md`, `context/domain/bounded-contexts.md`, `context/foundation/architecture-report.md`, `context/changes/npm-release-strategy/research.md`, plus artefakty #1 i #2 z tej samej sesji.

**Deklaracje o wymienialności/separacji znalezione w dokumentach:** `prd.md:56` (NFR "No devDependency bleed into consumer projects") stwierdza wprost, że `setup.sh` instaluje pluginy ESLint jako `devDependency` PROJEKTU KONSUMENTA, a "toolkit's own runtime code... ships as plain files, not as an installed package" — to jest deklaracja separacji między "narzędzie a11y-sdk" i "biblioteka zewnętrzna, którą konsument instaluje". `bounded-contexts.md:23` stwierdza, że warstwa audytu (Context 3) "never asks what framework rendered the page" — czyli axe-core/Playwright są traktowane jako niezależne od frameworka, sugerując intencję izolacji. Żaden z przeczytanych dokumentów nie deklaruje explicite "ESLint musi być wymienialny" czy "axe-core musi być wymienialny" jako architektoniczny cel — obie zależności są traktowane jako trwałe wybory technologiczne, nie jako gniazda do wymiany. To jest istotne dla KROK 2: żaden z dwóch kandydatów nie ma jawnego rozjazdu intencja-vs-kod w postaci "dokument mówi X ma być wymienialne, kod na to nie pozwala" — analiza poniżej jest więc czysto techniczna (sygnały strukturalne), nie oparta na złamanej obietnicy dokumentu.

**Stack i zależności zewnętrzne** (`package.json:29-45`): `eslint@^9.39.4`, `eslint-plugin-jsx-a11y@^6.9.0`, `eslint-plugin-svelte@^3.0.0`, `eslint-plugin-vuejs-accessibility@^2.5.0`, `@angular-eslint/eslint-plugin-template@^19.8.1`, `@angular-eslint/template-parser@^19.8.1`, `@axe-core/playwright@^4.9.0`, `playwright@^1.44.0`. Warstwy kodu: `src/*.ts` (logika), `toolkit/config/eslint/*.cjs` (deklaratywne konfiguracje pluginów), `toolkit/scripts/*.cjs` (build output).

## KROK 1 — Identyfikacja przeciekających zależności

**Kandydat 1: ESLint (+ per-framework plugin: `eslint-plugin-jsx-a11y`, `eslint-plugin-vuejs-accessibility`, `eslint-plugin-svelte`, `@angular-eslint/eslint-plugin-template`).**

Sygnał: ten sam pakiet (`eslint`) importowany w wielu miejscach; typy biblioteki (`ESLint.LintResult`, `ESLint.LintMessage`) używane bezpośrednio w sygnaturach wewnętrznych bez żadnego internal DTO.

Pliki, które dziś "znają" ESLint (zweryfikowane grepem w tej sesji, `grep -rn "eslint" src/ toolkit/`):
- `src/pre-commit.ts:230` — `let ESLint: typeof import("eslint").ESLint;`
- `src/pre-commit.ts:234` — `require("eslint")` (dynamiczny import biblioteki)
- `src/pre-commit.ts:244` — `let eslint: import("eslint").ESLint;`
- `src/pre-commit.ts:246-249` — `new ESLint({ overrideConfigFile: configFile, overrideConfig: [] })`
- `src/pre-commit.ts:257` — `let results: import("eslint").ESLint.LintResult[];` — **typ biblioteki użyty jako typ wewnętrznej zmiennej, bez żadnego mapowania na typ projektu**
- `src/pre-commit.ts:259` — `results = await eslint.lintFiles(relevantFiles);`
- `src/pre-commit.ts:276-289` — pola `result.filePath`, `msg.ruleId`, `msg.line`, `msg.message` czytane INLINE, wprost z surowego `LintResult`/`LintMessage`, bez żadnego internal DTO pomiędzy
- `toolkit/config/eslint/react.cjs:5` — `require('eslint-plugin-jsx-a11y')`
- `toolkit/config/eslint/vue.cjs:5` — `require('eslint-plugin-vuejs-accessibility')`
- `toolkit/config/eslint/svelte.cjs:11` — `require('eslint-plugin-svelte')`
- `toolkit/config/eslint/angular.cjs:6-7` — `require('@angular-eslint/eslint-plugin-template')`, `require('@angular-eslint/template-parser')`
- `toolkit/scripts/pre-commit.cjs:323,331,333,346` — zbudowany output, powtarza identyczny wzorzec co `src/pre-commit.ts` (oczekiwane, to jest tsup build target — patrz `repo-map.md:50-57`)

**Sześć plików źródłowych** (nie licząc zbudowanego duplikatu `toolkit/scripts/pre-commit.cjs`, który jest tsup-output, nie odrębnym źródłem wiedzy) znają kształt ESLint-a: `src/pre-commit.ts` + cztery `toolkit/config/eslint/*.cjs`.

**Kandydat 2: axe-core (via `@axe-core/playwright`) + Playwright.**

Sygnał: typy biblioteki reprezentowane przez WEWNĘTRZNE interfejsy (`AxeViolation`, `AxeResults`) zadeklarowane w kodzie projektu — ale wypełniane rzutowaniem typu (`as`), nie mapowaniem pole-po-polu, co oznacza, że "izolacja" jest deklaratywna/kosmetyczna, nie faktyczna w czasie wykonania.

Pliki, które dziś znają axe-core/Playwright (zweryfikowane grepem, `grep -rln "axe-core\|playwright" src/ toolkit/`):
- `src/audit.ts:4` — komentarz `"Types mirroring @axe-core/playwright / axe-core result shapes"` — projekt SAM przyznaje, że to jest "mirror", nie oryginalny model domenowy
- `src/audit.ts:6-18` — deklaracja `AxeNodeResult`, `AxeViolation` (pola `id`, `impact`, `description`, `nodes`, `tags` — 1:1 odwzorowanie pól axe-core, nie przetłumaczone na słownictwo domenowe projektu jak np. `wcagCriterion`)
- `src/audit.ts:106-107` — `require.resolve("playwright")`, `require.resolve("@axe-core/playwright")`
- `src/audit.ts:140-141` — `const { chromium } = await import("playwright"); const { AxeBuilder } = await import("@axe-core/playwright");`
- `src/audit.ts:175` — `rawResults = { violations: axeResults.violations as AxeViolation[] };` — **rzutowanie typu (`as`), nie konstrukcja pole-po-polu** — to jest kluczowy dowód: `AxeViolation` WYGLĄDA jak internal type, ale w praktyce jest tylko etykietą narzuconą na dane axe-core bez żadnej walidacji czy transformacji
- `toolkit/context.md:287-288` — dokumentacja wspominająca komendy instalacyjne (nie kod, ale nazwane pakiety)
- `toolkit/scripts/audit.cjs:132-133,162-163` — zbudowany output, analogicznie do `pre-commit.cjs`

**Cztery pliki** znają axe-core/Playwright: `src/audit.ts` (jedyne realne źródło), plus zbudowany duplikat `toolkit/scripts/audit.cjs`, plus dwa pliki dokumentacyjne/danych (`toolkit/context.md`, `toolkit/audit-results.json` — ten ostatni to WYNIK działania, nie kod, zawiera surowe pola axe-core jak `helpUrl` z domeną `dequeuniversity.com`).

## KROK 2 — Klasyfikacja i wybór #1

| Kandydat | (a) Liczba warstw/plików | (b) Ryzyko/koszt wymiany dziś | (c) Rozjazd intencja-vs-kod |
|---|---|---|---|
| **ESLint + 4 plugin-pakiety** | Wysoka — 6 plików źródłowych (1 core logic + 4 deklaratywne configi + wliczając namespace'y reguł w `WCAG_MAP`, które też kodują wiedzę o strukturze ID reguł konkretnych pluginów, `src/pre-commit.ts:12-83`) | Średni-wysoki — wymiana ESLint na inny linter wymagałaby przepisania WSZYSTKICH czterech `.cjs` configów (każdy zna specyficzny shape pluginu, np. `angular.cjs`'s manualna rekonstrukcja flat-config z eslintrc-shape, `toolkit/config/eslint/angular.cjs:9-17`) ORAZ `src/pre-commit.ts`'s bezpośrednie użycie `ESLint.LintResult` | Brak jawnej deklaracji "ESLint musi być wymienialny" w dokumentach — to jest architektura ustabilizowana wokół ESLint jako trwałego wyboru, nie false promise |
| **axe-core + Playwright** | Niższa liczbowo — 1 plik realnego kodu (`src/audit.ts`), ale ten jeden plik miesza DWIE osobne biblioteki (browser automation + a11y-scanning) w jednej funkcji `main()` | Wysoki — Playwright's `chromium.launch()`/`page.goto()`/`AxeBuilder` są splątane bezpośrednio w logice CLI (`src/audit.ts:140-175`), a `AxeViolation`/`AxeResults` — które WYGLĄDAJĄ jak internal DTO — są w rzeczywistości rzutowane (`as AxeViolation[]`, linia 175) z surowych wyników `axeResults.violations`, więc żadna faktyczna walidacja/izolacja nie istnieje mimo posiadania nazwanych typów | Sam kod przyznaje w komentarzu (`src/audit.ts:4`), że te typy "mirror" bibliotekę zewnętrzną — to nie jest rozjazd dokumentu vs. kodu, to jest rozjazd NAZWY (interfejs sugeruje domenowy model) vs. TREŚCI (rzutowanie, nie mapowanie) w samym kodzie |

**Wybór #1: axe-core/Playwright typy (`AxeViolation`/`AxeResults` w `src/audit.ts`).**

Uzasadnienie: ESLint-owa zależność jest bardziej rozsmarowana liczbowo (6 plików vs. 4), ALE jest to duplikacja *jawna i uczciwa* — `pre-commit.ts` czyta pola `LintResult`/`LintMessage` bez pretensji do posiadania internal type, więc nikt nie jest zmylony co do stopnia izolacji (zero izolacji, i kod na to nie udaje inaczej). axe-core/Playwright jest gorszym przeciekiem właśnie dlatego, że **udaje izolację, której nie ma**: `AxeViolation`/`AxeResults` (`src/audit.ts:6-22`) sygnalizują czytelnikowi kodu "to są nasze typy domenowe", ale linia 175 (`as AxeViolation[]`) ujawnia, że to jest czysto kosmetyczna etykieta na strukturze danych axe-core — bez runtime walidacji, bez transformacji pól, bez odseparowania nazw pól (`impact`, `nodes`, `tags` to dosłownie te same nazwy co w axe-core). To jest bardziej niebezpieczny wzorzec niż jawna duplikacja ESLint-a, bo przyszły refaktor "myślący", że `AxeViolation` jest bezpiecznym punktem izolacji, odkryje boleśnie, że wymiana axe-core na inny scanner (np. Lighthouse, pa11y) wymaga zmiany TEGO SAMEGO pliku i TYCH SAMYCH "internal" typów, bo są one strukturalnie identyczne z biblioteką.

## KROK 3 — Diagnoza

**Duplikacja i przecieki przez granice (axe-core/Playwright):**

- `src/audit.ts:6-18` deklaruje `AxeNodeResult { target: string[]; html: string; failureSummary?: string }` i `AxeViolation { id: string; impact: ...; description: string; nodes: AxeNodeResult[]; tags: string[] }` — pola nazwane identycznie jak axe-core's własny wynik (potwierdzone przez fakt, że `axeResults.violations as AxeViolation[]` w linii 175 kompiluje się bez błędu typu, co oznacza strukturalną zgodność 1:1).
- `formatResults()` (`src/audit.ts:71-99`), funkcja PREZENTACYJNA (formatuje output CLI), operuje DIRECTLY na `AxeViolation`/`AxeNodeResult` — czyta `v.id`, `v.impact`, `v.nodes`, `node.target`, `node.html`, `node.failureSummary` — bez żadnej warstwy pośredniej. Gdyby axe-core zmienił kształt `failureSummary` (np. przestał zwracać string z prefiksem `"Fix (?:any|all) of the following:"`, na który liczy regex w linii 91), błąd pojawiłby się bezpośrednio w kodzie prezentacyjnym, nie w jednym izolowanym adapterze.
- `RULE_TO_WCAG` (`src/audit.ts:26-61`) jest kluczowana po `v.id` — surowym ID reguły axe-core (np. `"image-alt"`, `"color-contrast"`) — czyli mapowanie domenowe (reguła → kryterium WCAG) jest bezpośrednio sprzężone z nazewnictwem biblioteki zewnętrznej. Zmiana ID reguły w przyszłej wersji axe-core złamałaby to mapowanie bez ostrzeżenia kompilatora (to są stringi, nie enum).
- `main()` (`src/audit.ts:103-208`) miesza w jednej funkcji: sprawdzanie dostępności biblioteki (`require.resolve`), uruchamianie przeglądarki (`chromium.launch`, `page.goto`), wołanie scannera (`AxeBuilder(...).withTags(tags).analyze()`), rzutowanie wyniku, zapis do pliku, formatowanie i wypisanie — żadna z tych odpowiedzialności nie jest oddzielona adapterem.

**Groźny przeciek przez granicę klient/serwer:** Nie ma dosłownej granicy klient/serwer w tym repo (CLI tool, nie web-app) — nie stwierdzam więc literalnego "biblioteka serwerowa wciągana do bundla klienta". Analogiczna granica, która tu istnieje: **Layer 2 (pre-commit, statyczny) vs. Layer 3 (audit, dynamiczny)** — te dwie warstwy są opisane jako niezależne (`bounded-contexts.md:37-39`), i faktycznie NIE dzielą kodu do parsowania wyników (`WCAG_MAP` vs `RULE_TO_WCAG` to osobne mapy, zweryfikowane w `01-domain-distillation.md`) — to jest OK, to jest legitymate separation, nie przeciek. Przeciek dotyczy wyłącznie WEWNĄTRZ Layer 3: `src/audit.ts` samo w sobie miesza browser-automation-details z a11y-domain-details bez wewnętrznej granicy.

**Deklaracja wymienialności vs. kod:** Jak ustalono w KROK 0 — żaden dokument nie deklaruje explicite "axe-core musi być wymienialny". Nie ma więc udokumentowanego rozjazdu intencja-dokumentu-vs-kod do zacytowania tutaj; rozjazd, który istnieje, jest wewnątrz-kodowy: NAZWA typu (`AxeViolation` sugeruje "to nasz model") vs. TREŚĆ typu (rzutowanie bez transformacji, linia 175).

## KROK 4 — Projekt ACL

**Domenowa encja/value object: `A11yFinding`** — jedyne miejsce wiedzy o kształcie wyniku axe-core, z prawdziwą (nie kosmetyczną) konwersją.

```typescript
// Pseudokod — NIE kod produkcyjny.

// Domenowy model — słownictwo PROJEKTU, nie biblioteki. Zauważ: nazwy pól
// różne od axe-core (impact→severity, id→ruleId, description→rawDescription)
// żeby przyszła zmiana axe-core's shape nie przecieka automatycznie w nazwach.
type Severity = "critical" | "serious" | "moderate" | "minor" | "unknown";

interface A11yFindingLocation {
  selector: string;
  snippetHtml: string;
}

class A11yFinding {
  private constructor(
    public readonly ruleId: string,
    public readonly severity: Severity,
    public readonly wcagCriterion: string | null,  // null = "brak mapowania", nie "WCAG" string
    public readonly wcagTitle: string | null,
    public readonly rawDescription: string,
    public readonly locations: A11yFindingLocation[],
  ) {}

  // JEDYNE miejsce, gdzie kształt axe-core jest znany. Przyjmuje `unknown`,
  // nie typ biblioteki — wymusza walidację, nie rzutowanie.
  static fromAxeViolation(raw: unknown, wcagLookup: (ruleId: string) => { criterion: string; title: string } | null): A11yFinding {
    const v = validateAxeViolationShape(raw); // rzuca jeśli shape nie pasuje — fail-fast, nie "as"
    const wcag = wcagLookup(v.id);
    return new A11yFinding(
      v.id,
      normalizeSeverity(v.impact),
      wcag?.criterion ?? null,
      wcag?.title ?? null,
      v.description,
      v.nodes.map((n) => ({ selector: n.target.join(", "), snippetHtml: n.html })),
    );
  }
}

function normalizeSeverity(raw: string | null): Severity {
  if (raw === "critical" || raw === "serious" || raw === "moderate" || raw === "minor") return raw;
  return "unknown"; // fail-safe zamiast fallback do "minor" (dzisiejszy kod: IMPACT_ORDER[a.impact ?? "minor"] ?? 3 — cichy fallback)
}
```

**Wąski port + adapter:**

```typescript
// Port — domenowy interfejs, reszta kodu zna TYLKO to.
interface A11yScanner {
  scan(url: string, level: "AA" | "AAA"): Promise<A11yFinding[]>;
}

// Adapter — JEDYNE miejsce, gdzie 'playwright' i '@axe-core/playwright' są importowane.
class PlaywrightAxeScanner implements A11yScanner {
  async scan(url: string, level: "AA" | "AAA"): Promise<A11yFinding[]> {
    const { chromium } = await import("playwright");
    const { AxeBuilder } = await import("@axe-core/playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
      const tags = level === "AAA" ? ["wcag2a", "wcag2aa", "wcag2aaa"] : ["wcag2a", "wcag2aa"];
      const axeResults = await new AxeBuilder({ page }).withTags(tags).analyze();
      return axeResults.violations.map((v) => A11yFinding.fromAxeViolation(v, lookupWcag));
    } finally {
      await browser.close();
    }
  }
}

// Reszta kodu (formatResults, main's CLI flow) zna wyłącznie A11yScanner i A11yFinding —
// zero importów 'playwright'/'@axe-core/playwright' poza tym jednym plikiem adaptera.
```

**Analogicznie dla ESLint** (drugorzędny, ale wspomniany dla kompletności — nie wybrany jako #1, patrz KROK 2): port `A11yLinter { lint(files: string[]): Promise<A11yFinding[]> }`, adapter `EslintA11yLinter` jedyny znający `ESLint.LintResult`/`LintMessage`, konwertujący do tego samego `A11yFinding` co scanner — co dałoby DODATKOWĄ korzyść: Layer 2 i Layer 3 mogłyby dzielić jeden format wyniku (`A11yFinding`) mimo posiadania osobnych map WCAG (`WCAG_MAP`/`RULE_TO_WCAG` pozostają osobne, bo inspektują różne rzeczy — to jest legitymate, patrz `bounded-contexts.md:25` i `01-domain-distillation.md` KROK 4).

## KROK 5 — Dowód izolacji + before/after

**Dowód, że wymiana biblioteki dotyka tylko adaptera:**

Po refaktorze, wymiana axe-core na inny scanner (np. pa11y) wymagałaby zmiany WYŁĄCZNIE:
1. `PlaywrightAxeScanner` → nowa klasa implementująca `A11yScanner`, np. `Pa11yScanner`
2. Nic więcej — `A11yFinding`, `formatResults`-równoważnik, zapis do `.a11y/audit-results.json`, CLI `main()`'s flow pozostają niezmienione, bo operują na `A11yFinding`/`A11yScanner`, nie na typach axe-core.

Dziś (before refaktoru) wymiana axe-core wymaga zmiany:
- `src/audit.ts:6-22` (typy `AxeViolation`/`AxeResults` — trzeba je przeprojektować dla nowej biblioteki, bo są 1:1 z axe-core)
- `src/audit.ts:26-61` (`RULE_TO_WCAG` kluczowana axe-core-specific ID reguł — pa11y ma inne ID)
- `src/audit.ts:140-175` (cały flow `main()` — importy, wywołania API, rzutowanie)
- `src/audit.ts:71-99` (`formatResults` — czyta pola axe-core-shaped bezpośrednio)

**To jest cały plik** — dziś nie ma ANI JEDNEGO miejsca odizolowanego od axe-core w Layer 3. Po refaktorze, tylko `PlaywrightAxeScanner` (nowy, wydzielony plik/klasa) wymaga zmiany.

**Before/after zduplikowanych miejsc:**

| Miejsce | Before | After |
|---|---|---|
| Typy wyniku | `AxeViolation`/`AxeResults` — 1:1 mirror axe-core, wypełniane rzutowaniem (`src/audit.ts:175`) | `A11yFinding` — domenowy model, budowany przez walidację (`fromAxeViolation`), nie rzutowanie |
| Formatowanie | `formatResults()` czyta `v.id`, `v.impact`, `node.target`, `node.html` — surowe pola axe-core (`src/audit.ts:82-93`) | Formatter czyta `finding.ruleId`, `finding.severity`, `finding.locations[i].selector/snippetHtml` — domenowe nazwy, stabilne wobec zmian axe-core |
| Import biblioteki | `chromium`/`AxeBuilder` importowane w tej samej funkcji `main()` co CLI-argument-parsing i output-formatting (`src/audit.ts:140-141`) | Importy istnieją WYŁĄCZNIE w `PlaywrightAxeScanner.scan()` |
| Warstwa UI/prezentacji dostaje | Surowy `AxeResults` (biblioteka-shaped) przekazywany wprost do `formatResults()` | Gotowe `A11yFinding[]` (domena-shaped) — "warstwa UI" (tu: CLI stdout) nigdy nie widzi surowego obiektu biblioteki |

**Otwarte pytania zależne od kontraktu biblioteki:** Jedno realne pytanie znalezione w kodzie: `v.impact` może być `null` (typ `"critical" | "serious" | "moderate" | "minor" | null`, `src/audit.ts:14`) — dzisiejszy kod (`IMPACT_ORDER[a.impact ?? "minor"] ?? 3`, linia 76) rozstrzyga to CICHO jako "traktuj null jak minor". Wg dokumentacji axe-core (nie czytanej w tej sesji jako osobny dokument, ale ten fakt jest widoczny wprost w typie zadeklarowanym w kodzie), `impact: null` oznacza "reguła nie ma przypisanego wpływu" — to NIE jest równoważne "minor". Decyzję "co robić z `impact === null`" należy zakodować w ACL (`normalizeSeverity` powyżej, zwracająca `"unknown"` osobno od `"minor"`), nie w warstwie formatowania — co ten projekt ACL już robi (patrz pseudokod KROK 4).

## KROK 6 — Weryfikacja i plan

**Kryterium sukcesu — grep po nazwie pakietu.** Uruchomiono w tej sesji: `grep -rln "axe-core\|playwright" src/ toolkit/` (z wykluczeniem `node_modules/`). Rzeczywisty output:

```
src/audit.ts
toolkit/audit-results.json
toolkit/context.md
toolkit/scripts/audit.cjs
```

**Interpretacja tego wyniku wobec kryterium sukcesu z promptu ("grep zwraca wyłącznie pliki w katalogu ACL/adaptera"):** Po refaktorze proponowanym w KROK 4/5, oczekiwany wynik tego samego grepa byłby:

- `src/audit.ts` — **wciąż by trafił**, bo `A11yFinding`, `formatResults`-równoważnik i CLI `main()` zostają w tym samym pliku co `PlaywrightAxeScanner` w tym projekcie (nie ma wydzielonego katalogu `adapters/` w dzisiejszej strukturze `src/`) — TU jest miejsce, gdzie plan poniżej proponuje fizyczne wydzielenie, żeby kryterium sukcesu było spełnione dosłownie, nie tylko w duchu.
- `toolkit/scripts/audit.cjs` — build output, zawsze będzie zawierał wszystko (to jest skompilowany bundle, nie moduł) — **nie da się** tego pliku wykluczyć z grepa przy zachowaniu dzisiejszego modelu dystrybucji (`cp -r toolkit/`, jeden plik `.cjs` per entry point, `repo-map.md:26-29`). To jest świadomy koszt architektury build-output-jako-single-file, nie porażka ACL.
- `toolkit/context.md` — dokumentacja, nie kod — grep nieuchronnie ją znajdzie, ale to nie jest "przeciek" w sensie tego zadania (nikt nie importuje kodu z pliku markdown).
- `toolkit/audit-results.json` — dane wynikowe, zapisane PO analizie — będą zawierać `helpUrl` z domeną `dequeuniversity.com/rules/axe/...` niezależnie od refaktoru, bo to jest zawartość odpowiedzi axe-core zapisana do pliku, nie kod aplikacji. To jest przez projekt (`FR-004`, `prd.md:48`: "writes raw results to `.a11y/audit-results.json`") — surowe wyniki są zapisywane w całości, świadomie, nie tylko domenowy `A11yFinding`.

**Które pliki dziś znają zależność, a które po refaktorze przestaną:**

| Plik | Dziś | Po refaktorze (proponowanym) |
|---|---|---|
| `src/audit.ts` (cała logika `main()`, `formatResults`, typy) | Znają w pełni | Podzielony: nowy plik `src/audit-scanner.ts` (adapter `PlaywrightAxeScanner`) ZNA bibliotekę; `src/audit.ts` (CLI entry point + `A11yFinding`-based formatting) PRZESTAJE znać |
| `toolkit/config/eslint/*.cjs` | Znają ESLint-plugin (osobny kandydat, nie refaktorowany w tym planie) | Bez zmian — poza scope tego dokumentu (patrz KROK 2, ESLint nie wybrany jako #1) |
| `toolkit/scripts/audit.cjs` | Build output, znają w pełni | Wciąż będzie znać (build output pojedynczego pliku) — udokumentowane wyżej jako świadomy koszt |

**Plan faz zgodny z konwencją projektu** (test-first tam, gdzie `vitest` już testuje `audit-formatter` — `tests/audit-formatter.test.ts` istnieje wg `prd.md:98`):

1. **Faza 1 (test-first).** Napisać testy dla `A11yFinding.fromAxeViolation()` obejmujące: legalną konwersję pełnego violation, `impact: null` → `severity: "unknown"` (nie `"minor"`), nieznane `ruleId` w `RULE_TO_WCAG`/`wcagLookup` → `wcagCriterion: null` (nie string `"WCAG"` czy podobny fallback).
2. **Faza 2.** Wydzielić `src/audit-scanner.ts` z `PlaywrightAxeScanner` — przenieść importy `playwright`/`@axe-core/playwright` tam.
3. **Faza 3.** Przepisać `formatResults()` i `main()` w `src/audit.ts` na operowanie wyłącznie na `A11yFinding[]`.
4. **Faza 4 (test-first dla regresji).** Rozszerzyć `tests/audit-formatter.test.ts` o przypadek `impact: null` i przypadek nieznanego `ruleId`, zweryfikować że dotychczasowe testy (impact-ordering, WCAG-map fallback) pozostają zielone z nowym, jawnym `null`-handling zamiast cichego fallbacku.
5. **Faza 5.** Ponownie uruchomić `grep -rln "axe-core\|playwright" src/ toolkit/` i potwierdzić, że tylko `src/audit-scanner.ts` (nowy) + `toolkit/scripts/audit.cjs` (build output, oczekiwane) + pliki dokumentacji/danych pozostają na liście — `src/audit.ts` sam nie powinien już się pojawiać.

---

## Podsumowanie

Ten dokument identyfikuje dwóch kandydatów na przeciekającą zależność zewnętrzną — ESLint (+ 4 pluginy per-framework) i axe-core/Playwright — i po ocenie trzech osi (liczba plików, koszt wymiany, rozjazd intencja-vs-kod) wybiera **axe-core/Playwright w `src/audit.ts`** jako gorszy przeciek, nie ze względu na liczbę dotkniętych plików (mniejszą niż ESLint), ale dlatego że `AxeViolation`/`AxeResults` (`src/audit.ts:6-22`) UDAJĄ izolację domenową, którą w rzeczywistości nie zapewniają — wypełniane są rzutowaniem typu (`as AxeViolation[]`, linia 175), nie mapowaniem pole-po-polu, więc każda funkcja operująca na tych "internal" typach w praktyce operuje bezpośrednio na strukturze axe-core. Projekt ACL proponuje domenowy `A11yFinding` (budowany przez walidację, nie rzutowanie, z jawnym `severity: "unknown"` dla `impact: null` zamiast cichego fallbacku do `"minor"`) i wąski port `A11yScanner` z jedynym adapterem `PlaywrightAxeScanner`. Kryterium sukcesu z promptu (grep zwraca wyłącznie plik adaptera) zostało faktycznie uruchomione w tej sesji — dzisiejszy wynik to `src/audit.ts`, `toolkit/audit-results.json`, `toolkit/context.md`, `toolkit/scripts/audit.cjs` — i udokumentowano jawnie, że dwa z tych czterech (build output `.cjs` i wynikowy `.json`) NIE da się usunąć z tej listy przy zachowaniu dzisiejszego modelu dystrybucji, co jest nazwane jako świadomy, uzasadniony koszt architektury, nie porażka planu.
