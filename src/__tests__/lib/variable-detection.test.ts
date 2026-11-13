import { describe, it, expect } from "vitest";
import {
  detectVariables,
  convertToSupportedFormat,
  convertAllVariables,
  getPatternDescription,
  type DetectedVariable,
} from "@/lib/variable-detection";

describe("detectVariables", () => {
  describe("double bracket pattern [[...]]", () => {
    it("should detect [[name]] format", () => {
      const result = detectVariables("Hello [[name]]!");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("name");
      expect(result[0].pattern).toBe("double_bracket");
      expect(result[0].original).toBe("[[name]]");
    });

    it("should detect [[name]] with spaces", () => {
      const result = detectVariables("Hello [[ name ]]!");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("name");
      expect(result[0].original).toBe("[[ name ]]");
    });

    it("should detect [[name: default]] with default value", () => {
      const result = detectVariables("Hello [[name: John]]!");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("name");
      expect(result[0].defaultValue).toBe("John");
    });

    it("should detect multiple [[...]] variables", () => {
      const result = detectVariables("Hello [[first_name]] [[last_name]]!");
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("first_name");
      expect(result[1].name).toBe("last_name");
    });
  });

  describe("double curly pattern {{...}}", () => {
    it("should detect {{name}} format", () => {
      const result = detectVariables("Hello {{name}}!");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("name");
      expect(result[0].pattern).toBe("double_curly");
    });

    it("should detect {{name}} with spaces", () => {
      const result = detectVariables("Hello {{ name }}!");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("name");
    });

    it("should detect {{name: default}} with default value", () => {
      const result = detectVariables("Hello {{name: Jane}}!");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("name");
      expect(result[0].defaultValue).toBe("Jane");
    });
  });

  describe("single bracket pattern [...]", () => {
    it("should detect [NAME] uppercase format", () => {
      const result = detectVariables("Hello [NAME]!");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("NAME");
      expect(result[0].pattern).toBe("single_bracket");
    });

    it("should detect [Your Name] multi-word format", () => {
      const result = detectVariables("Hello [Your Name]!");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Your Name");
    });

    it("should detect [USER_ID] with underscores", () => {
      const result = detectVariables("ID: [USER_ID]");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("USER_ID");
    });
  });

  describe("single curly pattern {...}", () => {
    it("should detect {NAME} uppercase format", () => {
      const result = detectVariables("Hello {NAME}!");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("NAME");
      expect(result[0].pattern).toBe("single_curly");
    });

    it("should detect {USER_ID} with underscores", () => {
      const result = detectVariables("ID: {USER_ID}");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("USER_ID");
    });
  });

  describe("angle bracket pattern <...>", () => {
    it("should detect <NAME> uppercase format", () => {
      const result = detectVariables("Hello <NAME>!");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("NAME");
      expect(result[0].pattern).toBe("angle_bracket");
    });

    it("should detect <Your Name> with spaces", () => {
      const result = detectVariables("Hello <Your Name>!");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Your Name");
    });

    it("should NOT detect common HTML tags", () => {
      const result = detectVariables("<div>content</div>");
      expect(result).toHaveLength(0);
    });

    it("should NOT detect lowercase single words in angle brackets (looks like HTML tags)", () => {
      const result = detectVariables("<username>");
      expect(result).toHaveLength(0);
    });
  });

  describe("percent pattern %...%", () => {
    it("should detect %NAME% format", () => {
      const result = detectVariables("Hello %NAME%!");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("NAME");
      expect(result[0].pattern).toBe("percent");
    });

    it("should detect %user_name% lowercase with underscore", () => {
      const result = detectVariables("Hello %user_name%!");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("user_name");
    });
  });

  describe("dollar curly pattern ${...} (supported format)", () => {
    it("should NOT detect ${name} as it is the supported format", () => {
      const result = detectVariables("Hello ${name}!");
      expect(result).toHaveLength(0);
    });

    it("should NOT detect ${name:default} with default", () => {
      const result = detectVariables("Hello ${name:John}!");
      expect(result).toHaveLength(0);
    });
  });

  describe("false positive handling", () => {
    it("should skip HTML tags", () => {
      const htmlTags = [
        "<div>",
        "<span>",
        "<p>",
        "<a>",
        "<button>",
        "<input>",
        "<form>",
        "<table>",
      ];
      for (const tag of htmlTags) {
        const result = detectVariables(tag);
        expect(result).toHaveLength(0);
      }
    });

    it("should skip uppercase programming keywords in angle brackets", () => {
      // These would be in angle brackets but should be filtered as keywords
      const result = detectVariables("<IF> <ELSE> <FOR>");
      expect(result).toHaveLength(0);
    });

    it("should skip very short names", () => {
      const result = detectVariables("[[a]] {{b}}");
      expect(result).toHaveLength(0);
    });
  });

  describe("mixed patterns", () => {
    it("should detect multiple different patterns", () => {
      const text = "Hello [[name]], your ID is {{user_id}} and role is [ROLE]";
      const result = detectVariables(text);
      expect(result).toHaveLength(3);
      expect(result.map((v) => v.pattern)).toContain("double_bracket");
      expect(result.map((v) => v.pattern)).toContain("double_curly");
      expect(result.map((v) => v.pattern)).toContain("single_bracket");
    });

    it("should handle text with supported format mixed in", () => {
      const text = "Hello ${name}, welcome [[user]]!";
      const result = detectVariables(text);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("user");
    });
  });

  describe("position tracking", () => {
    it("should track start and end indices correctly", () => {
      const text = "Hello [[name]]!";
      const result = detectVariables(text);
      expect(result[0].startIndex).toBe(6);
      expect(result[0].endIndex).toBe(14);
      expect(text.slice(result[0].startIndex, result[0].endIndex)).toBe(
        "[[name]]"
      );
    });

    it("should sort results by position", () => {
      const text = "{{second}} first [[first]] text";
      const result = detectVariables(text);
      expect(result[0].startIndex).toBeLessThan(result[1].startIndex);
    });
  });
});

describe("convertToSupportedFormat", () => {
  it("should convert variable name to lowercase", () => {
    const variable: DetectedVariable = {
      original: "[[NAME]]",
      name: "NAME",
      pattern: "double_bracket",
      startIndex: 0,
      endIndex: 8,
    };
    expect(convertToSupportedFormat(variable)).toBe("${name}");
  });

  it("should replace spaces with underscores", () => {
    const variable: DetectedVariable = {
      original: "[[Your Name]]",
      name: "Your Name",
      pattern: "double_bracket",
      startIndex: 0,
      endIndex: 13,
    };
    expect(convertToSupportedFormat(variable)).toBe("${your_name}");
  });

  it("should include default value if present", () => {
    const variable: DetectedVariable = {
      original: "[[name: John]]",
      name: "name",
      defaultValue: "John",
      pattern: "double_bracket",
      startIndex: 0,
      endIndex: 14,
    };
    expect(convertToSupportedFormat(variable)).toBe("${name:John}");
  });

  it("should handle multiple spaces", () => {
    const variable: DetectedVariable = {
      original: "[[First Middle Last]]",
      name: "First Middle Last",
      pattern: "double_bracket",
      startIndex: 0,
      endIndex: 21,
    };
    expect(convertToSupportedFormat(variable)).toBe("${first_middle_last}");
  });

  it("should remove special characters", () => {
    const variable: DetectedVariable = {
      original: "[[user@name]]",
      name: "user@name",
      pattern: "double_bracket",
      startIndex: 0,
      endIndex: 13,
    };
    expect(convertToSupportedFormat(variable)).toBe("${username}");
  });

  it("should handle consecutive special characters", () => {
    const variable1: DetectedVariable = {
      original: "[[user@@name]]",
      name: "user@@name",
      pattern: "double_bracket",
      startIndex: 0,
      endIndex: 14,
    };
    expect(convertToSupportedFormat(variable1)).toBe("${username}");

    const variable2: DetectedVariable = {
      original: "[[user!@#name]]",
      name: "user!@#name",
      pattern: "double_bracket",
      startIndex: 0,
      endIndex: 15,
    };
    expect(convertToSupportedFormat(variable2)).toBe("${username}");
  });
});

describe("convertAllVariables", () => {
  it("should convert all detected variables in text", () => {
    const text = "Hello [[name]], your ID is {{user_id}}";
    const result = convertAllVariables(text);
    expect(result).toBe("Hello ${name}, your ID is ${user_id}");
  });

  it("should preserve text that has no variables", () => {
    const text = "Hello world, no variables here!";
    expect(convertAllVariables(text)).toBe(text);
  });

  it("should handle multiple variables of same pattern", () => {
    const text = "[[first]] and [[second]] and [[third]]";
    const result = convertAllVariables(text);
    expect(result).toBe("${first} and ${second} and ${third}");
  });

  it("should preserve already supported format", () => {
    const text = "Hello ${name}!";
    expect(convertAllVariables(text)).toBe(text);
  });

  it("should handle mixed supported and unsupported formats", () => {
    const text = "Hello ${name}, welcome [[user]]!";
    const result = convertAllVariables(text);
    expect(result).toBe("Hello ${name}, welcome ${user}!");
  });

  it("should convert with default values", () => {
    const text = "Hello [[name: World]]!";
    const result = convertAllVariables(text);
    expect(result).toBe("Hello ${name:World}!");
  });

  it("should handle variables at the start and end", () => {
    const text = "[[start]] middle [[end]]";
    const result = convertAllVariables(text);
    expect(result).toBe("${start} middle ${end}");
  });

  it("should handle adjacent variables", () => {
    const text = "[[first]][[second]]";
    const result = convertAllVariables(text);
    expect(result).toBe("${first}${second}");
  });
});

describe("getPatternDescription", () => {
  it("should return correct description for double_bracket", () => {
    expect(getPatternDescription("double_bracket")).toBe("[[...]]");
  });

  it("should return correct description for double_curly", () => {
    expect(getPatternDescription("double_curly")).toBe("{{...}}");
  });

  it("should return correct description for single_bracket", () => {
    expect(getPatternDescription("single_bracket")).toBe("[...]");
  });

  it("should return correct description for single_curly", () => {
    expect(getPatternDescription("single_curly")).toBe("{...}");
  });

  it("should return correct description for angle_bracket", () => {
    expect(getPatternDescription("angle_bracket")).toBe("<...>");
  });

  it("should return correct description for percent", () => {
    expect(getPatternDescription("percent")).toBe("%...%");
  });

  it("should return correct description for dollar_curly", () => {
    expect(getPatternDescription("dollar_curly")).toBe("${...}");
  });
});
