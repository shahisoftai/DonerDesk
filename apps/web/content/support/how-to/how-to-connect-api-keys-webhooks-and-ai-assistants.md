# Connect API keys, webhooks and AI assistants

For administrators. **Settings → Integrations.**

## API keys

1. Under **Create a key**, give it a name ("What will use it", for example Power BI), choose its scopes (**The list of projects**, **Indicator values, by period**, **Results by place**), then choose **Create key**.
2. Choose which projects it may see (all, or only the ones you pick), and whether it expires (30, 90, 365 days or never).
3. Copy the key when it is shown. It is not shown again. Revoke a key you no longer use.

A key reads only what its scopes and projects allow. It cannot change anything and never gets finance.

## Webhooks

Under **Webhooks**, choose **Add webhook**, give an https address that the other system can receive on, and choose the events. DonorDesk sends an id and a status, never report text. Each request is signed; check the `x-donordesk-signature` header against the signing secret shown once. An address that keeps failing is switched off, and the reason is shown.

## AI assistants (MCP)

Give the assistant this address: `https://donordesk.online/api/v1/mcp`, and one of your keys as its bearer token. It can list projects, read indicator values and read results by place. It cannot see finance, and it can only read what the key allows.
