# AI-Enhanced Debt Parsing Update

## Changes Made

### 1. Postmark Endpoint Enhancement (`src/pages/api/postmark.ts`)

The Postmark webhook endpoint has been enhanced to use Vercel's AI package with Google's Gemini model for intelligent debt parsing.

#### Key Improvements:
- **AI-Powered Parsing**: Replaced regex-based amount extraction with Gemini 1.5 Flash model
- **Enhanced Data Extraction**: Now extracts:
  - Debt amount (more accurate than regex)
  - Vendor/creditor name
  - Description of what the debt is for
  - Due date (if mentioned)
  - Whether it's a legitimate debt collection notice

#### Fallback Mechanism:
- If AI parsing fails or API key is not configured, falls back to original regex parsing
- Ensures system reliability even if AI service is unavailable

### 2. Database Schema Updates

Added new columns to the `debts` table:
- `description` (text) - AI-extracted description
- `due_date` (timestamptz) - Extracted due date
- `metadata` (jsonb) - Additional AI-extracted information

### 3. Dependencies Added

```bash
npm install ai @ai-sdk/google
```

### 4. Environment Variables Required

Add to your `.env` file:
```bash
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## How to Get Google API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create a new API key
3. Add it to your environment variables as `GOOGLE_GENERATIVE_AI_API_KEY`

## Testing the Changes

### 1. Test Email Processing
Send a test email to your Postmark webhook endpoint with debt-related content like:
```
Subject: Outstanding Balance Notice

Dear Customer,

You have an outstanding balance of $150.00 for your account with XYZ Collections.
This amount is due by January 15, 2025.

Please contact us to arrange payment.
```

### 2. Expected Database Entry
The system should now create a debt record with:
- `amount`: 150.00
- `vendor`: sender's email
- `description`: AI-generated description
- `due_date`: 2025-01-15 (if extracted)
- `metadata`: JSON with isDebtCollection flag and other details

### 3. Migration Application
If using local Supabase, apply the migration:
```bash
supabase db reset
# or
supabase migration up
```

For production, apply the migration found in:
`supabase/migrations/20250607000500_add_ai_parsing_columns.sql`

## Benefits

1. **More Accurate Parsing**: AI can understand context better than regex
2. **Richer Data**: Extracts more information from emails
3. **Better Classification**: Determines if email is actually a debt collection notice
4. **Future-Proof**: Can be enhanced with more sophisticated AI models
5. **Reliable Fallback**: Still works if AI service is unavailable

## Next Steps

1. Set up Google API key
2. Apply database migration
3. Test with sample debt collection emails
4. Monitor logs for AI parsing accuracy
5. Consider training on domain-specific examples for better accuracy
