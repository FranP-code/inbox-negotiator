# Inbox Negotiator

An AI-powered system that automatically negotiates debt collections and billing disputes through email processing.

## Features

- **AI Email Processing**: Automatically parses incoming emails to extract debt information using Google's Gemini AI
- **Automated Negotiation**: Triggers negotiation workflows for legitimate debt collection notices
- **Webhook Integration**: Seamlessly processes emails through Postmark webhook integration
- **Secure Database Operations**: Uses Appwrite's document-level permissions for secure data access

## Environment Setup

Copy `.env.example` to `.env` and configure the following variables:

```bash
# Appwrite Configuration
PUBLIC_APPWRITE_ENDPOINT=your_appwrite_endpoint_here
PUBLIC_APPWRITE_PROJECT_ID=your_appwrite_project_id_here
PUBLIC_APPWRITE_DATABASE_ID=your_appwrite_database_id_here
APPWRITE_API_KEY=your_appwrite_api_key_here

# Google Generative AI API Key for Gemini model
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here
```

### Required Environment Variables

- `PUBLIC_APPWRITE_ENDPOINT`: Your Appwrite instance endpoint (e.g., https://cloud.appwrite.io/v1)
- `PUBLIC_APPWRITE_PROJECT_ID`: Appwrite project ID
- `PUBLIC_APPWRITE_DATABASE_ID`: Appwrite database ID for the application
- `APPWRITE_API_KEY`: Appwrite API key for server-side operations (webhooks, functions)
- `GOOGLE_GENERATIVE_AI_API_KEY`: Google API key for AI processing

## Migration from Supabase

This application has been migrated from Supabase to Appwrite. Key changes include:

- **Authentication**: Migrated from Supabase Auth to Appwrite Account API
- **Database**: Moved from Supabase tables to Appwrite collections
- **Functions**: Migrated from Supabase Edge Functions to Appwrite Functions
- **Real-time**: Updated from Supabase channels to Appwrite real-time subscriptions

For detailed migration notes, see [APPWRITE_MIGRATION.md](./APPWRITE_MIGRATION.md).

## Webhook Configuration

The `/api/postmark` endpoint handles incoming email webhooks from Postmark. It:

1. Validates incoming email data
2. Processes opt-out requests
3. Uses AI to extract debt information
4. Stores processed data in Appwrite
5. Triggers automated negotiation workflows

### Security Handling

The webhook uses an Appwrite admin client with API key authentication, ensuring server-side operations can write to the database without user authentication. This is essential for webhook operations where no user session exists.

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Deployment

Ensure all environment variables are configured in your deployment environment, especially the `APPWRITE_API_KEY` which is critical for webhook operations.
