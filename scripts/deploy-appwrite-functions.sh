#!/bin/bash

# Appwrite Functions Auto-Deploy Script
# This script migrates Supabase Edge Functions to Appwrite Functions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_FUNCTIONS_DIR="./supabase/functions"
APPWRITE_FUNCTIONS_DIR="./appwrite/functions"
APPWRITE_CONFIG="./appwrite/appwrite.json"

echo -e "${GREEN}🚀 Appwrite Functions Auto-Deploy Script${NC}"
echo "========================================"

# Check if Appwrite CLI is installed
if ! command -v appwrite &> /dev/null; then
    echo -e "${RED}❌ Appwrite CLI not found${NC}"
    echo "Please install it with: npm install -g appwrite-cli"
    exit 1
fi

# Check environment variables
if [ -z "$APPWRITE_PROJECT_ID" ]; then
    echo -e "${RED}❌ APPWRITE_PROJECT_ID environment variable not set${NC}"
    exit 1
fi

if [ -z "$APPWRITE_API_KEY" ]; then
    echo -e "${RED}❌ APPWRITE_API_KEY environment variable not set${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Environment Variables:${NC}"
echo "APPWRITE_PROJECT_ID: $APPWRITE_PROJECT_ID"
echo "APPWRITE_API_KEY: ${APPWRITE_API_KEY:0:8}..."
echo ""

# Initialize Appwrite project if not already done
echo -e "${YELLOW}🔧 Setting up Appwrite project...${NC}"
if [ ! -f ".appwrite/project.json" ]; then
    # If running in CI and API key + endpoint are provided, configure client non-interactively
    if [ -n "$APPWRITE_API_KEY" ] && [ -n "$APPWRITE_ENDPOINT" ]; then
        echo "Configuring Appwrite CLI in non-interactive mode..."
        appwrite client --endpoint "$APPWRITE_ENDPOINT" --project-id "$APPWRITE_PROJECT_ID" --key "$APPWRITE_API_KEY" || {
            echo -e "${RED}❌ Failed to configure Appwrite CLI non-interactively${NC}"
            exit 1
        }

        # Create minimal project.json so other commands expecting this file won't fail
        mkdir -p .appwrite
        cat > .appwrite/project.json << EOF
{
  "projectId": "$APPWRITE_PROJECT_ID",
  "endpoint": "$APPWRITE_ENDPOINT"
}
EOF
    else
        # Fallback to interactive init if no API key/endpoint provided
        appwrite init project --project-id "$APPWRITE_PROJECT_ID"
    fi
fi

# Create Appwrite functions directory if it doesn't exist
mkdir -p "$APPWRITE_FUNCTIONS_DIR"

# Function to convert Supabase function to Appwrite function
convert_function() {
    local func_name=$1
    local supabase_func_dir="$SUPABASE_FUNCTIONS_DIR/$func_name"
    local appwrite_func_dir="$APPWRITE_FUNCTIONS_DIR/$func_name"
    
    if [ ! -d "$supabase_func_dir" ]; then
        echo -e "${RED}❌ Supabase function '$func_name' not found${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}🔄 Converting function: $func_name${NC}"
    
    # Create Appwrite function directory
    mkdir -p "$appwrite_func_dir/src"
    
    # Copy and convert the main file
    if [ -f "$supabase_func_dir/index.ts" ]; then
        # Convert Supabase function to Appwrite function format
        cat > "$appwrite_func_dir/src/main.js" << 'EOF'
import { Client, Databases, Functions } from 'node-appwrite';

// This is a migrated function from Supabase to Appwrite
// Original Supabase function logic should be adapted here

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);
  
  try {
    // TODO: Migrate Supabase function logic here
    // Original file: ${supabase_func_dir}/index.ts
    
    log('Function executed successfully');
    return res.json({ success: true, message: 'Function migrated from Supabase' });
  } catch (err) {
    error('Function execution failed: ' + err.message);
    return res.json({ success: false, error: err.message }, 500);
  }
};
EOF
        
        # Create package.json for the function
        cat > "$appwrite_func_dir/package.json" << EOF
{
  "name": "$func_name",
  "version": "1.0.0",
  "description": "Migrated from Supabase Edge Function",
  "main": "src/main.js",
  "type": "module",
  "dependencies": {
    "node-appwrite": "^13.0.0"
  }
}
EOF
        
        # Create README with migration notes
        cat > "$appwrite_func_dir/README.md" << EOF
# $func_name Function

This function was migrated from Supabase Edge Functions to Appwrite Functions.

## Original Supabase Function
- Location: \`$supabase_func_dir/index.ts\`
- Migrated on: $(date)

## Migration Notes
- The function logic needs to be manually adapted from the original Supabase function
- Update environment variables and dependencies as needed
- Test thoroughly before deploying to production

## Deployment
\`\`\`bash
appwrite functions createDeployment --function-id=$func_name --activate=true
\`\`\`
EOF
        
        echo -e "${GREEN}✅ Function '$func_name' converted successfully${NC}"
    else
        echo -e "${RED}❌ No index.ts found for function '$func_name'${NC}"
        return 1
    fi
}

# Deploy function to Appwrite
deploy_function() {
    local func_name=$1
    local appwrite_func_dir="$APPWRITE_FUNCTIONS_DIR/$func_name"
    
    if [ ! -d "$appwrite_func_dir" ]; then
        echo -e "${RED}❌ Appwrite function '$func_name' not found${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}🚀 Deploying function: $func_name${NC}"
    
    # Create function if it doesn't exist
    appwrite functions create \
        --function-id="$func_name" \
        --name="$func_name" \
        --runtime="node-18.0" \
        --execute='["any"]' \
        --timeout=15 \
        --enabled=true || echo "Function may already exist, continuing..."
    
    # Deploy the function
    cd "$appwrite_func_dir"
    appwrite functions createDeployment \
        --function-id="$func_name" \
        --activate=true \
        --code="."
    cd - > /dev/null
    
    echo -e "${GREEN}✅ Function '$func_name' deployed successfully${NC}"
}

# Main execution
echo -e "${YELLOW}📋 Available Supabase functions:${NC}"
for func_dir in "$SUPABASE_FUNCTIONS_DIR"/*; do
    if [ -d "$func_dir" ]; then
        func_name=$(basename "$func_dir")
        echo "  - $func_name"
    fi
done
echo ""

# Convert functions
echo -e "${YELLOW}🔄 Converting Supabase functions to Appwrite format...${NC}"
for func_dir in "$SUPABASE_FUNCTIONS_DIR"/*; do
    if [ -d "$func_dir" ]; then
        func_name=$(basename "$func_dir")
        convert_function "$func_name"
    fi
done

echo ""
echo -e "${YELLOW}🚀 Deploying functions to Appwrite...${NC}"

# Ask for confirmation
read -p "Do you want to deploy all functions to Appwrite? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    for func_dir in "$APPWRITE_FUNCTIONS_DIR"/*; do
        if [ -d "$func_dir" ]; then
            func_name=$(basename "$func_dir")
            deploy_function "$func_name"
        fi
    done
    
    echo ""
    echo -e "${GREEN}🎉 All functions deployed successfully!${NC}"
    echo ""
    echo -e "${YELLOW}📝 Next steps:${NC}"
    echo "1. Update each function's logic in appwrite/functions/*/src/main.js"
    echo "2. Test functions in Appwrite console"
    echo "3. Update your application to use Appwrite function IDs"
    echo "4. Set up environment variables for each function"
else
    echo -e "${YELLOW}⏭️  Function deployment skipped${NC}"
    echo "You can deploy individual functions later using:"
    echo "  appwrite functions createDeployment --function-id=FUNCTION_NAME --activate=true"
fi

echo ""
echo -e "${GREEN}✨ Migration process completed!${NC}"