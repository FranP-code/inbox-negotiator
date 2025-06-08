/**
 * Email Variables Utility Module
 * 
 * This module provides functions for handling email template variables:
 * - Extracting variables from text in {{ variable }} format
 * - Replacing variables with their values
 * - Loading and saving variables from/to the database
 * - Processing complete email templates
 */

import { supabase } from "./supabase";

export interface VariableProcessingResult {
  processedSubject: string;
  processedBody: string;
  hasUnfilledVariables: boolean;
  unfilledVariables: string[];
}

/**
 * Extract variables from text in {{ variable }} format
 * @param text - The text to extract variables from
 * @returns Array of unique variable names found in the text
 */
export function extractVariables(text: string): string[] {
  const variableRegex = /\{\{\s*([^}]+)\s*\}\}/g;
  const matches: string[] = [];
  let match;
  
  while ((match = variableRegex.exec(text)) !== null) {
    const variableName = match[1].trim();
    if (!matches.includes(variableName)) {
      matches.push(variableName);
    }
  }
  
  return matches;
}

/**
 * Replace variables in text with their values
 * @param text - The text containing variable placeholders
 * @param variables - Object mapping variable names to their values
 * @returns Text with variables replaced by their values
 */
export function replaceVariables(
  text: string,
  variables: Record<string, string>
): string {
  let result = text;
  
  Object.entries(variables).forEach(([key, value]) => {
    // Escape special regex characters in the variable name
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\{\\{\\s*${escapedKey}\\s*\\}\\}`, "g");
    result = result.replace(regex, value);
  });
  
  return result;
}

/**
 * Load variables from database for a specific debt
 * @param debtId - The ID of the debt record
 * @returns Object mapping variable names to their values
 */
export async function loadVariablesFromDatabase(
  debtId: string
): Promise<Record<string, string>> {
  try {
    const { data: dbVariables, error } = await supabase
      .from("debt_variables")
      .select("variable_name, variable_value")
      .eq("debt_id", debtId);

    if (error) {
      console.error("Error loading variables from database:", error);
      throw error;
    }

    const loadedVariables: Record<string, string> = {};
    dbVariables?.forEach((dbVar) => {
      loadedVariables[dbVar.variable_name] = dbVar.variable_value || "";
    });

    return loadedVariables;
  } catch (error) {
    console.error("Error in loadVariablesFromDatabase:", error);
    return {};
  }
}

/**
 * Save variables to database for a specific debt
 * @param debtId - The ID of the debt record
 * @param variables - Object mapping variable names to their values
 */
export async function saveVariablesToDatabase(
  debtId: string,
  variables: Record<string, string>
): Promise<void> {
  try {
    // First, delete existing variables for this debt
    const { error: deleteError } = await supabase
      .from("debt_variables")
      .delete()
      .eq("debt_id", debtId);

    if (deleteError) {
      console.error("Error deleting existing variables:", deleteError);
      throw deleteError;
    }

    // Then insert new variables
    const variableRecords = Object.entries(variables).map(([name, value]) => ({
      debt_id: debtId,
      variable_name: name,
      variable_value: value,
    }));

    if (variableRecords.length > 0) {
      const { error: insertError } = await supabase
        .from("debt_variables")
        .insert(variableRecords);

      if (insertError) {
        console.error("Error inserting variables:", insertError);
        throw insertError;
      }
    }
  } catch (error) {
    console.error("Error in saveVariablesToDatabase:", error);
    throw error;
  }
}

/**
 * Process email template by extracting variables, loading values, and replacing placeholders
 * @param debtId - The ID of the debt record
 * @param subject - The email subject template
 * @param body - The email body template
 * @returns Object containing processed subject/body and unfilled variable information
 */
export async function processEmailTemplate(
  debtId: string,
  subject: string,
  body: string
): Promise<VariableProcessingResult> {
  try {
    // Extract all variables from subject and body
    const allText = `${subject} ${body}`;
    const extractedVars = extractVariables(allText);
    
    // Load saved variables from database
    const savedVariables = await loadVariablesFromDatabase(debtId);
    
    // Check which variables don't have values
    const unfilledVariables = extractedVars.filter(
      variable => !savedVariables[variable] || savedVariables[variable].trim() === ""
    );
    
    const hasUnfilledVariables = unfilledVariables.length > 0;
    
    // Replace variables in subject and body
    const processedSubject = replaceVariables(subject, savedVariables);
    const processedBody = replaceVariables(body, savedVariables);
    
    return {
      processedSubject,
      processedBody,
      hasUnfilledVariables,
      unfilledVariables,
    };
  } catch (error) {
    console.error("Error in processEmailTemplate:", error);
    throw error;
  }
}

/**
 * Get all variables from subject and body text, merging with saved values
 * @param debtId - The ID of the debt record
 * @param subject - The email subject template
 * @param body - The email body template
 * @returns Object mapping variable names to their values (empty string if not saved)
 */
export async function getVariablesForTemplate(
  debtId: string,
  subject: string,
  body: string
): Promise<Record<string, string>> {
  try {
    // Extract variables from both subject and body
    const allText = `${subject} ${body}`;
    const extractedVars = extractVariables(allText);
    
    // Load saved variables from database
    const savedVariables = await loadVariablesFromDatabase(debtId);
    
    // Merge extracted variables with saved values
    const variables: Record<string, string> = {};
    extractedVars.forEach((variable) => {
      variables[variable] = savedVariables[variable] || "";
    });
    
    return variables;
  } catch (error) {
    console.error("Error in getVariablesForTemplate:", error);
    return {};
  }
}

/**
 * Update variables when template text changes
 * @param currentVariables - Current variable values
 * @param newText - New template text
 * @param otherText - Other template text (e.g., if updating body, pass subject here)
 * @returns Updated variables object
 */
export function updateVariablesForTextChange(
  currentVariables: Record<string, string>,
  newText: string,
  otherText: string = ""
): Record<string, string> {
  // Extract variables from the new text and other text
  const allText = `${newText} ${otherText}`;
  const newVariables = extractVariables(allText);
  const updatedVariables = { ...currentVariables };
  
  // Add new variables if they don't exist
  newVariables.forEach((variable) => {
    if (!(variable in updatedVariables)) {
      updatedVariables[variable] = "";
    }
  });
  
  // Remove variables that no longer exist in any text
  Object.keys(updatedVariables).forEach((variable) => {
    if (!newVariables.includes(variable)) {
      delete updatedVariables[variable];
    }
  });
  
  return updatedVariables;
}
