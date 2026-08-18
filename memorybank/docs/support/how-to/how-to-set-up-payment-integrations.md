# How to Set Up Payment Integrations

DonorDesk integrates with multiple payment providers, giving your donors flexibility while simplifying your financial operations.

## Supported Payment Providers

- **Stripe** — credit/debit cards, bank transfers
- **PayPal** — PayPal balance, linked bank
- **Creem** — donor-managed subscriptions (see 19-Tiers-And-Payments documentation)
- **Bank Transfer** — manual ACH/wire with reconciliation
- **Cheque** — offline tracking with deposit matching

## Connecting Stripe

1. Go to **Settings > Payment Integrations**
2. Click **Connect Stripe**
3. Authenticate with your Stripe account
4. Grant DonorDesk the required permissions
5. Configure webhook settings (handled automatically)
6. Select which payment methods to accept
7. Save settings

## Connecting PayPal

1. Go to **Settings > Payment Integrations**
2. Click **Connect PayPal**
3. Sign in to your PayPal Business account
4. Authorise the connection
5. Configure button appearance and checkout flow
6. Save settings

## Configuring Creem (Tiers & Payments)

If your organisation uses Creem for donor-managed subscriptions:
1. Go to **Settings > Payment Integrations > Creem**
2. Enter your Creem API key
3. Map DonorDesk tiers to Creem products
4. Enable sync for donor records
5. Test the connection with a small transaction

See the 19-Tiers-And-Payments documentation for full setup details.

## Payment Method Display

You control which payment methods appear on your donation forms:
- Go to **Settings > Donation Forms**
- Toggle methods on/off
- Reorder to prioritise preferred methods
- Customise button labels

## Disconnecting an Integration

To disconnect a payment provider:
1. Go to **Settings > Payment Integrations**
2. Click the provider name
3. Click **Disconnect**
4. Confirm the action

Active donations are not affected. Historical records remain intact.

For help with payment integrations, contact support@donordesk.online.
