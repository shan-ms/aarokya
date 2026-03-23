# DevOps & CI/CD Configuration Review — Aarokya

**Reviewed**: 2026-03-18
**Files reviewed**:
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `docker/Dockerfile.backend`
- `docker/Dockerfile.control-center`
- `docker/docker-compose.yml`
- `docker/docker-compose.prod.yml`
- `docker/.env.example`
- `.github/PULL_REQUEST_TEMPLATE.md`

---

## 1. Critical Issues

### 1.1 Deploy workflow has placeholder-only deployment steps (deploy.yml:137-158)

The deploy job contains only `echo` statements and `TODO` comments. Any push to `main` will trigger this workflow and report a successful deployment without actually deploying anything. This is misleading and could mask the fact that nothing was deployed.

**Recommendation**: Either implement real deployment steps or remove the workflow until ready. At minimum, fail the job explicitly so it does not report green:
```yaml
- name: Deploy Backend
  run: |
    echo "ERROR: Deployment not configured" && exit 1
```

### 1.2 Redis health check in production leaks password in process list (docker-compose.prod.yml:54)

```yaml
test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
```

The `-a` flag passes the password as a command-line argument, which is visible in `/proc` and `ps` output on the host. This is a known Redis security concern.

**Recommendation**: Use `REDISCLI_AUTH` environment variable instead:
```yaml
test: ["CMD-SHELL", "REDISCLI_AUTH=$REDIS_PASSWORD redis-cli ping"]
```

### 1.3 Dev compose exposes Redis without authentication (docker-compose.yml:30-31)

Redis in the dev compose has no password and is bound to all interfaces on port 6379. If a developer runs this on a machine with a public IP or shared network, Redis is openly accessible.

**Recommendation**: Add `--requirepass` even in dev, or bind to `127.0.0.1` only:
```yaml
ports:
  - "127.0.0.1:${REDIS_PORT:-6379}:6379"
```

### 1.4 Dev compose JWT_SECRET default value is insecure and may leak into production (docker-compose.yml:52)

```yaml
JWT_SECRET: ${JWT_SECRET:-change-this-in-production}
```

If someone forgets to set `JWT_SECRET` in their `.env` file, the fallback is a predictable string. This is acceptable for local dev but dangerous if the dev compose file is accidentally used in a staging or production-like environment.

**Recommendation**: Remove the default fallback so the service fails fast if the variable is not set, or use a randomly generated value at compose startup.

---

## 2. Important Issues

### 2.1 CI does not wait for Customer/Partner app checks before deploying (deploy.yml:21-38)

The `ci-check` job waits only for "Backend (Rust)" and "Control Center (Next.js)" checks. The `customer-test` and `partner-test` CI jobs are ignored. While the mobile apps are not deployed via Docker, a broken mobile app CI should still gate deployment since the backend serves those apps.

**Recommendation**: Add wait steps for "Customer App (React Native)" and "Partner App (React Native)" or use a matrix/required-checks approach.

### 2.2 `cargo check` is redundant after `cargo clippy` (ci.yml:79-81)

`cargo clippy` already runs all the checks that `cargo check` does, plus linting. Running both wastes CI time (Rust compilation is expensive).

**Recommendation**: Remove the `cargo check` step; `clippy` covers it.

### 2.3 Control Center Dockerfile assumes Next.js standalone output without verifying config (Dockerfile.control-center:49)

```dockerfile
COPY --from=builder --chown=aarokya:aarokya /app/.next/standalone ./
```

This will fail at build time if the Next.js config does not set `output: 'standalone'`. There is no validation or clear error message.

**Recommendation**: Add a build-time check or document the requirement. Ideally, assert in the Dockerfile:
```dockerfile
RUN test -d .next/standalone || (echo "ERROR: Next.js must use output: 'standalone'" && exit 1)
```

### 2.4 Backend Dockerfile copies migrations from host context, not from builder stage (Dockerfile.backend:55)

```dockerfile
COPY backend/migrations/ /app/migrations/
```

This COPY uses the build context directly, bypassing the multi-stage build chain. While this works, it means the runtime stage depends on the build context having the migrations directory. If someone builds from a different context or if the directory is empty, it may silently produce an image without migrations.

**Recommendation**: Copy migrations into the builder stage and then from builder to runtime, or add a check:
```dockerfile
COPY backend/migrations/ /app/migrations/
RUN test -d /app/migrations && ls /app/migrations/*.sql > /dev/null 2>&1 || echo "WARNING: No migration files found"
```

### 2.5 No network isolation in production compose (docker-compose.prod.yml)

All services sit on the default network. Postgres and Redis are accessible from every container, including control-center which only needs to talk to the backend.

**Recommendation**: Define separate networks:
```yaml
networks:
  frontend:
  backend:
  data:

services:
  postgres:
    networks: [data]
  redis:
    networks: [data]
  backend:
    networks: [frontend, data]
  control-center:
    networks: [frontend]
```

### 2.6 Production compose still binds database ports to localhost (docker-compose.prod.yml:17,49)

While binding to `127.0.0.1` is better than `0.0.0.0`, exposing Postgres and Redis ports on the host at all in production is unnecessary if only other containers need access. This increases the attack surface.

**Recommendation**: Remove the `ports` mapping entirely for postgres and redis in production. Services communicate over the Docker network by service name.

### 2.7 No image vulnerability scanning in CI (deploy.yml)

Docker images are built and pushed but never scanned for CVEs.

**Recommendation**: Add a scanning step after each build:
```yaml
- name: Scan image
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ steps.meta.outputs.tags }}
    severity: CRITICAL,HIGH
    exit-code: 1
```

---

## 3. Minor Issues

### 3.1 Pinned Rust version in Dockerfile may drift from CI (Dockerfile.backend:4)

The Dockerfile pins `rust:1.82-slim-bookworm` while CI uses `dtolnay/rust-toolchain@stable` (which tracks latest stable). A version mismatch between CI compilation and Docker image build can cause subtle differences.

**Recommendation**: Either pin both to the same version or use a build arg:
```dockerfile
ARG RUST_VERSION=1.82
FROM rust:${RUST_VERSION}-slim-bookworm AS chef
```

### 3.2 `lewagon/wait-on-check-action` pinned to v1.3.4 (deploy.yml:25)

This third-party action is pinned by tag, not by SHA. A compromised tag could inject malicious code.

**Recommendation**: Pin by commit SHA:
```yaml
uses: lewagon/wait-on-check-action@<full-sha>
```

### 3.3 Dev compose missing `restart` policy (docker-compose.yml)

The dev compose services have no `restart` policy, which is fine for development but worth noting for consistency.

### 3.4 Backend service in dev compose has no health check (docker-compose.yml:43-56)

The Dockerfile defines a HEALTHCHECK, but the dev compose does not define one at the service level. The `control-center` service depends on `backend` without a health condition, so it may start before the backend is ready.

**Recommendation**:
```yaml
backend:
  ...
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
    interval: 10s
    timeout: 5s
    retries: 5

control-center:
  depends_on:
    backend:
      condition: service_healthy
```

### 3.5 No `.dockerignore` file referenced or checked

Without a `.dockerignore`, the build context may include `.git`, `node_modules`, `target/`, and other large directories, slowing down builds significantly.

**Recommendation**: Create a `.dockerignore` at the repo root:
```
.git
**/node_modules
**/target
**/.next
*.md
.env*
```

### 3.6 `NEXT_PUBLIC_API_URL` is set at runtime but is a build-time variable (Dockerfile.control-center / docker-compose)

Next.js `NEXT_PUBLIC_*` variables are inlined at build time, not at runtime. Setting `NEXT_PUBLIC_API_URL` as a runtime environment variable in docker-compose will have no effect.

**Recommendation**: Pass `NEXT_PUBLIC_API_URL` as a build arg in the Dockerfile:
```dockerfile
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build
```
Or use Next.js runtime configuration instead of `NEXT_PUBLIC_*` prefix.

---

## 4. Suggestions

### 4.1 Add a dependency review workflow for PRs

Use GitHub's dependency-review-action to catch vulnerable dependencies before they land:
```yaml
- name: Dependency Review
  uses: actions/dependency-review-action@v4
```

### 4.2 Add a database migration check in CI

The backend CI runs tests but does not explicitly verify that migrations apply cleanly to a fresh database. Consider adding a step:
```yaml
- name: Run migrations
  run: cargo sqlx migrate run
```

### 4.3 Add a `docker-compose.test.yml` for integration tests

A dedicated test compose file that spins up all services and runs end-to-end health checks would catch integration issues before deployment.

### 4.4 Add build time and git SHA labels to images

The metadata action already provides labels, but adding explicit build-time info aids debugging:
```dockerfile
ARG BUILD_DATE
ARG GIT_SHA
LABEL org.opencontainers.image.created=$BUILD_DATE
LABEL org.opencontainers.image.revision=$GIT_SHA
```

### 4.5 Add monitoring and alerting configuration

Consider adding:
- A Prometheus metrics endpoint in the backend (`/metrics`)
- A `docker-compose.monitoring.yml` with Prometheus + Grafana for local observability
- Alertmanager rules for container restart loops and health check failures

### 4.6 Add a rollback mechanism to the deploy workflow

The deploy job should support rolling back to the previous image tag if health checks fail post-deployment. Store the previous tag and revert on failure.

### 4.7 Add branch protection workflow status checks

Document which CI jobs should be required status checks for branch protection on `main`:
- `backend-test`
- `customer-test`
- `partner-test`
- `control-center-test`

### 4.8 Consider adding a security scanning workflow

A scheduled workflow (e.g., weekly) that runs `cargo audit` and `npm audit` across all packages to catch newly disclosed vulnerabilities.

### 4.9 Add backup configuration for production PostgreSQL

The production compose has persistent volumes but no backup strategy. Consider a sidecar container or cron job that runs `pg_dump` to object storage.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 4     |
| Important | 7    |
| Minor    | 6     |
| Suggestions | 9  |

**Overall assessment**: The configuration is well-structured with good fundamentals — multi-stage Docker builds, health checks, resource limits in production, GHA caching, and non-root container users. The most pressing issues are: (1) the `NEXT_PUBLIC_*` runtime variable that will silently not work, (2) the placeholder deploy steps that report false success, (3) the Redis password exposure in health checks, and (4) the missing network isolation in production. Addressing these would significantly improve production readiness.
