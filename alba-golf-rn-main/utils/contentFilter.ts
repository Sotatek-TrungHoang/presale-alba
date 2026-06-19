// Content filtering utility for UGC moderation
// This implements basic content filtering to catch obvious violations

export interface FilterResult {
  isAllowed: boolean;
  filteredContent: string;
  violations: string[];
  severity: 'low' | 'medium' | 'high';
}

// Common inappropriate words/phrases (basic list - should be expanded)
const PROFANITY_FILTER = [
  // Add your profanity filter words here
  'spam', 'scam', 'fake', 'bot',
  // Add more as needed
];

// Spam patterns
const SPAM_PATTERNS = [
  /(.)\1{4,}/g, // Repeated characters (e.g., "aaaaa")
  /https?:\/\/[^\s]+/g, // URLs (may be legitimate, but flag for review)
  /[A-Z]{5,}/g, // Excessive caps
  /\$\$+/g, // Multiple dollar signs
];

// Harassment indicators
const HARASSMENT_INDICATORS = [
  /kill\s+yourself/i,
  /go\s+die/i,
  /you\s+should\s+die/i,
  /hate\s+you/i,
  /stupid\s+idiot/i,
  /worthless/i,
];

// Personal information patterns
const PERSONAL_INFO_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, // Credit card
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
  /\b\d{3}-\d{3}-\d{4}\b/g, // Phone number
];

export function filterContent(content: string): FilterResult {
  const violations: string[] = [];
  let filteredContent = content;
  let severity: 'low' | 'medium' | 'high' = 'low';

  // Check for profanity
  const profanityFound = PROFANITY_FILTER.some(word => 
    content.toLowerCase().includes(word.toLowerCase())
  );
  
  if (profanityFound) {
    violations.push('profanity');
    severity = 'medium';
  }

  // Check for spam patterns
  SPAM_PATTERNS.forEach(pattern => {
    if (pattern.test(content)) {
      violations.push('spam_pattern');
      severity = severity === 'high' ? 'high' : 'medium';
    }
  });

  // Check for harassment
  const harassmentFound = HARASSMENT_INDICATORS.some(pattern => 
    pattern.test(content)
  );
  
  if (harassmentFound) {
    violations.push('harassment');
    severity = 'high';
  }

  // Check for personal information
  const personalInfoFound = PERSONAL_INFO_PATTERNS.some(pattern => 
    pattern.test(content)
  );
  
  if (personalInfoFound) {
    violations.push('personal_info');
    severity = 'high';
    // Remove personal information
    filteredContent = content.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED]');
    filteredContent = filteredContent.replace(/\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, '[REDACTED]');
    filteredContent = filteredContent.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED]');
    filteredContent = filteredContent.replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[REDACTED]');
  }

  // Check message length (very long messages might be spam)
  if (content.length > 1000) {
    violations.push('excessive_length');
    severity = severity === 'high' ? 'high' : 'medium';
  }

  // Check for excessive repetition
  const words = content.toLowerCase().split(/\s+/);
  const wordCounts = words.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const maxRepetition = Math.max(...Object.values(wordCounts));
  if (maxRepetition > 5) {
    violations.push('excessive_repetition');
    severity = severity === 'high' ? 'high' : 'medium';
  }

  const isAllowed = violations.length === 0 || severity === 'low';

  return {
    isAllowed,
    filteredContent,
    violations,
    severity,
  };
}

// Function to check if content should be flagged for human review
export function shouldFlagForReview(result: FilterResult): boolean {
  return result.violations.length > 0 && result.severity !== 'low';
}

// Function to get user-friendly violation messages
export function getViolationMessage(violations: string[]): string {
  const messages: Record<string, string> = {
    profanity: 'Your message contains inappropriate language.',
    spam_pattern: 'Your message appears to be spam.',
    harassment: 'Your message contains harassing content.',
    personal_info: 'Your message contains personal information that has been removed.',
    excessive_length: 'Your message is too long.',
    excessive_repetition: 'Your message contains excessive repetition.',
  };

  return violations.map(v => messages[v] || 'Your message violates our community guidelines.').join(' ');
}

