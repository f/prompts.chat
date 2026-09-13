import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { loadPrompts as loadAllPrompts, filterPrompts, getCategories, type Prompt, type Category } from '../api.js';

interface PromptListProps {
  onSelect: (prompt: Prompt) => void;
  onQuit: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  page: number;
  onPageChange: (page: number) => void;
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  selectedIndex: number;
  onIndexChange: (index: number) => void;
}

type ViewMode = 'list' | 'categories';

/**
 * Renders the interactive CLI prompt browser with searchable prompt and category views,
 * keyboard navigation, and pagination support.
 *
 * @param props - Component props including selection handlers, search state, pagination,
 * and category filters used to drive prompt list interactions.
 * @returns The PromptList Ink UI tree for list and category browsing modes.
 */
export function PromptList({ 
  onSelect, 
  onQuit, 
  searchQuery, 
  onSearchChange, 
  page, 
  onPageChange, 
  selectedCategory, 
  onCategoryChange,
  selectedIndex,
  onIndexChange
}: PromptListProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const allPromptsRef = useRef<Prompt[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [isSearchingCategories, setIsSearchingCategories] = useState(false);

  const terminalHeight = stdout?.rows || 24;
  const terminalWidth = stdout?.columns || 80;
  const headerLines = 3;
  const footerLines = 2;
  const listHeight = Math.max(terminalHeight - headerLines - footerLines, 5);
  // Category view: header + "All Categories" + footer + margins = 4 reserved
  const categoryReservedLines = 4 + (isSearchingCategories ? 1 : 0);
  const categoryListHeight = Math.max(terminalHeight - categoryReservedLines, 5);
  const perPage = listHeight;

  useEffect(() => {
    initializePrompts();
  }, []);

  useEffect(() => {
    if (allPromptsRef.current.length > 0) {
      applyFilters();
    }
  }, [page, searchQuery, selectedCategory, perPage]);

  async function initializePrompts() {
    setLoading(true);
    setError(null);
    try {
      const all = await loadAllPrompts();
      allPromptsRef.current = all;
      setCategories(getCategories(all));
      applyFilters();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    const result = filterPrompts(allPromptsRef.current, {
      q: searchQuery || undefined,
      category: selectedCategory || undefined,
      page,
      perPage,
    });
    setPrompts(result.prompts);
    setTotalPages(result.totalPages);
    setTotal(result.total);
  }

  useInput((input, key) => {
    if (isSearching) {
      if (key.escape) {
        setIsSearching(false);
        setLocalSearchQuery(searchQuery);
      }
      return;
    }

    // Category search mode
    if (isSearchingCategories) {
      if (key.escape) {
        setIsSearchingCategories(false);
        setCategorySearchQuery('');
      }
      return;
    }

    // Category selector mode
    if (viewMode === 'categories') {
      if (key.escape || input === 'b') {
        setViewMode('list');
        setCategorySearchQuery('');
        return;
      }
      if (input === '/') {
        setIsSearchingCategories(true);
        return;
      }
      if (key.upArrow || input === 'k') {
        setCategoryIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow || input === 'j') {
        const filteredCats = categorySearchQuery 
          ? categories.filter(c => c.name.toLowerCase().includes(categorySearchQuery.toLowerCase()))
          : categories;
        const maxIndex = categorySearchQuery ? filteredCats.length - 1 : filteredCats.length;
        setCategoryIndex((i) => Math.min(maxIndex, i + 1));
        return;
      }
      if (key.return) {
        const filteredCats = categorySearchQuery 
          ? categories.filter(c => c.name.toLowerCase().includes(categorySearchQuery.toLowerCase()))
          : categories;
        if (categorySearchQuery) {
          // When filtering, index 0 = first filtered category
          if (filteredCats[categoryIndex]) {
            onCategoryChange(filteredCats[categoryIndex].slug);
          }
        } else {
          // When not filtering, index 0 = "All Categories"
          if (categoryIndex === 0) {
            onCategoryChange(null);
          } else if (filteredCats[categoryIndex - 1]) {
            onCategoryChange(filteredCats[categoryIndex - 1].slug);
          }
        }
        setViewMode('list');
        setCategorySearchQuery('');
        return;
      }
      return;
    }

    if (input === 'q' || key.escape) {
      onQuit();
      exit();
      return;
    }

    if (input === '/') {
      setIsSearching(true);
      return;
    }

    if (input === 'c') {
      setViewMode('categories');
      setCategoryIndex(selectedCategory ? categories.findIndex(c => c.slug === selectedCategory) + 1 : 0);
      return;
    }

    if (key.upArrow || input === 'k') {
      onIndexChange(Math.max(0, selectedIndex - 1));
    }

    if (key.downArrow || input === 'j') {
      onIndexChange(Math.min(prompts.length - 1, selectedIndex + 1));
    }

    if (key.return && prompts[selectedIndex]) {
      onSelect(prompts[selectedIndex]);
    }

    if (input === 'n' && page < totalPages) {
      onPageChange(page + 1);
    }

    if (input === 'p' && page > 1) {
      onPageChange(page - 1);
    }

    if (input === 'r') {
      initializePrompts();
    }
  });

  const handleSearchSubmit = (value: string) => {
    onSearchChange(value);
    setLocalSearchQuery(value);
    setIsSearching(false);
  };

  const handleCategorySearchSubmit = (value: string) => {
    setCategorySearchQuery(value);
    setCategoryIndex(0);
    setIsSearchingCategories(false);
  };

  const filteredCategories = categorySearchQuery 
    ? categories.filter(c => c.name.toLowerCase().includes(categorySearchQuery.toLowerCase()))
    : categories;

  // Category viewport scrolling - calculate which items to show
  const isCategorySearchActive = Boolean(categorySearchQuery);
  const categoryTotalItems = categorySearchQuery ? filteredCategories.length : filteredCategories.length + 1;
  const categoryScrollOffset = Math.max(0, Math.min(categoryIndex - categoryListHeight + 2, Math.max(0, categoryTotalItems - categoryListHeight)));
  const sliceStart = isCategorySearchActive ? categoryScrollOffset : Math.max(0, categoryScrollOffset - 1);
  const sliceEnd = isCategorySearchActive
    ? categoryScrollOffset + categoryListHeight
    : (categoryScrollOffset === 0 ? categoryListHeight - 1 : categoryScrollOffset - 1 + categoryListHeight);

  const maxTitleLength = terminalWidth - 30;

  if (error) {
    return (
      <Box flexDirection="column" height={terminalHeight} padding={1}>
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Press &apos;r&apos; to retry, &apos;q&apos; to quit</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={terminalHeight}>
      {/* Header */}
      <Box paddingX={1} marginBottom={0}>
        <Text bold color="cyan">⚡ prompts.chat</Text>
        <Text dimColor> — {total} prompts</Text>
        {selectedCategory && (
          <>
            <Text dimColor> · </Text>
            <Text color="magenta">{selectedCategory}</Text>
          </>
        )}
        {searchQuery && !isSearching && (
          <>
            <Text dimColor> · </Text>
            <Text color="yellow">{searchQuery}</Text>
          </>
        )}
      </Box>

      {/* Search Input */}
      {isSearching && (
        <Box paddingX={1}>
          <Text color="yellow">Search: </Text>
          <TextInput
            value={localSearchQuery}
            onChange={setLocalSearchQuery}
            onSubmit={handleSearchSubmit}
            placeholder="Type to search..."
          />
        </Box>
      )}

      {/* Category Selector */}
      {viewMode === 'categories' && (
        <Box flexDirection="column" flexGrow={1} paddingX={1}>
          <Box marginBottom={1}>
            <Text bold color="magenta">Select Category</Text>
            {categorySearchQuery && !isSearchingCategories && (
              <>
                <Text dimColor> · </Text>
                <Text color="yellow">{categorySearchQuery}</Text>
              </>
            )}
          </Box>
          {isSearchingCategories && (
            <Box marginBottom={1}>
              <Text color="yellow">Search: </Text>
              <TextInput
                value={categorySearchQuery}
                onChange={setCategorySearchQuery}
                onSubmit={handleCategorySearchSubmit}
                placeholder="Type to filter..."
              />
            </Box>
          )}
          {categories.length === 0 ? (
            <Box>
              <Text color="green"><Spinner type="dots" /></Text>
              <Text> Loading categories...</Text>
            </Box>
          ) : (
            <>
              {!categorySearchQuery && categoryScrollOffset === 0 && (
                <Box>
                  <Text color={categoryIndex === 0 ? 'cyan' : undefined}>
                    {categoryIndex === 0 ? '❯ ' : '  '}
                  </Text>
                  <Text color={categoryIndex === 0 ? 'cyan' : undefined} bold={categoryIndex === 0}>
                    All Categories
                  </Text>
                </Box>
              )}
              {filteredCategories.slice(sliceStart, sliceEnd).map((cat, index) => {
                const actualIndex = (isCategorySearchActive ? sliceStart : categoryScrollOffset) + index;
                // When All Categories is visible (scrollOffset=0), categories are at positions 1+ so add 1
                // When scrolled out, positions match actualIndex directly
                const adjustedIndex = isCategorySearchActive || categoryScrollOffset > 0 ? actualIndex : actualIndex + 1;
                return (
                  <Box key={cat.id}>
                    <Text color={adjustedIndex === categoryIndex ? 'cyan' : undefined}>
                      {adjustedIndex === categoryIndex ? '❯ ' : '  '}
                    </Text>
                    <Text
                      color={adjustedIndex === categoryIndex ? 'cyan' : undefined}
                      bold={adjustedIndex === categoryIndex}
                    >
                      {cat.name}
                    </Text>
                    {cat.count > 0 && (
                      <Text dimColor> ({cat.count})</Text>
                    )}
                  </Box>
                );
              })}
            </>
          )}
        </Box>
      )}

      {/* List */}
      {viewMode === 'list' && (
        <Box flexDirection="column" flexGrow={1} paddingX={1}>
          {loading ? (
            <Box>
              <Text color="green">
                <Spinner type="dots" />
              </Text>
              <Text> Loading prompts...</Text>
            </Box>
          ) : (
            prompts.slice(0, listHeight).map((prompt, index) => (
              <Box key={prompt.id}>
                <Text color={index === selectedIndex ? 'cyan' : undefined}>
                  {index === selectedIndex ? '❯ ' : '  '}
                </Text>
                <Text
                  color={index === selectedIndex ? 'cyan' : undefined}
                  bold={index === selectedIndex}
                >
                  {prompt.title.slice(0, maxTitleLength)}
                  {prompt.title.length > maxTitleLength ? '…' : ''}
                </Text>
                <Text dimColor> @{prompt.author.username}</Text>
                {prompt.voteCount > 0 && (
                  <Text color="yellow"> ⬆ {prompt.voteCount}</Text>
                )}
              </Box>
            ))
          )}
        </Box>
      )}

      {/* Footer */}
      <Box paddingX={1} justifyContent="space-between">
        {viewMode === 'categories' ? (
          <Text dimColor>
            j/k nav · Enter select · / search · b back
          </Text>
        ) : (
          <Text dimColor>
            j/k nav · Enter select · / search · c category · n/p pages · q quit
          </Text>
        )}
        <Text dimColor>
          {viewMode === 'list' ? `${page}/${totalPages}` : ''}
        </Text>
      </Box>
    </Box>
  );
}
