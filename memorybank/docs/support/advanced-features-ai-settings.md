# Advanced: Configuring AI Model Settings

Your organisation's AI model can be configured by an admin. This allows you to choose which AI provider DonorDesk uses for report generation.

## Accessing AI Settings

Only users with Admin or Owner role can access AI settings.

1. Click your name → **Settings**
2. Click **AI Settings**

## Available AI Models

| Model | Provider | Best for |
|-------|---------|---------|
| **MiniMax** | MiniMax | Default — reliable, good for most workloads |
| **DeepSeek** | DeepSeek | Alternative — sometimes better for technical content |

## How to Change the AI Model

1. Go to **Settings → AI Settings**
2. Under **Active Model**, select the model you want to use
3. Click **Save**

The change applies to all future AI generations.

## Understanding Prompt Versioning

Each time DonorDesk generates a report, it uses a specific "prompt version." This tracks which version of the AI instructions was used, so outputs can be compared fairly over time.

You can see the prompt version in:
- The report section detail panel
- The AI generation history

## Setting Output Quality

Some models allow you to choose the level of detail in AI outputs:

| Setting | What it does |
|---------|-------------|
| **Standard** | Balanced output, reasonable length |
| **Detailed** | More comprehensive output, longer generation time |
| **Concise** | Shorter output, faster generation |

## AI Timeout Settings

If generation often times out on your connection, you can increase the timeout:

1. Go to **Settings → AI Settings**
2. Find **Generation Timeout**
3. Increase from the default (60 seconds) to 90 or 120 seconds
4. Save

## Monitoring AI Usage

To see AI usage statistics:
1. Go to **Settings → AI Settings**
2. Look at **Usage Statistics**

You will see:
- Total generations this month
- Average generation time
- Error rate
- Credits used

## Troubleshooting AI Configuration

### "AI model not responding"

1. Try switching to a different model
2. Check your internet connection
3. Wait and try again later
4. If the issue persists, contact support

### "Generation is slow"

1. Try during off-peak hours
2. Use a shorter prompt (less data for the AI to process)
3. Generate sections one at a time instead of all at once
4. Increase timeout in settings

## Prompt Engineering Tips

To get better AI outputs:

1. **Keep indicator names descriptive** — "Number of women receiving 4+ ANC visits" produces better text than "OUT-1"
2. **Write good activity narratives** — Include achievements, numbers, and challenges
3. **Fill in comments** — Comments on indicator updates give AI valuable context
4. **Use evidence titles** — Give files descriptive names — AI uses titles for context
