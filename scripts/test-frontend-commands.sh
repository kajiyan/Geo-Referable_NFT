#!/usr/bin/env bash

###############################################################################
# Frontend Commands Test Script
#
# This script verifies that all frontend npm commands work correctly,
# including HTTPS verification, timeout handling, and error detection.
#
# Usage: ./scripts/test-frontend-commands.sh [--skip-interactive]
#
# Options:
#   --skip-interactive    Skip tests that require user interaction (dev servers)
###############################################################################

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TIMEOUT_SHORT=10
TIMEOUT_MEDIUM=30
TIMEOUT_LONG=60
FRONTEND_DIR="packages/frontend"
SKIP_INTERACTIVE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-interactive)
      SKIP_INTERACTIVE=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Helper functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[PASS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[FAIL]${NC} $1"
}

log_section() {
  echo ""
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}========================================${NC}"
}

# Check if a port is open
check_port() {
  local port=$1
  local timeout=$2
  local start_time=$(date +%s)

  while true; do
    if nc -z localhost "$port" 2>/dev/null; then
      return 0
    fi

    local current_time=$(date +%s)
    local elapsed=$((current_time - start_time))

    if [ $elapsed -ge $timeout ]; then
      return 1
    fi

    sleep 1
  done
}

# Check if HTTPS endpoint is accessible
check_https() {
  local port=$1
  local timeout=$2

  log_info "Checking HTTPS on port $port..."

  # Use curl with -k to allow self-signed certificates
  if timeout $timeout curl -sk "https://localhost:$port" > /dev/null 2>&1; then
    log_success "HTTPS endpoint is accessible on port $port"
    return 0
  else
    log_error "HTTPS endpoint is NOT accessible on port $port"
    return 1
  fi
}

# Wait for server to be ready
wait_for_server() {
  local port=$1
  local timeout=$2
  local protocol=${3:-http}

  log_info "Waiting for server on port $port (timeout: ${timeout}s)..."

  if check_port "$port" "$timeout"; then
    log_success "Server is listening on port $port"

    # Additional HTTPS check if protocol is https
    if [ "$protocol" = "https" ]; then
      check_https "$port" 5
      return $?
    fi

    return 0
  else
    log_error "Server failed to start on port $port within ${timeout}s"
    return 1
  fi
}

# Kill process by port
kill_port() {
  local port=$1
  log_info "Cleaning up processes on port $port..."

  # Find and kill processes using the port
  local pid=$(lsof -ti tcp:$port 2>/dev/null)
  if [ -n "$pid" ]; then
    kill -9 $pid 2>/dev/null || true
    sleep 2
    log_success "Killed process on port $port"
  fi
}

# Change to frontend directory
cd "$FRONTEND_DIR"

log_section "Frontend Commands Verification"
log_info "Working directory: $(pwd)"
log_info "Skip interactive tests: $SKIP_INTERACTIVE"

# Test Results Tracking (bash 3.2 compatible - no associative arrays)
test_results_names=""
test_results_values=""
total_tests=0
passed_tests=0

# Helper to add test result
add_test_result() {
  local name=$1
  local value=$2
  test_results_names="${test_results_names}${name}|"
  test_results_values="${test_results_values}${value}|"
}

# Helper to get test result
get_test_result() {
  local name=$1
  local idx=0
  local IFS='|'

  for n in $test_results_names; do
    if [ "$n" = "$name" ]; then
      local i=0
      for v in $test_results_values; do
        if [ $i -eq $idx ]; then
          echo "$v"
          return
        fi
        i=$((i + 1))
      done
    fi
    idx=$((idx + 1))
  done
}

# Test 1: typecheck
log_section "Test 1: Type Checking (pnpm typecheck)"
total_tests=$((total_tests + 1))

if timeout $TIMEOUT_MEDIUM pnpm typecheck; then
  log_success "Type checking passed"
  add_test_result "typecheck" "PASS"
  passed_tests=$((passed_tests + 1))
else
  log_error "Type checking failed"
  add_test_result "typecheck" "FAIL"
fi

# Test 2: lint
log_section "Test 2: Linting (pnpm lint)"
total_tests=$((total_tests + 1))

if timeout $TIMEOUT_MEDIUM pnpm lint; then
  log_success "Linting passed"
  add_test_result "lint" "PASS"
  passed_tests=$((passed_tests + 1))
else
  log_error "Linting failed"
  add_test_result "lint" "FAIL"
fi

# Test 3: test
log_section "Test 3: Jest Tests (pnpm test)"
total_tests=$((total_tests + 1))

if timeout $TIMEOUT_LONG pnpm test -- --passWithNoTests; then
  log_success "Tests passed"
  add_test_result "test" "PASS"
  passed_tests=$((passed_tests + 1))
else
  log_error "Tests failed"
  add_test_result "test" "FAIL"
fi

# Test 4: build
log_section "Test 4: Build (pnpm build)"
total_tests=$((total_tests + 1))

log_info "Running production build..."
if timeout $TIMEOUT_LONG pnpm build; then
  log_success "Build completed successfully"
  add_test_result "build" "PASS"
  passed_tests=$((passed_tests + 1))

  # Check if .next directory was created
  if [ -d ".next" ]; then
    log_success "Build output directory (.next) exists"
  else
    log_warning "Build output directory (.next) not found"
  fi
else
  log_error "Build failed"
  add_test_result "build" "FAIL"
fi

# Test 5: start (preview server)
if [ "$SKIP_INTERACTIVE" = false ]; then
  log_section "Test 5: Preview Server (pnpm start)"
  total_tests=$((total_tests + 1))

  # Clean up any existing process on port 3000
  kill_port 3000

  log_info "Starting preview server..."
  pnpm start > /tmp/frontend-start.log 2>&1 &
  START_PID=$!

  if wait_for_server 3000 $TIMEOUT_MEDIUM; then
    log_success "Preview server started successfully"
    add_test_result "start" "PASS"
    passed_tests=$((passed_tests + 1))

    # Check if server responds to HTTP requests
    if curl -s http://localhost:3000 > /dev/null; then
      log_success "Server responds to HTTP requests"
    else
      log_warning "Server did not respond to HTTP requests"
    fi
  else
    log_error "Preview server failed to start"
    add_test_result "start" "FAIL"
  fi

  # Clean up
  kill $START_PID 2>/dev/null || true
  kill_port 3000
else
  log_warning "Skipping preview server test (interactive mode)"
fi

# Test 6: dev (development server)
if [ "$SKIP_INTERACTIVE" = false ]; then
  log_section "Test 6: Development Server (pnpm dev)"
  total_tests=$((total_tests + 1))

  # Clean up any existing process on port 3000
  kill_port 3000

  log_info "Starting development server with Turbopack..."
  pnpm dev > /tmp/frontend-dev.log 2>&1 &
  DEV_PID=$!

  if wait_for_server 3000 $TIMEOUT_LONG; then
    log_success "Development server started successfully"
    add_test_result "dev" "PASS"
    passed_tests=$((passed_tests + 1))

    # Check if server responds to HTTP requests
    if curl -s http://localhost:3000 > /dev/null; then
      log_success "Server responds to HTTP requests"
    else
      log_warning "Server did not respond to HTTP requests"
    fi
  else
    log_error "Development server failed to start"
    add_test_result "dev" "FAIL"
    cat /tmp/frontend-dev.log
  fi

  # Clean up
  kill $DEV_PID 2>/dev/null || true
  kill_port 3000
else
  log_warning "Skipping development server test (interactive mode)"
fi

# Test 7: dev:ssl (HTTPS development)
if [ "$SKIP_INTERACTIVE" = false ]; then
  log_section "Test 7: HTTPS Development Server (pnpm dev:ssl)"
  total_tests=$((total_tests + 1))

  # Check if SSL certificates exist
  if [ ! -f "localhost.pem" ] || [ ! -f "localhost-key.pem" ]; then
    log_warning "SSL certificates not found. Skipping HTTPS test."
    log_info "To generate certificates, run: mkcert localhost"
    add_test_result "dev:ssl" "SKIP"
  else
    # Clean up any existing processes
    kill_port 3000
    kill_port 3443

    log_info "Starting HTTPS development server..."
    pnpm dev:ssl > /tmp/frontend-dev-ssl.log 2>&1 &
    DEV_SSL_PID=$!

    # Wait for both HTTP and HTTPS servers
    http_ready=false
    https_ready=false

    if wait_for_server 3000 $TIMEOUT_LONG; then
      http_ready=true
      log_success "HTTP server (port 3000) is ready"
    fi

    if wait_for_server 3443 $TIMEOUT_MEDIUM "https"; then
      https_ready=true
      log_success "HTTPS proxy (port 3443) is ready"
    fi

    if [ "$http_ready" = true ] && [ "$https_ready" = true ]; then
      log_success "HTTPS development server started successfully"
      add_test_result "dev:ssl" "PASS"
      passed_tests=$((passed_tests + 1))

      # Verify HTTPS endpoint
      log_info "Verifying HTTPS endpoint..."
      if curl -sk https://localhost:3443 > /dev/null 2>&1; then
        log_success "HTTPS endpoint is accessible"
      else
        log_warning "HTTPS endpoint verification failed"
      fi

      # Check certificate (expect self-signed)
      log_info "Checking SSL certificate..."
      cert_info=$(echo | openssl s_client -connect localhost:3443 2>/dev/null | openssl x509 -noout -subject 2>/dev/null || echo "")
      if [ -n "$cert_info" ]; then
        log_success "SSL certificate: $cert_info"
      fi
    else
      log_error "HTTPS development server failed to start"
      add_test_result "dev:ssl" "FAIL"
      cat /tmp/frontend-dev-ssl.log
    fi

    # Clean up
    kill $DEV_SSL_PID 2>/dev/null || true
    kill_port 3000
    kill_port 3443
  fi
else
  log_warning "Skipping HTTPS development server test (interactive mode)"
fi

# Test 8: clean
log_section "Test 8: Clean (pnpm clean)"
total_tests=$((total_tests + 1))

log_info "Running clean command..."
if pnpm clean; then
  log_success "Clean command executed successfully"
  add_test_result "clean" "PASS"
  passed_tests=$((passed_tests + 1))

  # Verify cleanup
  if [ ! -d ".next" ]; then
    log_success "Build artifacts removed"
  else
    log_warning "Build artifacts still exist after clean"
  fi
else
  log_error "Clean command failed"
  add_test_result "clean" "FAIL"
fi

# Test Summary
log_section "Test Summary"

echo ""
echo "Individual Test Results:"
echo "------------------------"

# Process results using the helper functions
IFS='|'
idx=0
for test_name in $test_results_names; do
  if [ -z "$test_name" ]; then
    continue
  fi

  # Get corresponding result value
  i=0
  for result in $test_results_values; do
    if [ $i -eq $idx ]; then
      case $result in
        PASS)
          echo -e "${GREEN}✓${NC} $test_name: ${GREEN}PASSED${NC}"
          ;;
        FAIL)
          echo -e "${RED}✗${NC} $test_name: ${RED}FAILED${NC}"
          ;;
        SKIP)
          echo -e "${YELLOW}○${NC} $test_name: ${YELLOW}SKIPPED${NC}"
          ;;
      esac
      break
    fi
    i=$((i + 1))
  done
  idx=$((idx + 1))
done

echo ""
echo "Overall Results:"
echo "----------------"
echo "Total Tests: $total_tests"
echo "Passed: $passed_tests"
echo "Failed: $((total_tests - passed_tests))"

if [ $passed_tests -eq $total_tests ]; then
  log_success "All tests passed! 🎉"
  exit 0
else
  log_error "Some tests failed. Please review the output above."
  exit 1
fi
