/**
 * Google Analytics Event Tracking Utility
 * 
 * Provides typed functions for tracking user interactions throughout the app.
 * Events are only sent if GOOGLE_ANALYTICS_ID is configured.
 */

declare global {
  interface Window {
    gtag?: (
      command: "event" | "config" | "js",
      action: string,
      params?: Record<string, unknown>
    ) => void;
  }
}

type GTagEvent = {
  action: string;
  category: string;
  label?: string;
  value?: number;
  [key: string]: unknown;
};

function trackEvent({ action, category, label, value, ...rest }: GTagEvent) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", action, {
      event_category: category,
      event_label: label,
      value,
      ...rest,
    });
  }
}

// ============================================================================
// Authentication Events
// ============================================================================

export const analyticsAuth = {
  login: (method: "credentials" | "github" | "google" | "azure") => {
    trackEvent({
      action: "login",
      category: "auth",
      label: method,
    });
  },

  loginFailed: (method: "credentials" | "github" | "google" | "azure") => {
    trackEvent({
      action: "login_failed",
      category: "auth",
      label: method,
    });
  },

  register: () => {
    trackEvent({
      action: "register",
      category: "auth",
    });
  },

  registerFailed: (reason?: string) => {
    trackEvent({
      action: "register_failed",
      category: "auth",
      label: reason,
    });
  },

  logout: () => {
    trackEvent({
      action: "logout",
      category: "auth",
    });
  },

  oauthStart: (provider: string) => {
    trackEvent({
      action: "oauth_start",
      category: "auth",
      label: provider,
    });
  },
};

// ============================================================================
// Prompt Events
// ============================================================================

export const analyticsPrompt = {
  view: (promptId: string, promptTitle?: string) => {
    trackEvent({
      action: "view_prompt",
      category: "prompt",
      label: promptTitle,
      prompt_id: promptId,
    });
  },

  create: (promptType: string) => {
    trackEvent({
      action: "create_prompt",
      category: "prompt",
      label: promptType,
    });
  },

  edit: (promptId: string) => {
    trackEvent({
      action: "edit_prompt",
      category: "prompt",
      prompt_id: promptId,
    });
  },

  delete: (promptId: string) => {
    trackEvent({
      action: "delete_prompt",
      category: "prompt",
      prompt_id: promptId,
    });
  },

  copy: (promptId?: string) => {
    trackEvent({
      action: "copy_prompt",
      category: "prompt",
      prompt_id: promptId,
    });
  },

  upvote: (promptId: string) => {
    trackEvent({
      action: "upvote_prompt",
      category: "prompt",
      prompt_id: promptId,
    });
  },

  removeUpvote: (promptId: string) => {
    trackEvent({
      action: "remove_upvote",
      category: "prompt",
      prompt_id: promptId,
    });
  },

  report: (promptId: string, reason: string) => {
    trackEvent({
      action: "report_prompt",
      category: "prompt",
      label: reason,
      prompt_id: promptId,
    });
  },

  run: (promptId: string | undefined, platform: string) => {
    trackEvent({
      action: "run_prompt",
      category: "prompt",
      label: platform,
      prompt_id: promptId,
    });
  },

  share: (promptId: string | undefined, platform: "twitter" | "hackernews" | "copy_link" | "embed" | "embed_iframe") => {
    trackEvent({
      action: "share_prompt",
      category: "prompt",
      label: platform,
      prompt_id: promptId,
    });
  },

  addVersion: (promptId: string) => {
    trackEvent({
      action: "add_version",
      category: "prompt",
      prompt_id: promptId,
    });
  },

  compareVersions: (promptId: string) => {
    trackEvent({
      action: "compare_versions",
      category: "prompt",
      prompt_id: promptId,
    });
  },

  fillVariables: (promptId?: string) => {
    trackEvent({
      action: "fill_variables",
      category: "prompt",
      prompt_id: promptId,
    });
  },

  changeRequest: (promptId: string, action: "create" | "approve" | "dismiss" | "reopen") => {
    trackEvent({
      action: `change_request_${action}`,
      category: "prompt",
      prompt_id: promptId,
    });
  },

  pin: (promptId: string) => {
    trackEvent({
      action: "pin_prompt",
      category: "prompt",
      prompt_id: promptId,
    });
  },

  unpin: (promptId: string) => {
    trackEvent({
      action: "unpin_prompt",
      category: "prompt",
      prompt_id: promptId,
    });
  },

  feature: (promptId: string) => {
    trackEvent({
      action: "feature_prompt",
      category: "prompt",
      prompt_id: promptId,
    });
  },

  unfeature: (promptId: string) => {
    trackEvent({
      action: "unfeature_prompt",
      category: "prompt",
      prompt_id: promptId,
    });
  },
};

// ============================================================================
// Search & Filter Events
// ============================================================================

export const analyticsSearch = {
  search: (query: string, aiEnabled?: boolean) => {
    trackEvent({
      action: "search",
      category: "search",
      label: query,
      ai_search: aiEnabled,
    });
  },

  filter: (filterType: string, value: string) => {
    trackEvent({
      action: "filter",
      category: "search",
      label: `${filterType}:${value}`,
    });
  },

  clearFilters: () => {
    trackEvent({
      action: "clear_filters",
      category: "search",
    });
  },

  sort: (sortBy: string) => {
    trackEvent({
      action: "sort",
      category: "search",
      label: sortBy,
    });
  },

  aiSearchToggle: (enabled: boolean) => {
    trackEvent({
      action: "ai_search_toggle",
      category: "search",
      label: enabled ? "enabled" : "disabled",
    });
  },
};

// ============================================================================
// Navigation Events
// ============================================================================

export const analyticsNav = {
  clickNavLink: (destination: string) => {
    trackEvent({
      action: "nav_click",
      category: "navigation",
      label: destination,
    });
  },

  viewPage: (pageName: string) => {
    trackEvent({
      action: "page_view",
      category: "navigation",
      label: pageName,
    });
  },

  clickLogo: () => {
    trackEvent({
      action: "logo_click",
      category: "navigation",
    });
  },

  openMobileMenu: () => {
    trackEvent({
      action: "mobile_menu_open",
      category: "navigation",
    });
  },

  closeMobileMenu: () => {
    trackEvent({
      action: "mobile_menu_close",
      category: "navigation",
    });
  },
};

// ============================================================================
// User Profile Events
// ============================================================================

export const analyticsProfile = {
  viewProfile: (username: string, isSelf: boolean) => {
    trackEvent({
      action: "view_profile",
      category: "profile",
      label: username,
      is_self: isSelf,
    });
  },

  follow: (username: string) => {
    trackEvent({
      action: "follow_user",
      category: "profile",
      label: username,
    });
  },

  unfollow: (username: string) => {
    trackEvent({
      action: "unfollow_user",
      category: "profile",
      label: username,
    });
  },

  updateProfile: () => {
    trackEvent({
      action: "update_profile",
      category: "profile",
    });
  },

  updateAvatar: () => {
    trackEvent({
      action: "update_avatar",
      category: "profile",
    });
  },
};

// ============================================================================
// Category Events
// ============================================================================

export const analyticsCategory = {
  view: (categorySlug: string) => {
    trackEvent({
      action: "view_category",
      category: "category",
      label: categorySlug,
    });
  },

  subscribe: (categoryId: string, categoryName: string) => {
    trackEvent({
      action: "subscribe_category",
      category: "category",
      label: categoryName,
      category_id: categoryId,
    });
  },

  unsubscribe: (categoryId: string, categoryName: string) => {
    trackEvent({
      action: "unsubscribe_category",
      category: "category",
      label: categoryName,
      category_id: categoryId,
    });
  },
};

// ============================================================================
// Tag Events
// ============================================================================

export const analyticsTag = {
  view: (tagSlug: string) => {
    trackEvent({
      action: "view_tag",
      category: "tag",
      label: tagSlug,
    });
  },

  click: (tagSlug: string, source?: string) => {
    trackEvent({
      action: "click_tag",
      category: "tag",
      label: tagSlug,
      source,
    });
  },
};

// ============================================================================
// Settings Events
// ============================================================================

export const analyticsSettings = {
  changeTheme: (theme: string) => {
    trackEvent({
      action: "change_theme",
      category: "settings",
      label: theme,
    });
  },

  changeLanguage: (language: string) => {
    trackEvent({
      action: "change_language",
      category: "settings",
      label: language,
    });
  },

  updateNotifications: (enabled: boolean) => {
    trackEvent({
      action: "update_notifications",
      category: "settings",
      label: enabled ? "enabled" : "disabled",
    });
  },

  deleteAccount: () => {
    trackEvent({
      action: "delete_account",
      category: "settings",
    });
  },
};

// ============================================================================
// Hero/Homepage Events
// ============================================================================

export const analyticsHero = {
  submitPromptIdea: (promptText: string) => {
    trackEvent({
      action: "hero_submit_prompt",
      category: "homepage",
      label: promptText.substring(0, 100),
    });
  },

  clickAnimatedPrompt: () => {
    trackEvent({
      action: "hero_click_animated",
      category: "homepage",
    });
  },

  focusInput: () => {
    trackEvent({
      action: "hero_focus_input",
      category: "homepage",
    });
  },
};

// ============================================================================
// Sponsor Events
// ============================================================================

export const analyticsSponsor = {
  click: (sponsorName: string, sponsorUrl: string) => {
    trackEvent({
      action: "sponsor_click",
      category: "sponsor",
      label: sponsorName,
      sponsor_url: sponsorUrl,
    });
  },

  becomeSponsorClick: () => {
    trackEvent({
      action: "become_sponsor_click",
      category: "sponsor",
    });
  },

  builtWithClick: (toolName: string) => {
    trackEvent({
      action: "built_with_click",
      category: "sponsor",
      label: toolName,
    });
  },
};

// ============================================================================
// MCP Events
// ============================================================================

export const analyticsMcp = {
  openPopup: () => {
    trackEvent({
      action: "mcp_popup_open",
      category: "mcp",
    });
  },

  copyCommand: (commandType: string) => {
    trackEvent({
      action: "mcp_copy_command",
      category: "mcp",
      label: commandType,
    });
  },
};

// ============================================================================
// Engagement Events
// ============================================================================

export const analyticsEngagement = {
  scrollDepth: (percentage: number) => {
    trackEvent({
      action: "scroll_depth",
      category: "engagement",
      value: percentage,
    });
  },

  timeOnPage: (seconds: number, pageName: string) => {
    trackEvent({
      action: "time_on_page",
      category: "engagement",
      label: pageName,
      value: seconds,
    });
  },

  clickExternalLink: (url: string) => {
    trackEvent({
      action: "external_link_click",
      category: "engagement",
      label: url,
    });
  },
};

// ============================================================================
// Comment Events
// ============================================================================

export const analyticsComment = {
  post: (promptId: string, isReply: boolean) => {
    trackEvent({
      action: isReply ? "post_reply" : "post_comment",
      category: "comment",
      prompt_id: promptId,
    });
  },
};

// ============================================================================
// Collection Events
// ============================================================================

export const analyticsCollection = {
  add: (promptId: string) => {
    trackEvent({
      action: "add_to_collection",
      category: "collection",
      prompt_id: promptId,
    });
  },

  remove: (promptId: string) => {
    trackEvent({
      action: "remove_from_collection",
      category: "collection",
      prompt_id: promptId,
    });
  },
};

// ============================================================================
// Translation Events
// ============================================================================

export const analyticsTranslate = {
  translate: (targetLanguage: string) => {
    trackEvent({
      action: "translate_prompt",
      category: "translate",
      label: targetLanguage,
    });
  },
};

// ============================================================================
// External Link Events
// ============================================================================

export const analyticsExternal = {
  clickChromeExtension: () => {
    trackEvent({
      action: "chrome_extension_click",
      category: "external",
    });
  },

  clickFooterLink: (linkName: string) => {
    trackEvent({
      action: "footer_link_click",
      category: "external",
      label: linkName,
    });
  },
};

// ============================================================================
// Widget Events
// ============================================================================

export const analyticsWidget = {
  view: (widgetId: string, actionName?: string) => {
    trackEvent({
      action: "widget_view",
      category: "widget",
      label: actionName,
      widget_id: widgetId,
    });
  },

  click: (widgetId: string, actionName?: string) => {
    trackEvent({
      action: "widget_click",
      category: "widget",
      label: actionName,
      widget_id: widgetId,
    });
  },

  copy: (widgetId: string, actionName?: string) => {
    trackEvent({
      action: "widget_copy",
      category: "widget",
      label: actionName,
      widget_id: widgetId,
    });
  },

  action: (widgetId: string, actionName?: string, actionUrl?: string) => {
    trackEvent({
      action: "widget_action",
      category: "widget",
      label: actionName,
      widget_id: widgetId,
      action_url: actionUrl,
    });
  },
};

// ============================================================================
// Admin Events
// ============================================================================

export const analyticsAdmin = {
  viewDashboard: () => {
    trackEvent({
      action: "view_admin_dashboard",
      category: "admin",
    });
  },

  manageUsers: (action: "ban" | "unban" | "promote" | "demote") => {
    trackEvent({
      action: `user_${action}`,
      category: "admin",
    });
  },

  managePrompts: (action: "feature" | "unfeature" | "delete" | "approve" | "reject") => {
    trackEvent({
      action: `prompt_${action}`,
      category: "admin",
    });
  },

  importPrompts: (count: number) => {
    trackEvent({
      action: "import_prompts",
      category: "admin",
      value: count,
    });
  },
};

// ============================================================================
// Kids Mode Events
// ============================================================================

export const analyticsKids = {
  startGame: () => {
    trackEvent({
      action: "kids_start_game",
      category: "kids",
    });
  },

  viewLevel: (levelSlug: string, world: number) => {
    trackEvent({
      action: "kids_view_level",
      category: "kids",
      label: levelSlug,
      world,
    });
  },

  completeLevel: (levelSlug: string, world: number, stars: number) => {
    trackEvent({
      action: "kids_complete_level",
      category: "kids",
      label: levelSlug,
      world,
      value: stars,
    });
  },

  completeWorld: (world: number) => {
    trackEvent({
      action: "kids_complete_world",
      category: "kids",
      value: world,
    });
  },

  interactiveComplete: (componentType: string, levelSlug: string) => {
    trackEvent({
      action: "kids_interactive_complete",
      category: "kids",
      label: `${componentType}:${levelSlug}`,
    });
  },

  openSettings: () => {
    trackEvent({
      action: "kids_open_settings",
      category: "kids",
    });
  },

  changeLanguage: (locale: string) => {
    trackEvent({
      action: "kids_change_language",
      category: "kids",
      label: locale,
    });
  },

  resetProgress: () => {
    trackEvent({
      action: "kids_reset_progress",
      category: "kids",
    });
  },

  viewMap: () => {
    trackEvent({
      action: "kids_view_map",
      category: "kids",
    });
  },
};
