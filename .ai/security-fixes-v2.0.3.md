# Security Fixes v2.0.3 - Migration Guide

## Critical Security Vulnerabilities Fixed

This release fixes **5 security vulnerabilities** discovered during security audit.

## Breaking Changes

### 1. CSRF Protection Re-enabled

**What changed:**

```javascript
// Before v2.0.2 (INSECURE!)
csrf: {
	checkOrigin: false;
}

// After v2.0.3 (SECURE)
csrf: {
	checkOrigin: true;
}
```

**Impact:**

- API requests from different origins will be rejected
- Reverse proxy must pass Origin/Referer headers correctly

**Required Action for Production:**

If using **Nginx**:

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header Origin $http_origin;  # ADD THIS
    proxy_set_header Referer $http_referer; # ADD THIS
}
```

If using **Traefik**:

```yaml
# No action needed - Traefik passes headers by default
```

If using **Apache**:

```apache
ProxyPreserveHost On
RequestHeader set Origin expr=%{HTTP:Origin}
RequestHeader set Referer expr=%{HTTP:Referer}
```

### 2. Container Control Restricted

**What changed:**

- `/api/containers/[id]/start` - Now requires label
- `/api/containers/[id]/stop` - Now requires label

**Before:**

```bash
curl -X POST http://loggator:3000/api/containers/ANY_CONTAINER/stop
# ✅ Worked for ANY container
```

**After:**

```bash
curl -X POST http://loggator:3000/api/containers/mysql/stop
# ❌ 403 Forbidden: Container is not monitored by Loggator

curl -X POST http://loggator:3000/api/containers/app/stop
# ✅ Works (if app has loggator.enable=true label)
```

**Impact:**

- Only containers with `loggator.enable=true` can be controlled
- Other containers are now protected

**Required Action:**

- Review your automation scripts
- Ensure containers you want to control have the label

## Non-Breaking Security Improvements

### 3. Parameter Validation

**Limits enforced:**

- Search limit: 1-1000 (was unbounded)
- Search offset: 0-100,000 (was unbounded)
- Chat message length: 10,000 chars (unchanged)
- Chat history: 50 messages (unchanged)

**Impact:**

- Protects against DoS via extreme parameters
- No action needed unless you use extreme values

### 4. Filter Injection Prevention

**What changed:**

```typescript
// Before (VULNERABLE)
filter: `containerName = "${params.container}"`;
// Input: test" OR 1=1 OR x="
// Result: containerName = "test" OR 1=1 OR x=""  // BYPASS!

// After (SECURE)
const escaped = params.container.replace(/"/g, '\\"');
filter: `containerName = "${escaped}"`;
// Input: test" OR 1=1 OR x="
// Result: containerName = "test\" OR 1=1 OR x=\""  // SAFE
```

**Impact:**

- Attackers can no longer bypass container filters
- AI can only access logs from labeled containers
- No action needed

### 5. Markdown XSS Hardening

**What changed:**

- Disabled `headerIds` (prevents id injection)
- Disabled `mangle` (prevents email obfuscation exploits)
- Monitoring for DOMPurify integration in future release

**Impact:**

- Reduced XSS attack surface
- AI responses are still formatted correctly
- No action needed

## Testing Your Deployment

### 1. Test CSRF Protection

```bash
# Should FAIL (cross-origin request)
curl -X POST http://loggator:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Origin: http://evil.com" \
  -d '{"messages":[]}'

# Should WORK (same origin)
curl -X POST http://loggator:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Origin: http://loggator:3000" \
  -d '{"messages":[]}'
```

### 2. Test Container Control

```bash
# Get container ID of non-labeled container
docker ps -a --filter "label!=loggator.enable" --format "{{.ID}}" | head -1

# Try to stop it - should FAIL
curl -X POST http://loggator:3000/api/containers/CONTAINER_ID/stop
# Expected: {"error":"Container is not monitored by Loggator"}

# Try labeled container - should WORK
curl -X POST http://loggator:3000/api/containers/test-logger/stop
# Expected: {"success":true,...}
```

### 3. Test Filter Injection

```bash
# Attempt injection - should be escaped
curl 'http://loggator:3000/api/logs/search?q=test&container=test%22%20OR%201=1%20OR%20x=%22'
# Should only return logs from "test" OR 1=1 OR x="" container (probably none)
# NOT all logs
```

## Rollback Plan

If you encounter issues:

```bash
# 1. Pull previous version
docker pull ghcr.io/mbeggiato/loggator:2.0.2

# 2. Update docker-compose.yml
services:
  loggator:
    image: ghcr.io/mbeggiato/loggator:2.0.2  # Pin to old version

# 3. Restart
docker compose up -d
```

**Note:** Previous version has security vulnerabilities. Only rollback temporarily!

## Upgrade Checklist

- [ ] Review reverse proxy configuration (Origin/Referer headers)
- [ ] Test CSRF protection with your setup
- [ ] Verify container control still works for labeled containers
- [ ] Update automation scripts if they control containers
- [ ] Test in staging environment first
- [ ] Monitor logs for 403 errors after upgrade
- [ ] Document any custom Origin configurations

## Questions?

- GitHub Issues: https://github.com/MBeggiato/loggator/issues
- Security Contact: [Create Private Security Advisory]

## Timeline

- **2026-01-20 10:00 UTC**: Vulnerabilities discovered
- **2026-01-20 12:00 UTC**: Fixes implemented
- **2026-01-20 14:00 UTC**: v2.0.3 released
- **2026-01-27**: v2.0.2 deprecated (security)
- **2026-02-10**: v2.0.2 removed from registry
