import { describe, it, expect } from 'vitest';
import {
  detectVariables,
  convertToSupportedFormat,
  convertAllVariables,
  normalize,
  detect,
  extractVariables,
  compile,
  getPatternDescription,
} from '../variables';

describe('variables module', () => {
  describe('detectVariables', () => {
    it('should detect double bracket variables', () => {
      const text = 'Hello [[name]], your age is [[age]]';
      const vars = detectVariables(text);
      expect(vars).toHaveLength(2);
      expect(vars.map(v => v.name)).toEqual(['name', 'age']);
    });

    it('should detect double curly variables', () => {
      const text = 'Hello {{name}}, your age is {{age}}';
      const vars = detectVariables(text);
      expect(vars).toHaveLength(2);
      expect(vars.map(v => v.name)).toEqual(['name', 'age']);
    });

    it('should detect single bracket uppercase variables', () => {
      const text = 'Hello [NAME], your [AGE] is here';
      const vars = detectVariables(text);
      expect(vars).toHaveLength(2);
      expect(vars.map(v => v.name)).toEqual(['NAME', 'AGE']);
    });

    it('should detect angle bracket variables', () => {
      const text = 'Hello <NAME>, your <AGE> is here';
      const vars = detectVariables(text);
      expect(vars).toHaveLength(2);
      expect(vars.map(v => v.name)).toEqual(['NAME', 'AGE']);
    });

    it('should detect percent variables', () => {
      const text = 'Hello %name%, your %age% is here';
      const vars = detectVariables(text);
      expect(vars).toHaveLength(2);
      expect(vars.map(v => v.name)).toEqual(['name', 'age']);
    });

    it('should detect variables with defaults', () => {
      const text = 'Hello [[name: World]]';
      const vars = detectVariables(text);
      expect(vars).toHaveLength(1);
      expect(vars[0].name).toBe('name');
      expect(vars[0].defaultValue).toBe('World');
    });

    it('should handle empty text', () => {
      const vars = detectVariables('');
      expect(vars).toHaveLength(0);
    });

    it('should not detect false positives like HTML tags', () => {
      const text = 'Use <div> and <span> tags';
      const vars = detectVariables(text);
      expect(vars).toHaveLength(0);
    });

    it('detect alias should work the same as detectVariables', () => {
      const text = 'Hello [[name]]';
      expect(detect(text)).toEqual(detectVariables(text));
    });
  });

  describe('convertToSupportedFormat', () => {
    it('should convert variable to ${name} format', () => {
      const variable = {
        original: '[[name]]',
        name: 'name',
        pattern: 'double_bracket' as const,
        startIndex: 0,
        endIndex: 8,
      };
      expect(convertToSupportedFormat(variable)).toBe('${name}');
    });

    it('should include default value if present', () => {
      const variable = {
        original: '[[name: World]]',
        name: 'name',
        defaultValue: 'World',
        pattern: 'double_bracket' as const,
        startIndex: 0,
        endIndex: 15,
      };
      expect(convertToSupportedFormat(variable)).toBe('${name:World}');
    });

    it('should normalize names with spaces to underscores', () => {
      const variable = {
        original: '[[User Name]]',
        name: 'User Name',
        pattern: 'double_bracket' as const,
        startIndex: 0,
        endIndex: 13,
      };
      expect(convertToSupportedFormat(variable)).toBe('${user_name}');
    });
  });

  describe('convertAllVariables / normalize', () => {
    it('should convert all variable formats to ${name}', () => {
      const text = 'Hello [[name]], {{age}}, [CITY]';
      const normalized = convertAllVariables(text);
      expect(normalized).toContain('${name}');
      expect(normalized).toContain('${age}');
      expect(normalized).toContain('${city}');
    });

    it('should preserve defaults in normalization', () => {
      const text = 'Hello [[name: World]]';
      const normalized = normalize(text);
      expect(normalized).toBe('Hello ${name:World}');
    });

    it('should handle text with no variables', () => {
      const text = 'Hello World';
      expect(convertAllVariables(text)).toBe('Hello World');
    });
  });

  describe('extractVariables', () => {
    it('should extract variables from ${var} format', () => {
      const text = 'Hello ${name}, you are ${age} years old';
      const vars = extractVariables(text);
      expect(vars).toHaveLength(2);
      expect(vars[0].name).toBe('name');
      expect(vars[1].name).toBe('age');
    });

    it('should extract default values', () => {
      const text = 'Hello ${name:World}';
      const vars = extractVariables(text);
      expect(vars).toHaveLength(1);
      expect(vars[0].name).toBe('name');
      expect(vars[0].defaultValue).toBe('World');
    });

    it('should return empty array for no variables', () => {
      const vars = extractVariables('Hello World');
      expect(vars).toHaveLength(0);
    });
  });

  describe('compile', () => {
    it('should replace variables with values', () => {
      const text = 'Hello ${name}, you are ${age} years old';
      const result = compile(text, { name: 'John', age: '30' });
      expect(result).toBe('Hello John, you are 30 years old');
    });

    it('should use default values when not provided', () => {
      const text = 'Hello ${name:World}';
      const result = compile(text, {});
      expect(result).toBe('Hello World');
    });

    it('should keep original when no value and useDefaults is false', () => {
      const text = 'Hello ${name:World}';
      const result = compile(text, {}, { useDefaults: false });
      expect(result).toBe('Hello ${name:World}');
    });

    it('should handle missing variables without defaults', () => {
      const text = 'Hello ${name}';
      const result = compile(text, {});
      expect(result).toBe('Hello ${name}');
    });
  });

  describe('getPatternDescription', () => {
    it('should return description for each pattern', () => {
      expect(getPatternDescription('double_bracket')).toBe('[[...]]');
      expect(getPatternDescription('double_curly')).toBe('{{...}}');
      expect(getPatternDescription('single_bracket')).toBe('[...]');
      expect(getPatternDescription('single_curly')).toBe('{...}');
      expect(getPatternDescription('angle_bracket')).toBe('<...>');
      expect(getPatternDescription('percent')).toBe('%...%');
      expect(getPatternDescription('dollar_curly')).toBe('${...}');
    });
  });
});
