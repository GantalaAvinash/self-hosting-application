# Traefik Port Collision Detection

## Overview
Comprehensive port collision detection system to prevent Traefik configuration errors that could break the instance and prevent access to applications.

## Port Collision Checks

### 1. Default Traefik Ports Protection
**Location:** `apps/dokploy/server/api/routers/settings.ts` - `updateTraefikPorts`

**Protected Ports:**
- `TRAEFIK_PORT` (default: 80) - HTTP traffic
- `TRAEFIK_SSL_PORT` (default: 443) - HTTPS traffic  
- `TRAEFIK_HTTP3_PORT` (default: 443) - HTTP/3 traffic

**Validation:**
- Prevents adding additional ports that conflict with core Traefik ports
- Error message clearly identifies which default port is being violated

### 2. Duplicate Port Detection
**Location:** `apps/dokploy/server/api/routers/settings.ts` - `updateTraefikPorts`

**Checks:**
- Detects duplicate `publishedPort` + `protocol` combinations within the same request
- Tracks port mappings by key: `${publishedPort}/${protocol}`
- Reports exact positions of duplicate entries

**Example Error:**
```
Duplicate port mapping: Port 8080/tcp is already defined at position 1 and position 3
```

### 3. Port Range Validation
**Location:** `apps/dokploy/server/api/routers/settings.ts` - `updateTraefikPorts`

**Validation:**
- `targetPort`: Must be between 1 and 65535
- `publishedPort`: Must be between 1 and 65535
- Validates both ports before checking collisions

### 4. Container Port Collision Detection
**Location:** `packages/server/src/services/settings.ts` - `checkPortInUse`

**Enhanced Detection:**
- Checks Docker container port mappings (excluding dokploy-traefik itself)
- Uses improved regex pattern: `grep -E ':[0-9]+->'` for more accurate matching
- Identifies conflicting container name

**Command:**
```bash
docker ps -a --format '{{.Names}}' | grep -v '^dokploy-traefik$' | while read name; do docker port "$name" 2>/dev/null | grep -E ':[0-9]+->' | grep -q ':${port}' && echo "$name" && break; done
```

### 5. System-Level Port Detection
**Location:** `packages/server/src/services/settings.ts` - `checkPortInUse`

**Checks:**
- Uses `netstat -tuln` or `ss -tuln` to detect system-level port usage
- Catches ports used by non-Docker services
- Reports as "system service" when detected

**Fallback Chain:**
1. Check Docker containers
2. Check system services (netstat/ss)
3. Return available if neither detects usage

### 6. Error Message Improvements
**Location:** `apps/dokploy/server/api/routers/settings.ts` - `updateTraefikPorts`

**Enhanced Messages:**
- **Default Port Conflict:** "Port X conflicts with Traefik HTTP (TRAEFIK_PORT). This port is reserved for Traefik core functionality."
- **Container Conflict:** "Published port X is already in use by container 'Y'. Please stop the conflicting service or use a different port."
- **Duplicate:** "Duplicate port mapping: Port X/protocol is already defined at position Y and position Z."
- **Range Error:** "Published port X must be between 1 and 65535"

## UI Warnings

### Traefik File System Page
**Location:** `apps/dokploy/components/dashboard/file-system/show-traefik-system.tsx`

**Warning Display:**
- Comprehensive warning block explaining risks
- Lists specific dangers:
  - Invalid configuration can break Traefik
  - Port collisions cause failures
  - Default ports are reserved
  - YAML validation required
  - Test in non-production first

## Validation Flow

```
User submits port configuration
    ↓
1. Validate port ranges (1-65535)
    ↓
2. Check for duplicates within array
    ↓
3. Check against default Traefik ports
    ↓
4. Check Docker container port usage
    ↓
5. Check system-level port usage
    ↓
6. If all checks pass → Save configuration
    If any check fails → Return detailed error
```

## Testing Recommendations

1. **Test Port Collisions:**
   - Try adding port 80 or 443 → Should fail with default port error
   - Try adding duplicate ports → Should fail with duplicate error
   - Try adding port in use by another container → Should fail with conflict error

2. **Test Edge Cases:**
   - Port 0 or 65536 → Should fail range validation
   - Same port, different protocols → Should be allowed
   - Port used by system service → Should be detected

3. **Test Error Messages:**
   - Verify error messages are clear and actionable
   - Check that conflicting container names are shown
   - Ensure position numbers are correct for duplicates

## Future Enhancements

1. **Real-time Port Validation:**
   - Check ports as user types in UI
   - Show available/conflicting status immediately

2. **Port Suggestion:**
   - Suggest alternative ports when collision detected
   - Show commonly used port ranges to avoid

3. **YAML Port Extraction:**
   - Parse Traefik YAML files to extract port configurations
   - Validate ports defined in YAML files before saving

4. **Port History:**
   - Track port usage history
   - Warn about recently freed ports that might still be in use

## Related Files

- `apps/dokploy/server/api/routers/settings.ts` - Port update API endpoint
- `packages/server/src/services/settings.ts` - Port checking utilities
- `apps/dokploy/components/dashboard/file-system/show-traefik-system.tsx` - UI component
- `packages/server/src/setup/traefik-setup.ts` - Traefik initialization with ports
