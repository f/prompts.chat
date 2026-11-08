import React, { useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { chatPlatforms, codePlatforms, imagePlatforms, videoPlatforms, buildUrl, type Platform } from '../platforms.js';
import type { Prompt } from '../api.js';

interface RunPromptProps {
  content: string;
  title?: string;
  description?: string;
  promptType?: Prompt['type'];
  mediaUrl?: string | null;
  onRun: (url: string, platform: Platform) => void;
  onCopyAndOpen: (content: string, platform: Platform) => void;
  onBack: () => void;
}

type Tab = 'chat' | 'code';

export function RunPrompt({ content, title, description, promptType, mediaUrl, onRun, onCopyAndOpen, onBack }: RunPromptProps) {
  const { stdout } = useStdout();
  const [tab, setTab] = useState<Tab>('chat');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const terminalHeight = stdout?.rows || 24;
  const terminalWidth = stdout?.columns || 80;
  // Get platforms based on tab, include media platforms for image/video prompts
  const basePlatforms = tab === 'chat' ? chatPlatforms : codePlatforms;
  const mediaPlatforms = promptType === 'IMAGE' ? imagePlatforms : promptType === 'VIDEO' ? videoPlatforms : [];
  
  // Sort: sponsors first, then alphabetically
  const platforms = [...mediaPlatforms, ...basePlatforms].sort((a, b) => {
    if (a.sponsor && !b.sponsor) return -1;
    if (!a.sponsor && b.sponsor) return 1;
    return a.name.localeCompare(b.name);
  });
  const previewLength = terminalWidth - 6;
  const contentPreview = content.replace(/\n/g, ' ').slice(0, previewLength);
  const isMediaType = promptType === 'IMAGE' || promptType === 'VIDEO' || promptType === 'AUDIO';

  useInput((input: string, key: { escape?: boolean; return?: boolean; leftArrow?: boolean; rightArrow?: boolean; upArrow?: boolean; downArrow?: boolean }) => {
    if (key.escape || input === 'b') {
      onBack();
      return;
    }

    if (key.leftArrow || key.rightArrow || input === 'h' || input === 'l') {
      setTab(tab === 'chat' ? 'code' : 'chat');
      setSelectedIndex(0);
      return;
    }

    if (key.upArrow || input === 'k') {
      setSelectedIndex((i) => Math.max(0, i - 1));
    }

    if (key.downArrow || input === 'j') {
      setSelectedIndex((i) => Math.min(platforms.length - 1, i + 1));
    }

    if (key.return) {
      const platform = platforms[selectedIndex];
      if (platform.supportsQuerystring === false) {
        onCopyAndOpen(content, platform);
      } else {
        const url = buildUrl(platform.id, platform.baseUrl, content, title, description);
        onRun(url, platform);
      }
    }
  });

  return (
    <Box flexDirection="column" height={terminalHeight}>
      {/* Header with Prompt Info */}
      <Box flexDirection="column" paddingX={1} marginBottom={1}>
        <Box>
          <Text bold color="green">▶ Run: </Text>
          <Text bold color="cyan">{title || 'Untitled'}</Text>
          {isMediaType && (
            <Text color="magenta"> [{promptType}]</Text>
          )}
        </Box>
        <Box>
          <Text dimColor>{contentPreview}{content.length > previewLength ? '…' : ''}</Text>
        </Box>
      </Box>

      {/* Tabs */}
      <Box paddingX={1} marginBottom={1}>
        <Text 
          color={tab === 'chat' ? 'cyan' : 'gray'} 
          bold={tab === 'chat'}
          underline={tab === 'chat'}
        >
          Chat
        </Text>
        <Text dimColor>  </Text>
        <Text 
          color={tab === 'code' ? 'cyan' : 'gray'} 
          bold={tab === 'code'}
          underline={tab === 'code'}
        >
          Code
        </Text>
        <Text dimColor>  h/l to switch</Text>
      </Box>

      {/* Platform List */}
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {platforms.map((platform, index) => (
          <Box key={platform.id}>
            <Text color={index === selectedIndex ? 'cyan' : undefined}>
              {index === selectedIndex ? '❯ ' : '  '}
            </Text>
            {platform.sponsor ? (
              <Text color="magenta">♥ </Text>
            ) : platform.supportsQuerystring === false ? (
              <Text color="yellow">◐ </Text>
            ) : (
              <Text color="green">⚡ </Text>
            )}
            <Text
              color={index === selectedIndex ? 'cyan' : undefined}
              bold={index === selectedIndex}
            >
              {platform.name}
            </Text>
            {platform.supportsQuerystring === false && (
              <Text dimColor> (copy & open)</Text>
            )}
          </Box>
        ))}
      </Box>

      {/* Footer */}
      <Box paddingX={1} justifyContent="space-between">
        <Text dimColor>
          j/k select · Enter run · h/l tab · b back
        </Text>
        <Text dimColor>
          ♥ sponsor · ⚡ direct · ◐ copy+open
        </Text>
      </Box>
    </Box>
  );
}
