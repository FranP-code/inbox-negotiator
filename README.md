# Inbox Negotiator

An AI-powered system that automatically negotiates debt collections and billing disputes through email processing.

## Features

- **AI Email Processing**: Automatically parses incoming emails to extract debt information using Google's Gemini AI
- **Automated Negotiation**: Triggers negotiation workflows for legitimate debt collection notices
- **Webhook Integration**: Seamlessly processes emails through Postmark webhook integration
- **Row Level Security**: Secure database operations with proper authentication handling

## Environment Setup

Copy `.env.example` to `.env` and configure the following variables:

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Google Generative AI API Key for Gemini model
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here
```

### Required Environment Variables

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key for client-side operations
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key for server-side operations (bypasses RLS)
- `GOOGLE_GENERATIVE_AI_API_KEY`: Google API key for AI processing

## Webhook Configuration

The `/api/postmark` endpoint handles incoming email webhooks from Postmark. It:

1. Validates incoming email data
2. Processes opt-out requests
3. Uses AI to extract debt information
4. Stores processed data in Supabase
5. Triggers automated negotiation workflows

### RLS (Row Level Security) Handling

The webhook uses a service role client to bypass RLS policies, ensuring server-side operations can write to the database without user authentication. This is essential for webhook operations where no user session exists.

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Deployment

Ensure all environment variables are configured in your deployment environment, especially the `SUPABASE_SERVICE_ROLE_KEY` which is critical for webhook operations.
