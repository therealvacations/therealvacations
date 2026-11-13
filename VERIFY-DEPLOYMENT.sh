#!/usr/bin/env bash

# Verify the live security headers, basic page response, and DNS records.
# Usage: bash VERIFY-DEPLOYMENT.sh

failures=0

pass() {
  printf 'PASS: %s\n' "$1"
}

fail() {
  printf 'FAIL: %s\n' "$1"
  failures=$((failures + 1))
}

check_header() {
  local url="$1"
  local header="$2"
  local label="$3"
  local expected="${4:-}"
  local response value

  response=$(curl -sSI -L --max-time 30 "$url" 2>/dev/null) || {
    fail "$label — request failed: $url"
    return
  }

  value=$(printf '%s\n' "$response" |
    grep -i "^${header}:" |
    tail -n 1 |
    cut -d ':' -f 2- |
    tr -d '\r')

  if [[ -z "$value" ]]; then
    fail "$label — missing $header on $url"
  elif [[ -n "$expected" ]] && ! printf '%s' "$value" | grep -qiF "$expected"; then
    fail "$label — $header does not contain '$expected' on $url (got: $value)"
  else
    pass "$label"
  fi
}

check_dns() {
  local host="$1"
  local result=""

  if command -v dig >/dev/null 2>&1; then
    result=$( {
      dig +short "$host" A
      dig +short "$host" AAAA
      dig +short "$host" CNAME
    } 2>/dev/null)
  elif command -v nslookup >/dev/null 2>&1; then
    result=$(nslookup "$host" 2>/dev/null |
      awk '/^Name:/{found=1} found && /Address:|canonical name/{print}')
  else
    fail "$host resolves — neither dig nor nslookup is installed"
    return
  fi

  if [[ -n "$result" ]]; then
    pass "$host resolves"
  else
    fail "$host resolves"
  fi
}

check_zoho_mx() {
  local result=""

  if command -v dig >/dev/null 2>&1; then
    result=$(dig +short MX therealvacations.com 2>/dev/null)
  elif command -v nslookup >/dev/null 2>&1; then
    result=$(nslookup -type=MX therealvacations.com 2>/dev/null |
      awk '/mail exchanger =/{print}')
  else
    fail "MX records point to Zoho — neither dig nor nslookup is installed"
    return
  fi

  if printf '%s\n' "$result" | grep -qi 'zoho'; then
    pass "MX records point to Zoho"
  else
    fail "MX records point to Zoho (records found: ${result:-none})"
  fi
}

printf '%s\n' 'Checking security headers...'
for host in therealvacations.com www.therealvacations.com; do
  check_header "https://${host}" "Strict-Transport-Security" "${host}: HSTS"
  check_header "https://${host}" "X-Content-Type-Options" "${host}: X-Content-Type-Options"
  check_header "https://${host}" "X-Frame-Options" "${host}: X-Frame-Options"
  check_header "https://${host}" "Referrer-Policy" "${host}: Referrer-Policy"
  check_header "https://${host}" "Permissions-Policy" "${host}: Permissions-Policy"
done

printf '\n%s\n' 'Checking sensitive-path cache headers...'
check_header "https://therealvacations.com/login" \
  "Cache-Control" "/login: Cache-Control no-store" "no-store"
check_header "https://therealvacations.com/payment-result" \
  "Cache-Control" "/payment-result: Cache-Control no-store" "no-store"

printf '\n%s\n' 'Checking homepage response for Supabase reference...'
homepage=$(curl -sL --max-time 30 https://therealvacations.com 2>/dev/null)
if [[ $? -eq 0 ]] && printf '%s' "$homepage" | grep -qi 'supabase'; then
  pass "homepage contains a Supabase reference"
else
  fail "homepage contains a Supabase reference"
fi

printf '\n%s\n' 'Checking DNS...'
check_dns "pay.therealvacations.com"
check_dns "experience.therealvacations.com"
check_dns "flights.therealvacations.com"
check_zoho_mx

printf '\n'
if (( failures == 0 )); then
  printf '%s\n' 'All checks passed.'
  exit 0
else
  printf 'Checks failed: %d\n' "$failures"
  exit 1
fi
