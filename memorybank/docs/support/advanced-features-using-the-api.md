# Advanced: Using the API

DonorDesk provides an API (Application Programming Interface) that allows developers to connect DonorDesk to other systems and automate workflows.

## What Is an API?

An API is a way for computers to talk to each other. With the DonorDesk API, you can:
- Pull data into your own systems
- Push data from other systems into DonorDesk
- Automate repetitive tasks
- Build custom integrations

## API Availability

| Plan | API Access |
|------|-----------|
| Starter | No |
| Team | No |
| Growth | No |
| Enterprise | Yes (custom) |

API access is available on Enterprise plans. Contact **support@donordesk.online** to discuss API access.

## API Concepts

### Endpoints

An API endpoint is a URL that provides access to a specific resource.

Example endpoints:

```
GET /v1/projects — List all projects
POST /v1/projects — Create a project
GET /v1/evidence — List evidence files
POST /v1/evidence — Upload evidence
```

### HTTP Methods

| Method | What it does |
|--------|-------------|
| GET | Read data |
| POST | Create new data |
| PATCH | Update existing data |
| DELETE | Delete data |

### Authentication

The API uses API keys for authentication:

```
Authorization: Bearer your_api_key_here
```

API keys are generated in **Settings → API** (for Enterprise plans).

## Common API Uses

### Pulling Data Into a Data Warehouse

```javascript
fetch('https://api.donordesk.online/v1/projects', {
  headers: {
    'Authorization': 'Bearer your_api_key',
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => console.log(data))
```

### Creating Projects Automatically

```javascript
fetch('https://api.donordesk.online/v1/projects', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_api_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'New Project',
    donor: 'UNICEF',
    startDate: '2026-01-01',
    endDate: '2026-12-31'
  })
})
```

## Rate Limits

API requests are rate-limited to prevent abuse:
- Standard: 100 requests per minute
- Enterprise: Custom limits based on contract

## Error Handling

### Common Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad request — check your data |
| 401 | Unauthorized — invalid API key |
| 403 | Forbidden — no permission |
| 404 | Not found — resource does not exist |
| 429 | Too many requests — slow down |
| 500 | Server error — contact support |

## Webhooks

Webhooks are automated messages sent when something happens in DonorDesk.

### Setting Up Webhooks

1. Go to **Settings → API → Webhooks**
2. Add your webhook URL
3. Choose which events to receive
4. Save

### Webhook Events

| Event | When triggered |
|-------|---------------|
| `project.created` | New project created |
| `report.submitted` | Report submitted for review |
| `report.approved` | Report approved |
| `evidence.uploaded` | New evidence uploaded |

## API Documentation

For full API documentation, contact **support@donordesk.online**. Enterprise customers receive detailed API documentation.
