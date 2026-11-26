import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import { type Prompt } from '../api.js';
import { extractVariables, compile } from '../../variables/index.js';
import { RunPrompt } from './RunPrompt.js';
import { type Platform } from '../platforms.js';
import { getBaseUrl } from '../config.js';

interface PromptDetailProps {
  prompt: Prompt;
  onBack: () => void;
  onCopy: (content: string) => void;
}

type ViewMode = 'detail' | 'variables' | 'copied' | 'run' | 'run-variables' | 'preview';

function HighlightedLine({ text }: { text: string }) {
  // Split by variable pattern ${...}
  const parts = text.split(/(\$\{[^}]+\})/g);
  
  return (
    <Text>
      {parts.map((part, i) => {
        if (part.match(/^\$\{[^}]+\}$/)) {
          return <Text key={i} color="yellow" bold>{part}</Text>;
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  const rawLines = text.split('\n');
  
  for (const rawLine of rawLines) {
    if (rawLine.length <= width) {
      lines.push(rawLine);
    } else {
      let remaining = rawLine;
      while (remaining.length > width) {
        let breakPoint = remaining.lastIndexOf(' ', width);
        if (breakPoint === -1 || breakPoint < width / 2) {
          breakPoint = width;
        }
        lines.push(remaining.slice(0, breakPoint));
        remaining = remaining.slice(breakPoint).trimStart();
      }
      if (remaining) {
        lines.push(remaining);
      }
    }
  }
  return lines;
}

export function PromptDetail({ prompt, onBack, onCopy }: PromptDetailProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [viewMode, setViewMode] = useState<ViewMode>('detail');
  const [variables, setVariables] = useState<Array<{ name: string; defaultValue?: string }>>([]);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [currentVarIndex, setCurrentVarIndex] = useState(0);
  const [currentInput, setCurrentInput] = useState('');
  const [compiledContent, setCompiledContent] = useState('');
  const [pendingPlatform, setPendingPlatform] = useState<Platform | null>(null);
  const [runAction, setRunAction] = useState<'copy' | 'run'>('run');
  const [scrollOffset, setScrollOffset] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

  const terminalHeight = stdout?.rows || 24;
  const terminalWidth = stdout?.columns || 80;
  const headerLines = 8;
  const footerLines = 2;
  const contentHeight = Math.max(terminalHeight - headerLines - footerLines, 5);

  useEffect(() => {
    const vars = extractVariables(prompt.content ?? '');
    setVariables(vars);
    
    const defaults: Record<string, string> = {};
    vars.forEach(v => {
      if (v.defaultValue) defaults[v.name] = v.defaultValue;
    });
    setVariableValues(defaults);
  }, [prompt]);

  const contentLines = useMemo(() => {
    if (!prompt) return [];
    // Parse escape sequences like \n
    const parsedContent = (prompt.content ?? '').replace(/\\n/g, '\n');
    return wrapText(parsedContent, terminalWidth - 6);
  }, [prompt, terminalWidth]);

  const maxScroll = Math.max(0, contentLines.length - contentHeight);

  const isMediaType = prompt?.type === 'IMAGE' || prompt?.type === 'VIDEO' || prompt?.type === 'AUDIO';
  const hasMedia = isMediaType && prompt?.mediaUrl;

  async function loadImagePreview() {
    if (!prompt?.mediaUrl || loadingImage) return;
    setLoadingImage(true);
    try {
      const terminalImage = await import('terminal-image');
      const response = await fetch(prompt.mediaUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      const image = await terminalImage.default.buffer(buffer, { 
        width: terminalWidth - 4,
        height: terminalHeight - 4,
        preserveAspectRatio: true 
      });
      setImagePreview(image);
      setViewMode('preview');
    } catch {
      setImagePreview('[Could not load image]');
    } finally {
      setLoadingImage(false);
    }
  }

  useInput((input: string, key: { escape?: boolean; return?: boolean; upArrow?: boolean; downArrow?: boolean; pageUp?: boolean; pageDown?: boolean }) => {
    if (viewMode === 'run' || viewMode === 'run-variables') {
      return; // RunPrompt handles its own input
    }

    if (viewMode === 'variables') {
      if (key.escape) {
        setViewMode('detail');
        setCurrentVarIndex(0);
        setCurrentInput('');
      }
      return;
    }

    if (viewMode === 'copied') {
      if (key.escape || input === 'b' || key.return) {
        setViewMode('detail');
      }
      return;
    }

    // Preview mode
    if (viewMode === 'preview') {
      if (key.escape || input === 'b') {
        setImagePreview(null);
        setViewMode('detail');
      }
      return;
    }

    // Scrolling with hjkl and arrow keys
    if (viewMode === 'detail') {
      if (input === 'j' || key.downArrow) {
        setScrollOffset(prev => Math.min(prev + 1, maxScroll));
        return;
      }
      if (input === 'k' || key.upArrow) {
        setScrollOffset(prev => Math.max(prev - 1, 0));
        return;
      }
      if (input === 'D' || key.pageDown) {
        setScrollOffset(prev => Math.min(prev + Math.floor(contentHeight / 2), maxScroll));
        return;
      }
      if (input === 'U' || key.pageUp) {
        setScrollOffset(prev => Math.max(prev - Math.floor(contentHeight / 2), 0));
        return;
      }
      if (input === 'g') {
        setScrollOffset(0);
        return;
      }
      if (input === 'G') {
        setScrollOffset(maxScroll);
        return;
      }
    }

    if (key.escape || input === 'b') {
      onBack();
      return;
    }

    if (input === 'q') {
      exit();
      return;
    }

    if (input === 'r' && prompt) {
      setScrollOffset(0);
      setViewMode('run');
      return;
    }

    if (input === 'c' && prompt) {
      if (variables.length > 0) {
        setViewMode('variables');
        setCurrentVarIndex(0);
        setCurrentInput(variableValues[variables[0].name] || '');
      } else {
        handleCopy(prompt.content ?? '');
      }
    }

    if (input === 'C' && prompt) {
      handleCopy(prompt.content ?? '');
    }

    if (input === 'o' && prompt) {
      import('open').then(({ default: open }) => {
        open(`${getBaseUrl()}/prompts/${prompt.id}_${prompt.slug}`);
      });
    }

    if (input === 'u' && prompt) {
      import('open').then(({ default: open }) => {
        open(`${getBaseUrl()}/@${prompt.author.username}`);
      });
    }

    if (input === 'p' && hasMedia) {
      loadImagePreview();
    }
  });

  function handleCopy(content: string) {
    onCopy(content);
    setCompiledContent(content);
    setViewMode('copied');
  }

  function handleRun(url: string, platform: Platform) {
    import('open').then(({ default: open }) => {
      open(url);
    });
    setViewMode('detail');
  }

  function handleCopyAndOpen(content: string, platform: Platform) {
    if (variables.length > 0) {
      setPendingPlatform(platform);
      setRunAction('copy');
      setViewMode('run-variables');
      setCurrentVarIndex(0);
      setCurrentInput(variableValues[variables[0].name] || '');
    } else {
      onCopy(content);
      import('open').then(({ default: open }) => {
        open(platform.baseUrl);
      });
      setViewMode('detail');
    }
  }

  function handleRunWithVariables(url: string, platform: Platform) {
    if (variables.length > 0) {
      setPendingPlatform(platform);
      setRunAction('run');
      setViewMode('run-variables');
      setCurrentVarIndex(0);
      setCurrentInput(variableValues[variables[0].name] || '');
    } else {
      handleRun(url, platform);
    }
  }

  function handleVariableSubmit(value: string) {
    const varName = variables[currentVarIndex].name;
    const newValues = { ...variableValues, [varName]: value };
    setVariableValues(newValues);

    if (currentVarIndex < variables.length - 1) {
      setCurrentVarIndex(currentVarIndex + 1);
      setCurrentInput(newValues[variables[currentVarIndex + 1].name] || '');
    } else {
      const compiled = compile(prompt!.content, newValues, { useDefaults: true });
      
      if (viewMode === 'run-variables' && pendingPlatform) {
        if (runAction === 'copy') {
          onCopy(compiled);
          import('open').then(({ default: open }) => {
            open(pendingPlatform.baseUrl);
          });
        } else {
          import('../platforms.js').then(({ buildUrl }) => {
            const url = buildUrl(pendingPlatform.id, pendingPlatform.baseUrl, compiled, prompt!.title, prompt!.description || undefined);
            import('open').then(({ default: open }) => {
              open(url);
            });
          });
        }
        setPendingPlatform(null);
        setViewMode('detail');
      } else {
        handleCopy(compiled);
      }
    }
  }

  const showCopiedMessage = viewMode === 'copied';

  // Fullscreen image preview
  if (viewMode === 'preview' && imagePreview) {
    return (
      <Box flexDirection="column" height={terminalHeight}>
        <Box paddingX={1} marginBottom={1}>
          <Text bold color="magenta">📷 Image Preview</Text>
          <Text dimColor> · {prompt.title}</Text>
        </Box>
        <Box flexDirection="column" flexGrow={1} paddingX={1}>
          <Text>{imagePreview}</Text>
        </Box>
        <Box paddingX={1}>
          <Text dimColor>b back</Text>
        </Box>
      </Box>
    );
  }

  if (viewMode === 'run') {
    return (
      <RunPrompt
        content={prompt.content}
        title={prompt.title}
        description={prompt.description || undefined}
        promptType={prompt.type}
        mediaUrl={prompt.mediaUrl}
        onRun={handleRunWithVariables}
        onCopyAndOpen={handleCopyAndOpen}
        onBack={() => setViewMode('detail')}
      />
    );
  }

  const isFillingVariables = viewMode === 'variables' || viewMode === 'run-variables';
  const isRunMode = viewMode === 'run-variables';
  const currentVar = isFillingVariables ? variables[currentVarIndex] : null;

  const tags = prompt.tags.map(t => t.name).join(', ');
  const inlineSectionHeight = isFillingVariables ? 3 : (showCopiedMessage ? 1 : 0);
  const adjustedContentHeight = contentHeight - inlineSectionHeight;
  const visibleLines = contentLines.slice(scrollOffset, scrollOffset + adjustedContentHeight);
  const adjustedMaxScroll = Math.max(0, contentLines.length - adjustedContentHeight);
  const showScrollIndicator = contentLines.length > adjustedContentHeight;
  const scrollPercent = adjustedMaxScroll > 0 ? Math.round((scrollOffset / adjustedMaxScroll) * 100) : 100;

  return (
    <Box flexDirection="column" height={terminalHeight}>
      {/* Header */}
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={0} flexDirection="column">
          <Text bold color="cyan">{prompt.title}</Text>
          <Box>
            <Text dimColor>by </Text>
            <Text color="yellow">@{prompt.author.username}</Text>
            {prompt.author.verified && <Text color="blue"> ✓</Text>}
            <Text dimColor> · </Text>
            <Text color="green">⬆ {prompt.voteCount}</Text>
            {prompt.category && (
              <>
                <Text dimColor> · </Text>
                <Text color="magenta">{prompt.category.name}</Text>
              </>
            )}
          </Box>
        </Box>

        {prompt.description && (
          <Box>
            <Text italic dimColor>{prompt.description.slice(0, terminalWidth - 4)}</Text>
          </Box>
        )}

        {(tags || variables.length > 0) && (
          <Box>
            {tags && (
              <>
                <Text dimColor>Tags: </Text>
                <Text color="blue">{tags}</Text>
              </>
            )}
            {tags && variables.length > 0 && <Text dimColor> · </Text>}
            {variables.length > 0 && (
              <>
                <Text dimColor>Vars: </Text>
                <Text color="yellow">{variables.map(v => v.name).join(', ')}</Text>
              </>
            )}
          </Box>
        )}
      </Box>

      {/* Scrollable Content */}
      <Box 
        flexDirection="column" 
        borderStyle="round" 
        borderColor="gray" 
        paddingX={1}
        flexGrow={1}
        marginX={1}
        overflow="hidden"
      >
        {visibleLines.map((line, i) => (
          <Box key={scrollOffset + i}>
            {line ? <HighlightedLine text={line} /> : <Text> </Text>}
          </Box>
        ))}
      </Box>

      {/* Inline Section: Variable Input or Copied Message */}
      {isFillingVariables && currentVar && (
        <Box flexDirection="column" paddingX={1} borderStyle="round" borderColor={isRunMode ? 'green' : 'cyan'} marginX={1}>
          <Box>
            <Text bold color={isRunMode ? 'green' : 'cyan'}>
              {isRunMode ? '▶ ' : ''}
            </Text>
            <Text color="yellow">${`{${currentVar.name}}`}</Text>
            <Text dimColor> ({currentVarIndex + 1}/{variables.length})</Text>
            {currentVar.defaultValue && (
              <Text dimColor> default: {currentVar.defaultValue}</Text>
            )}
          </Box>
          <Box>
            <Text color="cyan">→ </Text>
            <TextInput
              value={currentInput}
              onChange={setCurrentInput}
              onSubmit={handleVariableSubmit}
              placeholder={currentVar.defaultValue || 'Enter value...'}
            />
          </Box>
        </Box>
      )}
      {showCopiedMessage && (
        <Box paddingX={1} marginX={1}>
          <Text color="green" bold>✓ Copied to clipboard!</Text>
          <Text dimColor>  Press any key to continue</Text>
        </Box>
      )}
      {loadingImage && (
        <Box paddingX={1} marginX={1}>
          <Text color="yellow">Loading image preview...</Text>
        </Box>
      )}

      {/* Footer */}
      <Box paddingX={1} justifyContent="space-between">
        {isFillingVariables ? (
          <Text dimColor>
            Enter confirm · Esc cancel
          </Text>
        ) : (
          <Text dimColor>
            r run · c copy · o open · u user{hasMedia ? ' · p preview' : ''} · b back · q quit
          </Text>
        )}
        {showScrollIndicator && !isFillingVariables && (
          <Text dimColor>
            j/k scroll · {scrollPercent}%
          </Text>
        )}
      </Box>
    </Box>
  );
}
