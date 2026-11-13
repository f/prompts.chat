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

describe('Markdown link preservation', () => {
  it('should preserve inline Markdown links', () => {
    expect(convertAllVariables('See the [documentation](https://example.com) for details.')).toBe('See the [documentation](https://example.com) for details.');
  });

  it('should preserve Markdown images', () => {
    expect(convertAllVariables('![Screenshot](https://example.com/a.png)')).toBe('![Screenshot](https://example.com/a.png)');
  });

  it('should preserve full and collapsed reference links', () => {
    expect(convertAllVariables('Read [the guide][guide] and [Docs][].\n\n[guide]: https://example.com/guide')).toBe('Read [the guide][guide] and [Docs][].\n\n[guide]: https://example.com/guide');
  });

  it('should preserve shortcut reference links with a definition', () => {
    expect(convertAllVariables('Check [Docs] first.\n\n[Docs]: https://example.com')).toBe('Check [Docs] first.\n\n[Docs]: https://example.com');
  });

  it('should convert placeholders mixed with Markdown links', () => {
    expect(convertAllVariables('Hi [USERNAME], read the [documentation](https://example.com) and [Your Name].')).toBe('Hi ${username}, read the [documentation](https://example.com) and ${your_name}.');
  });

  it('should still convert bracket placeholders followed by a space and parenthesis', () => {
    expect(convertAllVariables('Hello [NAME] (optional)')).toBe('Hello ${name} (optional)');
  });

  it("should convert a single-bracket placeholder right after a double-bracket one", () => {
    expect(convertAllVariables("[[FIRST]][LAST]")).toBe("${first}${last}");
  });

  it("should match shortcut reference labels with collapsed internal whitespace", () => {
    expect(convertAllVariables("Read [My Docs].\n\n[My  Docs]: https://example.com")).toBe("Read [My Docs].\n\n[My  Docs]: https://example.com");
  });

  it('should not detect Markdown link text as a variable', () => {
    expect(detectVariables('[documentation](https://example.com)')).toHaveLength(0);
  });
});
