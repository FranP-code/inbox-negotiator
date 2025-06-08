/**
 * Test file for email variables utility functions
 * This file contains unit tests to verify the modular variable processing logic
 */

import { describe, it, expect } from 'vitest';
import { 
  extractVariables, 
  replaceVariables, 
  updateVariablesForTextChange 
} from './emailVariables';

describe('Email Variables Utility Functions', () => {
  describe('extractVariables', () => {
    it('should extract variables from text with {{ }} format', () => {
      const text = 'Hello {{ name }}, your balance is {{ amount }}.';
      const result = extractVariables(text);
      expect(result).toEqual(['name', 'amount']);
    });

    it('should handle variables with extra spaces', () => {
      const text = 'Hello {{  name  }}, your balance is {{amount}}.';
      const result = extractVariables(text);
      expect(result).toEqual(['name', 'amount']);
    });

    it('should return unique variables only', () => {
      const text = 'Hello {{ name }}, {{ name }} owes {{ amount }}.';
      const result = extractVariables(text);
      expect(result).toEqual(['name', 'amount']);
    });

    it('should return empty array for text without variables', () => {
      const text = 'Hello there, no variables here.';
      const result = extractVariables(text);
      expect(result).toEqual([]);
    });

    it('should handle empty text', () => {
      const text = '';
      const result = extractVariables(text);
      expect(result).toEqual([]);
    });
  });

  describe('replaceVariables', () => {
    it('should replace variables with their values', () => {
      const text = 'Hello {{ name }}, your balance is {{ amount }}.';
      const variables = { name: 'John', amount: '$500' };
      const result = replaceVariables(text, variables);
      expect(result).toBe('Hello John, your balance is $500.');
    });

    it('should handle variables with extra spaces', () => {
      const text = 'Hello {{  name  }}, your balance is {{ amount }}.';
      const variables = { name: 'John', amount: '$500' };
      const result = replaceVariables(text, variables);
      expect(result).toBe('Hello John, your balance is $500.');
    });

    it('should leave unreplaced variables as-is when no value provided', () => {
      const text = 'Hello {{ name }}, your balance is {{ amount }}.';
      const variables = { name: 'John' };
      const result = replaceVariables(text, variables);
      expect(result).toBe('Hello John, your balance is {{ amount }}.');
    });

    it('should handle special characters in variable names', () => {
      const text = 'Hello {{ user-name }}, your balance is {{ total_amount }}.';
      const variables = { 'user-name': 'John', 'total_amount': '$500' };
      const result = replaceVariables(text, variables);
      expect(result).toBe('Hello John, your balance is $500.');
    });

    it('should handle empty variables object', () => {
      const text = 'Hello {{ name }}, your balance is {{ amount }}.';
      const variables = {};
      const result = replaceVariables(text, variables);
      expect(result).toBe('Hello {{ name }}, your balance is {{ amount }}.');
    });
  });

  describe('updateVariablesForTextChange', () => {
    it('should add new variables from text', () => {
      const currentVariables = { name: 'John' };
      const newText = 'Hello {{ name }}, your balance is {{ amount }}.';
      const otherText = '';
      const result = updateVariablesForTextChange(currentVariables, newText, otherText);
      expect(result).toEqual({ name: 'John', amount: '' });
    });

    it('should remove variables not present in any text', () => {
      const currentVariables = { name: 'John', amount: '$500', oldVar: 'value' };
      const newText = 'Hello {{ name }}, your balance is {{ amount }}.';
      const otherText = '';
      const result = updateVariablesForTextChange(currentVariables, newText, otherText);
      expect(result).toEqual({ name: 'John', amount: '$500' });
    });

    it('should preserve variables present in other text', () => {
      const currentVariables = { name: 'John', amount: '$500', subject: 'Payment' };
      const newText = 'Hello {{ name }}, your balance is {{ amount }}.';
      const otherText = 'Subject: {{ subject }}';
      const result = updateVariablesForTextChange(currentVariables, newText, otherText);
      expect(result).toEqual({ name: 'John', amount: '$500', subject: 'Payment' });
    });

    it('should handle empty current variables', () => {
      const currentVariables = {};
      const newText = 'Hello {{ name }}, your balance is {{ amount }}.';
      const otherText = '';
      const result = updateVariablesForTextChange(currentVariables, newText, otherText);
      expect(result).toEqual({ name: '', amount: '' });
    });

    it('should handle empty new text', () => {
      const currentVariables = { name: 'John', amount: '$500' };
      const newText = '';
      const otherText = '';
      const result = updateVariablesForTextChange(currentVariables, newText, otherText);
      expect(result).toEqual({});
    });
  });
});
