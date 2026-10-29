# Todo App — tenant fixture

A deliberately small, **zero-dependency** Todo application used as the demo tenant for the
[self-healing deployment platform](../README.md). The platform clones this repository, runs its
tests, builds the Docker image, deploys it to Kubernetes, then health-checks it and rolls back if
the score degrades.

This app is **not** part of the platform. It is a normal user project — the kind any developer would
register — which is exactly what makes it useful as a test fixture.

## Stack

| | |
|---|---|
| Runtime | Node.js 20+ (no production dependencies) |
| Server | `node:http` |
| Storage | In-memory (resets on restart — intentional) |
| UI | One static HTML file, no build step |
| Tests | `node --test` |
| Container | `node:20-alpine`, non-root, port `5000` |

## Run

```bash
npm start          # http://localhost:5000
npm test           # validators + HTTP API tests
npm run dev        # watch mode

docker compose up --build
```

## Platform registration

| Field | Value |
|---|---|
| Repository URL | this repository |
| Container port | `5000` |
| Health path | `/health` |

The platform's `TestStage` runs `node --test` in the clone, `BuildStage` runs `docker build`, and
`HealthMonitor` polls the health path. `/metrics` exports Prometheus counters for the monitoring
stack.

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Todo UI |
| `GET` | `/health` | Liveness/readiness probe |
| `GET` | `/metrics` | Prometheus metrics |
| `GET` | `/api/todos` | List todos |
| `POST` | `/api/todos` | Create — `{"title": "..."}` |
| `GET` | `/api/todos/{id}` | Fetch one |
| `PATCH` | `/api/todos/{id}` | Update — `{"title"?: "...", "completed"?: true}` |
| `DELETE` | `/api/todos/{id}` | Delete |

```bash
curl -X POST localhost:5000/api/todos \
  -H 'content-type: application/json' \
  -d '{"title":"deploy me"}'

curl localhost:5000/api/todos
curl localhost:5000/health
```

Errors are JSON: `400` invalid input, `404` not found, `405` method not allowed, `413` body too large.

## Layout

```
index.js              server entry point (listen + graceful shutdown)
src/app.js            routing, JSON handling, metrics
src/store.js          in-memory store
utils/validators.js   title/id/patch validation
public/index.html     UI
tests/                node:test suites (validator + API)
k8s/                  optional standalone manifests
Dockerfile            production image
```

## Deliberate simplifications

- State is in memory, so a restart loses todos. A real tenant would use a database; keeping this
  fixture stateless makes rollback and scaling behaviour easy to observe.
- No auth, no frameworks. The fixture should be trivially buildable on a 7 GB machine, and every
  line should be understandable when demonstrating the platform.
