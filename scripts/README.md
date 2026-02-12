# Scripts Directory

This directory contains utility scripts for the GeoRelationalNFT project.

## Available Scripts

### test-frontend-commands.sh

Comprehensive test script to verify all frontend npm commands work correctly.

**Features:**
- ✅ Tests all frontend package.json scripts
- ✅ HTTPS verification for SSL development server
- ✅ Port availability checking
- ✅ Timeout handling for long-running processes
- ✅ Colored output for easy reading
- ✅ Detailed test summary

**Usage:**

```bash
# Run all tests (including interactive dev servers)
./scripts/test-frontend-commands.sh

# Skip interactive tests (dev/start servers)
./scripts/test-frontend-commands.sh --skip-interactive
```

**Tests Performed:**

1. **Type Checking** (`pnpm typecheck`) - Validates TypeScript types
2. **Linting** (`pnpm lint`) - Runs ESLint checks
3. **Jest Tests** (`pnpm test`) - Executes test suite
4. **Build** (`pnpm build`) - Creates production build
5. **Preview Server** (`pnpm start`) - Tests production server (port 3000)
6. **Development Server** (`pnpm dev`) - Tests Turbopack dev server (port 3000)
7. **HTTPS Development** (`pnpm dev:ssl`) - Tests HTTPS proxy setup (ports 3000 & 3443)
8. **Clean** (`pnpm clean`) - Verifies cleanup command

**HTTPS Testing:**

The script includes comprehensive HTTPS verification:
- Checks if SSL certificates exist (`localhost.pem`, `localhost-key.pem`)
- Verifies both HTTP (3000) and HTTPS (3443) ports are accessible
- Allows self-signed certificates (expected for local development)
- Displays certificate information for debugging

**Requirements:**

For HTTPS tests:
```bash
# Install mkcert (macOS)
brew install mkcert

# Generate local certificates
cd packages/frontend
mkcert localhost
```

**CI/CD Integration:**

Use `--skip-interactive` flag in CI environments to avoid hanging on server tests:

```yaml
# Example GitHub Actions
- name: Test Frontend Commands
  run: ./scripts/test-frontend-commands.sh --skip-interactive
```

**Exit Codes:**
- `0` - All tests passed
- `1` - One or more tests failed

**Troubleshooting:**

If a test fails:
1. Check the colored output for specific error messages
2. Review log files in `/tmp/frontend-*.log`
3. Ensure no processes are already using ports 3000 or 3443
4. For HTTPS tests, verify SSL certificates are present

**Example Output:**

```
========================================
Test Summary
========================================

Individual Test Results:
------------------------
✓ typecheck: PASSED
✓ lint: PASSED
✓ test: PASSED
✓ build: PASSED
✓ start: PASSED
✓ dev: PASSED
✓ dev:ssl: PASSED
✓ clean: PASSED

Overall Results:
----------------
Total Tests: 8
Passed: 8
Failed: 0

[PASS] All tests passed! 🎉
```
