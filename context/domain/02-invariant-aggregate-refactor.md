---
title: Invariant & Aggregate Refactor Plan — a11y-sdk
created: 2026-07-09
type: refactor-plan
---

# Niezmienniki i projekt agregatu-strażnika — a11y-sdk

**Uwaga wstępna o kształcie tego repo wobec promptu.** Ten prompt zakłada domyślnie architekturę web-app z podziałem klient/serwer ("Cienkie API/route", "egzekucja przenosi się z klienta na serwer"). a11y-sdk jest CLI-toolem: `src/pre-commit.ts` (uruchamiany przez git hook, `toolkit/hooks/pre-commit`) i `src/audit.ts` (uruchamiany z linii komend) SĄ najbliższym odpowiednikiem "entry points"/"API" — nie ma przeglądarki-klienta wobec serwera. Poniżej w KROK 4 nazywam to wprost i nie wymuszam fałszywej narracji klient/serwer tam, gdzie nie ma sensu.

## KROK 0 — Kontekst

Dokumenty przeczytane: `context/foundation/prd.md`, `context/architecture/repo-map.md`, `context/architecture/refactoring-plan.md`, `context/domain/ubiquitous-language.md`, `context/domain/bounded-contexts.md`, `context/foundation/architecture-report.md`, `context/changes/npm-release-strategy/research.md`, plus `context/domain/01-domain-distillation.md` (artefakt #1 z tej samej sesji, do wykorzystania jako wejście, nie do powtórzenia w całości).

Sekcje "business logic"/"success criteria"/FR z PRD: `prd.md:18-24` (Success Criteria), `prd.md:26-41` (User Stories, Given/When/Then), `prd.md:43-50` (Functional Requirements), `prd.md:59-63` (Business Logic).

Stack i warstwy: TypeScript, `src/*.ts` → build → `toolkit/scripts/*.cjs`. Logika biznesowa żyje w `src/pre-commit.ts` (Layer 2 entry point) i `src/audit.ts` (Layer 3 entry point), wspierana przez `src/detect-framework.ts`, `src/config-loader.ts`, `src/rule-filter.ts`. Nie ma warstwy "UI" w sensie graficznym; "klient" najbliżej odpowiada developerowi wpisującemu `git commit` lub `node .a11y/scripts/audit.cjs <url>` z terminala.

## KROK 1 — Identyfikacja niezmienników biznesowych

| # | Niezmiennik | Sformułowanie "MUSI" | Cytat źródłowy |
|---|---|---|---|
| A | Framework resolution jest jedną, spójną decyzją | "Dla danego przebiegu pre-commit, wybrany Framework MUSI determinować identyczny, zgodny ze sobą zestaw: (a) plik ESLint config, (b) filtr rozszerzeń plików, (c) mapę WCAG." | `prd.md:63` — *"Once a framework is resolved, it selects: (a) the ESLint flat-config file..., (b) the file-extension filter..., and (c) which of the two rule-ID-to-WCAG-criterion maps..."* |
| B | Naruszenie a11y MUSI nosić realny cytat WCAG | "Każde zgłoszone naruszenie a11y MUSI zawierać rzeczywisty numer kryterium WCAG, jeśli reguła jest w ogóle znana projektowi jako a11y-relevant — nie gołe fallbackowe słowo." | `prd.md:21` (Success Criterion #2), US-2 Then (`prd.md:36`) |
| C | Commit z naruszeniem MUSI być zablokowany | "Operacja `git commit` z co najmniej jednym naruszeniem a11y w plikach stagowanych MUSI zakończyć się exit ≠ 0, poza jawnym `--no-verify`." | `prd.md:36` |
| D | Toggle kategorii konfiguracji MUSI wyłączać odpowiadające reguły | "Ustawienie `rules.<category> = false` MUSI wyłączyć wszystkie reguły ESLint przypisane do tej kategorii we WSZYSTKICH wspieranych frameworkach." | `prd.md:46` (FR-002), `context/domain/ubiquitous-language.md:44` |
| E | Brak Playwright MUSI dać miękką degradację (exit 3), nie crash | "Jeśli Playwright/@axe-core/playwright nie są zainstalowane, audit MUSI zwrócić dedykowany exit code 3 z instrukcją instalacji, nie nieobsłużony wyjątek." | `prd.md:55` (NFR), zweryfikowane `src/audit.ts:104-118` |

## KROK 2 — Klasyfikacja i wybór #1

| Niezmiennik | (a) Jak rdzeniowy | (b) Rozsmarowanie po warstwach | (c) Egzekwowany / deklarowany / naruszalny |
|---|---|---|---|
| A — Framework resolution spójność | Wysoki — to jest "the single rule the rest of the system is built around" (`prd.md:61`) | Wysokie — trzy textually niezależne struktury w jednym pliku: `getExtensionsForFramework()` (`src/pre-commit.ts:101-114`), `frameworkToFile`/`getEslintConfigPath()` (`src/pre-commit.ts:121-131`), `WCAG_MAP` (`src/pre-commit.ts:12-83`, płaska, nieindeksowana po frameworku) | **Naruszalny bez błędu**: nic nie weryfikuje w compile-time ani runtime, że te trzy pozostają zgodne; `getEslintConfigPath()` ma nawet fallback `?? "react.cjs"` (linia 128), który przy błędzie w `frameworkToFile` cicho zastosuje ZŁY config, bez ostrzeżenia |
| B — WCAG-cytat kompletność | Wysoki — bezpośrednio Success Criterion #2 | Średnie — jedna mapa (`WCAG_MAP`), ale jej niekompletność dotyczy całego frameworka (Svelte) na raz | **Naruszalny, cicho**: `src/pre-commit.ts:286` — `wcag: WCAG_MAP[msg.ruleId] ?? "WCAG"` — fallback nie jest błędem, jest cichą degradacją jakości danych. Zweryfikowane empirycznie (live ESLint run w tej sesji): wszystkie naruszenia Svelte raportują `ruleId === "svelte/valid-compile"`, nieobecny w `WCAG_MAP` |
| C — Blokowanie commitu | Wysoki | Niskie — jeden plik, jedna decyzja (`process.exit`) | **Silnie egzekwowany**: `src/pre-commit.ts:291-293` i `:310` — to działa poprawnie i jest odizolowane od niezmiennika B (fallback `"WCAG"` wciąż liczy się jako naruszenie i wciąż blokuje) |
| D — Config toggle kompletność | Średni (supporting, nie core wg `01-domain-distillation.md` KROK 2) | Wysokie — `CATEGORY_RULE_PREFIXES` (`src/rule-filter.ts:17-41`) musi znać prefiksy KAŻDEGO frameworka, ale jest wypełniona wyłącznie prefiksami `jsx-a11y`/`vuejs-accessibility`/`@angular-eslint` | **Częściowo ignorowany, po części z premedytacją (color-contrast/live-regions, jawnie dokumentowane w `prd.md:85`), po części cicho (cały Svelte, NIEudokumentowane)** |
| E — Audit degradacja | Średni | Niskie — jeden plik, jeden try/catch | **Silnie egzekwowany**: zweryfikowane, kod robi to, co deklaruje |

**Wybór #1: niezmiennik A (spójność framework resolution), z niezmiennikiem B jako jego najbardziej widocznym, empirycznie zweryfikowanym symptomem.**

Uzasadnienie: A jest jednocześnie najbardziej rdzeniowy (cały system jest o tym, żeby framework-detekcja poprawnie routing'owała do właściwego pluginu i mapy) I najsłabiej egzekwowany — nie istnieje żaden agregat, żadna struktura danych, żaden typ, który wymuszałby, że "config-file dla frameworka X" i "WCAG-mapa dla frameworka X" faktycznie się zgadzają. C jest silny (dobrze egzekwowany) — nie wybieram go. D jest supporting, nie core — niższa wartość niż A/B. E jest dobrze egzekwowany. B jest realnym, dotkliwym symptomem, ale bez A (bez jednego miejsca egzekwującego spójność trójki: rozszerzenia/config-plik/WCAG-mapa) każda naprawa B (np. dodanie kluczy `svelte/*` do WCAG_MAP) byłaby punktową łataną, nie strukturalną naprawą — stąd A jako właściwy poziom agregatu, z B jako testem/dowodem że agregat działa.

## KROK 3 — Diagnoza wybranego niezmiennika (A, z symptomem B)

**Gdzie dziś żyje reguła — wszystkie trzy niezależne struktury:**

1. `getExtensionsForFramework()` — `src/pre-commit.ts:101-114`:
```typescript
function getExtensionsForFramework(fw: Framework): string[] {
  switch (fw) {
    case "react": return [".jsx", ".tsx"];
    case "vue": return [".vue"];
    case "svelte": return [".svelte"];
    case "angular": return [".html", ".ts"];
    default: return [];
  }
}
```

2. `getEslintConfigPath()` z `frameworkToFile` — `src/pre-commit.ts:121-131`:
```typescript
function getEslintConfigPath(framework: Framework, scriptDir: string): string {
  const frameworkToFile: Record<string, string> = {
    react: "react.cjs", vue: "vue.cjs", svelte: "svelte.cjs", angular: "angular.cjs",
  };
  const file = frameworkToFile[framework] ?? "react.cjs";
  return resolve(scriptDir, "..", "config", "eslint", file);
}
```

3. `WCAG_MAP` — `src/pre-commit.ts:12-83`, jedna płaska tablica dla wszystkich frameworków, KLUCZOWO **nieindeksowana po Framework wcale** — to nie jest `Record<Framework, Record<string,string>>`, to jedna wspólna `Record<string,string>` z kluczami zaczynającymi się od różnych plugin-namespace'ów.

**Które warstwy nie egzekwują spójności:** Żadna. Nie istnieje warstwa, funkcja, typ czy test, który sprawdza "dla frameworka X, czy `getExtensionsForFramework(X)`, `getEslintConfigPath(X)` i podzbiór `WCAG_MAP` odpowiadający regułom pluginu frameworka X, są ze sobą zgodne". `refactoring-plan.md` pkt 4 (`context/architecture/refactoring-plan.md:47-55`) już nazywa problem duplikacji switchy dla (a) i (b) plus `setup.sh`'s case statement, ale **nie wskazuje WCAG_MAP jako czwartego elementu tej samej niekonsekwencji w tym samym stopniu** — traktuje ją jako "softer instance" (`refactoring-plan.md:49`: *"A fourth, softer instance is the `WCAG_MAP`..."*), co ta diagnoza koryguje: empirycznie (patrz `01-domain-distillation.md`, sekcja weryfikacji), to nie jest "softer" — to jest kompletny brak pokrycia dla całego frameworka Svelte, nie brzegowy przypadek.

**Gdzie klient jest jedynym strażnikiem:** Nie ma klienta w sensie web-UI. Najbliższy odpowiednik — developer sam musi wiedzieć (z dokumentacji, nie z kodu), że Svelte ma gorsze pokrycie WCAG-cytowania niż React/Vue/Angular. Nic w CLI-output to nie sygnalizuje: `src/pre-commit.ts:296-304` wypisuje `WCAG: WCAG` (fallback) identycznie jak wypisałoby prawdziwy cytat — nie ma żadnego odróżnienia "to jest realny cytat" vs. "to jest fallback".

**Gdzie błąd jest "połykany" zamiast zatrzymywać operację:** Dwa miejsca:
- `src/pre-commit.ts:286`: `WCAG_MAP[msg.ruleId] ?? "WCAG"` — brak wpisu w mapie nie jest błędem, jest cichym fallbackiem. Naruszenie WCIĄŻ blokuje commit (niezmiennik C działa), ale bez wartościowej informacji.
- `src/pre-commit.ts:128`: `frameworkToFile[framework] ?? "react.cjs"` — jeśli `framework` byłby spoza czterech znanych wartości (np. przy przyszłym rozszerzeniu enum `Framework` bez odpowiadającego wpisu w tym obiekcie), kod cicho zastosuje config REACT, nie zgłosi błędu. To nie jest dotknięte dziś (bo `Framework` ma dokładnie te cztery + `unknown`), ale jest strukturalnie tym samym wzorcem "fallback zamiast fail-fast" jak w B.

## KROK 4 — Projekt agregatu-strażnika

**Agregat: `FrameworkProfile`** — jedyne miejsce, gdzie framework → (rozszerzenia, plik-config, WCAG-submapa) są związane razem i walidowane jako spójna trójka przy tworzeniu.

```typescript
// Pseudokod — NIE kod produkcyjny, tylko projekt.

type Framework = "react" | "vue" | "svelte" | "angular";

interface FrameworkProfileData {
  framework: Framework;
  fileExtensions: string[];       // np. [".jsx", ".tsx"]
  eslintConfigFile: string;       // np. "react.cjs"
  wcagRuleMap: Record<string, string>; // TYLKO reguły tego frameworka
}

class FrameworkProfileError extends Error {
  constructor(public readonly framework: string, public readonly reason: string) {
    super(`FrameworkProfile invalid for "${framework}": ${reason}`);
  }
}

class FrameworkProfile {
  private constructor(private readonly data: FrameworkProfileData) {}

  // Jedyny sposób konstrukcji — walidacja przy tworzeniu, nie przy użyciu.
  static create(data: FrameworkProfileData): FrameworkProfile {
    if (data.fileExtensions.length === 0) {
      throw new FrameworkProfileError(data.framework, "no file extensions declared");
    }
    if (!data.eslintConfigFile.endsWith(".cjs")) {
      throw new FrameworkProfileError(data.framework, "config file must be .cjs");
    }
    if (Object.keys(data.wcagRuleMap).length === 0) {
      // Precondition: agregat odmawia istnienia bez JAKIEGOKOLWIEK pokrycia WCAG.
      // To jest punkt, w którym Svelte dziś by ZAWIÓDŁ — po dobrej myśli:
      // wymusza naprawę WCAG_MAP zamiast pozwolić na cichy fallback.
      throw new FrameworkProfileError(data.framework, "no WCAG rule coverage declared");
    }
    return new FrameworkProfile(data);
  }

  matchesFile(filePath: string): boolean {
    return this.data.fileExtensions.some((ext) => filePath.endsWith(ext));
  }

  resolveConfigPath(scriptDir: string): string {
    return resolve(scriptDir, "..", "config", "eslint", this.data.eslintConfigFile);
  }

  // Nielegalna operacja: pytanie o WCAG dla nieznanej reguły RZUCA, nie zwraca fallback.
  wcagFor(ruleId: string): string {
    const wcag = this.data.wcagRuleMap[ruleId];
    if (!wcag) {
      throw new FrameworkProfileError(
        this.data.framework,
        `no WCAG mapping for rule "${ruleId}" — add it to this profile's wcagRuleMap before shipping`,
      );
    }
    return wcag;
  }
}
```

**Repozytorium — jeden punkt ładowania wszystkich czterech profili, atomowo:**

```typescript
// Pseudokod.
class FrameworkProfileRegistry {
  private readonly profiles: Map<Framework, FrameworkProfile>;

  private constructor(profiles: Map<Framework, FrameworkProfile>) {
    this.profiles = profiles;
  }

  // Ładuje WSZYSTKIE cztery profile na raz. Jeśli JEDEN jest niekompletny
  // (np. Svelte bez wcagRuleMap), całość rzuca — nie ładuje trzech dobrych
  // i cicho pomija czwarty. To jest "atomowość" wymagana przez ten niezmiennik:
  // nie chcemy systemu, który "częściowo" wspiera cztery frameworki.
  static loadAll(): FrameworkProfileRegistry {
    const profiles = new Map<Framework, FrameworkProfile>();
    const errors: FrameworkProfileError[] = [];

    for (const raw of RAW_FRAMEWORK_DATA) {
      try {
        profiles.set(raw.framework, FrameworkProfile.create(raw));
      } catch (err) {
        if (err instanceof FrameworkProfileError) errors.push(err);
        else throw err;
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, "One or more FrameworkProfiles failed validation");
    }
    return new FrameworkProfileRegistry(profiles);
  }

  get(framework: Framework): FrameworkProfile {
    const profile = this.profiles.get(framework);
    if (!profile) throw new FrameworkProfileError(framework, "no profile registered");
    return profile;
  }
}
```

**Cienki CLI entry point (odpowiednik "route" w tym repo — `src/pre-commit.ts`'s `main()`):**

```typescript
// Pseudokod — zamiast dzisiejszych trzech niezależnych lookupów.
async function main() {
  const registry = FrameworkProfileRegistry.loadAll(); // rzuca na starcie, nie w połowie pipeline
  const framework = resolveFramework(projectRoot);       // detect / persisted / prompt — bez zmian
  const profile = registry.get(framework);               // jedno miejsce prawdy

  const relevantFiles = allStaged.filter((f) => profile.matchesFile(f));
  const configFile = profile.resolveConfigPath(scriptDir);
  // ... lintFiles(...) bez zmian ...

  for (const msg of eslintMessages) {
    try {
      const wcag = profile.wcagFor(msg.ruleId); // RZUCA, nie fallback "WCAG"
      violations.push({ ...msg, wcag });
    } catch (err) {
      // Fail-fast, nie cicho: naruszenie WCIĄŻ blokuje commit (niezmiennik C
      // zachowany), ale developer i maintainer widzą JAWNY błąd konfiguracji
      // narzędzia, nie milczący "WCAG" string.
      reportProfileGap(framework, msg.ruleId, err);
      violations.push({ ...msg, wcag: "UNMAPPED — see stderr warning above" });
    }
  }
  // exit codes bez zmian: 0 / 1 / 2
}
```

**Uwaga o "egzekucja przenosi się z klienta na serwer":** ten fragment promptu nie ma dosłownego zastosowania — nie ma podziału klient/serwer w tym repo. Analogicznie stosowana zasada: dziś decyzja "czy WCAG-cytat istnieje" jest rozstrzygana niejawnie, w locie, przy formatowaniu output (`src/pre-commit.ts:286`, tuż przed wypisaniem na stderr) — czyli najbliżej "prezentacji", nie "domeny". Po refaktorze, decyzja przenosi się do `FrameworkProfile.create()` (walidacja przy starcie procesu) i `FrameworkProfile.wcagFor()` (fail-fast przy użyciu) — czyli z warstwy prezentacji/formatowania do warstwy domenowej/agregatu, analogicznie do przeniesienia "z klienta na serwer" nawet bez literalnego klient-serwer podziału.

## KROK 5 — Before/after, plan, testy

**Before/after:**

| Miejsce | Before | After |
|---|---|---|
| Rozszerzenia plików | `getExtensionsForFramework()` — switch niezależny od reszty (`src/pre-commit.ts:101-114`) | `profile.matchesFile(filePath)` — metoda agregatu, zbudowana z tych samych danych co WCAG-mapa tego frameworka |
| Ścieżka config-pliku | `frameworkToFile` obiekt z fallbackiem `?? "react.cjs"` (`src/pre-commit.ts:121-131`) | `profile.resolveConfigPath()` — brak fallbacku; jeśli framework nieznany, `registry.get()` rzuca `FrameworkProfileError` |
| WCAG-cytat | `WCAG_MAP[msg.ruleId] ?? "WCAG"` — cichy fallback (`src/pre-commit.ts:286`) | `profile.wcagFor(msg.ruleId)` — rzuca `FrameworkProfileError`, przechwycone i zaraportowane jako WIDOCZNE ostrzeżenie, nie ciche "WCAG" |
| Kompletność pokrycia dla Svelte | Nieznana do czasu, aż ktoś ręcznie porówna klucze `WCAG_MAP` z regułami `svelte.cjs` | `FrameworkProfileRegistry.loadAll()` rzuca PRZY STARCIE procesu, jeśli `wcagRuleMap` Svelte jest pusta lub niekompletna — nie da się uruchomić pre-commit hooka z niekompletnym profilem po naprawieniu tego |

**Plan faz refaktoru** (projekt ma dyscyplinę testową — `vitest`, `tests/pre-commit-integration.test.ts` spawnuje realny proces potomny; poniższy plan idzie test-first tam, gdzie runner już istnieje):

1. **Faza 1 (test-first).** Napisać `tests/framework-profile.test.ts` z przypadkami testowymi niżej PRZED napisaniem `FrameworkProfile`/`FrameworkProfileRegistry`. Czerwone testy najpierw.
2. **Faza 2.** Zaimplementować `FrameworkProfile`, `FrameworkProfileRegistry`, `FrameworkProfileError` w nowym pliku `src/framework-profile.ts` (analogicznie do istniejącej struktury `src/*.ts`).
3. **Faza 3.** Uzupełnić `WCAG_MAP`-równoważne dane dla Svelte — to jest moment, w którym brak pokrycia z `01-domain-distillation.md` faktycznie się naprawia, wymuszony przez to, że `FrameworkProfile.create()` odmówi zbudowania profilu Svelte bez tego.
4. **Faza 4.** Przełączyć `src/pre-commit.ts`'s `main()` na `FrameworkProfileRegistry` — zastąpić trzy niezależne lookupy jednym `registry.get(framework)`. Zachować dotychczasowe exit codes (0/1/2) — niezmiennik C nie może się zepsuć.
5. **Faza 5 (test-first dla regresji).** Rozszerzyć `tests/pre-commit-integration.test.ts` o realny smoke test dla Svelte analogiczny do istniejącego "Angular smoke test" (`prd.md:99` wspomina go jako istniejący wzorzec) — zweryfikować, że naruszenie Svelte w rzeczywistym procesie potomnym raportuje realny WCAG-cytat, nie fallback.

**Przypadki testowe dla niezmiennika A (legalne i nielegalne):**

- **Legalne:** `FrameworkProfile.create()` z kompletnymi danymi dla React/Vue/Angular (dzisiejszy stan) — MUSI się powieść bez zmian.
- **Legalne (po naprawie):** `FrameworkProfile.create()` dla Svelte z uzupełnioną `wcagRuleMap` (np. `{ "svelte/valid-compile": "..." }` lub bardziej granularne mapowanie, jeśli `valid-compile`'s message-parsing pozwoli rozróżnić podkategorie) — MUSI się powieść.
- **Nielegalne:** `FrameworkProfile.create()` z pustą `wcagRuleMap` — MUSI rzucić `FrameworkProfileError`, nie zwrócić obiekt z ciekawymi domyślnymi wartościami.
- **Nielegalne:** `FrameworkProfile.create()` z `fileExtensions: []` — MUSI rzucić.
- **Nielegalne:** `profile.wcagFor("nieznana-reguła")` na w pełni zbudowanym, legalnym profilu — MUSI rzucić `FrameworkProfileError`, nie zwrócić `"WCAG"`.
- **Legalne:** `profile.wcagFor("jsx-a11y/alt-text")` na profilu React — MUSI zwrócić `"1.1.1 Non-text Content"`.
- **Nielegalne (atomowość rejestru):** `FrameworkProfileRegistry.loadAll()`, gdy DOWOLNY z czterech profili jest niekompletny — MUSI rzucić `AggregateError` obejmujący WSZYSTKIE błędy walidacji, nie tylko pierwszy, i MUSI NIE zwrócić rejestru z trzema dobrymi profilami i jednym brakującym (żadnej częściowej sukcesu).
- **Regresja:** dla wszystkich dzisiejszych zielonych testów w `tests/pre-commit-integration.test.ts` — MUSZĄ pozostać zielone po refaktorze (exit codes 0/1/2 niezmienione, format stderr-output niezmieniony poza treścią WCAG-pola dla Svelte).

**Load-bearing nazwy do zarejestrowania w rejestrze kontraktów:** sprawdzono — `docs/reference/contract-surfaces.md` (wzorzec nazwany w `CLAUDE.md` tego repozytorium) **BRAK artefaktu** — plik/katalog nie istnieje w tym repozytorium (zweryfikowano: `docs/reference/` nie istnieje wcale). Gdyby taki rejestr istniał, poniższe nazwy byłyby kandydatami do wpisania: `FrameworkProfile`, `FrameworkProfileRegistry`, `FrameworkProfileError`, `FrameworkProfileData`. Odnotowuję to jawnie jako "BRAK artefaktu" zamiast wymyślać strukturę rejestru, która nie istnieje.

---

## Podsumowanie

Ten dokument identyfikuje pięć niezmienników biznesowych w a11y-sdk i wybiera **spójność rozstrzygania frameworka (niezmiennik A)** jako priorytet #1 do refaktoru — jest jednocześnie najbardziej rdzeniowy (cały produkt jest zbudowany wokół poprawnego routingu framework→plugin→WCAG-mapa) i najsłabiej egzekwowany (trzy textually niezależne struktury danych w `src/pre-commit.ts`, bez żadnej weryfikacji ich wzajemnej zgodności). Najdotkliwszy, empirycznie zweryfikowany symptom tego niezmiennika to niezmiennik B: cały framework Svelte raportuje naruszenia WCAG przez ciche fallbacki (`WCAG_MAP[msg.ruleId] ?? "WCAG"`, `src/pre-commit.ts:286`) zamiast realnych cytatów, i nic dziś to nie sygnalizuje developerowi. Projekt proponuje agregat `FrameworkProfile` (walidowany atomowo przy tworzeniu, rzucający named error przy nielegalnym zapytaniu o nieznaną regułę) plus `FrameworkProfileRegistry` (ładujący wszystkie cztery profile atomowo, rzucający jeśli którykolwiek jest niekompletny) jako jedyne miejsce egzekwowania tego niezmiennika, zastępujące dzisiejsze trzy rozłączne lookupy. Plan refaktoru jest pięciofazowy, test-first tam gdzie istnieje runner (`vitest`), z konkretnymi przypadkami legalnych/nielegalnych operacji. Rejestr kontraktów (`docs/reference/contract-surfaces.md`) nie istnieje w tym repo — odnotowane jako BRAK artefaktu, nie wymyślone.
