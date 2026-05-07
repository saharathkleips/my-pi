# Usage Limits Status Extension

A pi extension for showing subscription usage windows for supported providers.

```text
◷ 29% 7:13 AM • ㊊ 85% Mon
```

Full details available by using `/usage-limits`.

## Supported Providers

- `openai-codex`

## Implementation Details

- provider gate:
  - `isSupportedUsageProvider(...)`
- auth resolution:
  - `getProviderAuthToken(...)`
- fetch and normalization:
  - `fetchUsage(...)`
  - `normalizeOpenAiUsage(...)`
- UI formatting:
  - `formatStatusUsage(...)`
  - `formatUsageDetails(...)`
  - `formatResetTime(...)`
  - `formatWeekdaySymbol(...)`

Reset times are formatted for quick scanning rather than raw precision:

- If reset is within 24 hours, show local time like `4:31 PM`
- If reset is 1 to 6 days away, show weekday like `Mon`
- Otherwise, fall back to a compact local date/time format
- Invalid or missing timestamps display as `unknown`

## OpenAI Codex API

### Endpoint

```text
https://chatgpt.com/backend-api/wham/usage
```

### Request

```bash
curl 'https://chatgpt.com/backend-api/wham/usage' \
  -H 'accept: application/json' \
  -H "authorization: Bearer $TOKEN"
```

### Response

- returns `HTTP/2 200`
- returns `content-type: application/json`

```json
{
  "user_id": "...",
  "account_id": "...",
  "email": "...",
  "plan_type": "plus",
  "rate_limit": {
    "allowed": true,
    "limit_reached": false,
    "primary_window": {
      "used_percent": 3,
      "limit_window_seconds": 18000,
      "reset_after_seconds": 15122,
      "reset_at": 1778138035
    },
    "secondary_window": {
      "used_percent": 3,
      "limit_window_seconds": 604800,
      "reset_after_seconds": 37280,
      "reset_at": 1778160192
    }
  },
  "code_review_rate_limit": null,
  "additional_rate_limits": null,
  "credits": {
    "has_credits": false,
    "unlimited": false,
    "overage_limit_reached": false,
    "balance": "0",
    "approx_local_messages": [0, 0],
    "approx_cloud_messages": [0, 0]
  },
  "spend_control": {
    "reached": false,
    "individual_limit": null
  },
  "rate_limit_reached_type": null,
  "promo": null,
  "referral_beacon": null
}
```

### Fields currently used by the extension

Primary fields:

- `rate_limit.allowed`
- `rate_limit.limit_reached`
- `rate_limit.primary_window.used_percent`
- `rate_limit.primary_window.reset_after_seconds`
- `rate_limit.primary_window.reset_at`
- `rate_limit.secondary_window.used_percent`
- `rate_limit.secondary_window.reset_after_seconds`
- `rate_limit.secondary_window.reset_at`
- `rate_limit_reached_type`

Interpretation in the extension:

- `primary_window` -> short window
- `secondary_window` -> long window
