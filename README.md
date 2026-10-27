# ikigai-pivot-map

Career-pivot tool. The visitor picks the role they are losing, answers a short
wizard, and gets three realistic adjacent roles plus a 90-day bridge and a runway
estimate. Numbers are estimates, nothing is stored.

This repository started life as a single `ikigai.zip` holding a Vite front end and
a small Node API. It is now a Spring Boot service: the Java side serves the page and
implements the model call, and the original JavaScript lives in `client/` for
reference and for rebuilding the bundle.

## Layout

```
pom.xml                          Spring Boot 4.1.2, Java 25, Maven
src/main/java/com/ikigai/pivotmap/
  IkigaiPivotMapApplication      entry point
  api/MapController              POST /api/map
  api/RequestValidator           port of validateRequest from the old server/api.js
  api/ResponseValidator          port of validateResponse, clamps and filters the model reply
  api/PromptBuilder              port of buildMessages, keeps profile data in a <data> block
  api/DeepSeekClient             chat-completions call, eight second timeout
  api/RateLimiter                ten requests a minute per address
  api/Chips                      the chip vocabulary from data/chips.json
src/main/resources/static/       the built page, served at /
src/main/resources/data/         chips.json, used for server side validation
src/test/java/                   33 tests, the cases from the original JS suite
client/                          original Vite project: index.html, src/, server/, tests/
```

The Node server in `client/server/` is kept as the reference implementation. It is
not used at runtime.

## Build and run

```bash
export JAVA_HOME=/opt/homebrew/Cellar/openjdk/25.0.2/libexec/openjdk.jdk/Contents/Home
mvn package                       # runs the tests, builds the jar
java -jar target/ikigai-pivot-map-0.0.1-SNAPSHOT.jar
```

Open http://localhost:8080.

The page works without a key. The AI request then fails with 502 and the browser
falls back to the nearest sample role, which is the behaviour the original client
was written for.

To get live targets, export a key before starting:

```bash
export DEEPSEEK_API_KEY=sk-...
java -jar target/ikigai-pivot-map-0.0.1-SNAPSHOT.jar
```

Rebuilding the page after a change in `client/`:

```bash
cd client
npm install
npm run build
cp -R dist/* ../src/main/resources/static/
```

## API

`POST /api/map` takes the wizard answers and returns three targets.

```json
{
  "role": "UX Designer",
  "years": 5,
  "loves": ["helping people"],
  "good_at": ["explaining"],
  "world_needs": ["health"],
  "enjoyed_most": ["finding errors"],
  "help_who": ["patients"],
  "savings_months": 4,
  "min_income": 40000,
  "retrain": "weeks"
}
```

`role` may be empty when `resume_text` is present. `retrain` is `none`, `weeks` or
`months`. Chip values must come from `data/chips.json`.

| Status | Meaning |
| --- | --- |
| 200 | three targets and a bridge |
| 400 | invalid body, or broken JSON |
| 405 | not a POST |
| 413 | body over 64 KB |
| 429 | over ten requests a minute from one address |
| 502 | model unavailable, refused, or answered with an unusable shape |

## What changed in the port

- The API is Java. Validation, clamping, prompt construction and response filtering
  are line for line equivalents, so the browser cannot tell which one it is talking to.
- The front end is a Vite build copied into static resources, so the Spring Boot jar is
  the whole application. Node is only needed to rebuild the page.
- The rate limiter is per address in memory, as before. Behind a proxy it reads the
  first `X-Forwarded-For` entry.
- The model key is read from `DEEPSEEK_API_KEY`. It is never written to a file here.
