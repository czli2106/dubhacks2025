/**
 * GitHub analysis helpers that power the initial intelligence layer of the app.
 * The functions below translate the raw document-like objects returned by the
 * GitHub ingestion helpers into actionable insights that we can surface on the
 * very first user interaction, long before we ever spin up the roadmap agent.
 *
 * Each helper accepts the data that the resolver already retrieves
 * (`prs`, `issues`) and returns a plain JavaScript object that the UI or later
 * resolver steps can render without additional parsing.
 */

/**
 * Safely unwraps metadata from either a LangChain `Document` instance or a
 * plain JavaScript object. The GitHub ingestion layer currently returns plain
 * objects shaped like LangChain Documents, but keeping this helper flexible lets us re-use these functions
 * in tests or future resolvers without additional changes.
 *
 * @param {Object} item - Document-like object that may contain a `metadata` key.
 * @returns {Object} Always returns an object. Falls back to an empty object.
 */
function getMetadata(item) {
  if (!item) {
    return {};
  }

  if (item.metadata && typeof item.metadata === 'object') {
    return item.metadata;
  }

  return item;
}

/**
 * Attempts to extract the human readable title from the `pageContent` field of a
 * LangChain Document. Pull request and issue documents both start with a
 * Markdown header that we can parse. If that text is missing, we degrade
 * gracefully by returning `null`.
 *
 * @param {Object} item - Document-like object with a `pageContent` string.
 * @returns {string|null} The detected title or `null` when not available.
 */
function extractTitle(item) {
  if (!item || typeof item.pageContent !== 'string') {
    return null;
  }

  const firstLine = item.pageContent.split('\n')[0];
  const titleMatch = firstLine.match(/^#\s*(.+)$/);
  return titleMatch ? titleMatch[1].trim() : null;
}

/**
 * Parses ISO date strings into `Date` instances. Returns `null` instead of
 * throwing whenever the input cannot be parsed. This strategy keeps the
 * downstream computations robust even when the GitHub API omits fields.
 *
 * @param {string|Date|undefined} value - Raw date value from GitHub metadata.
 * @returns {Date|null} - `Date` instance or `null` when parsing fails.
 */
function toDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Calculates the difference in days between `targetDate` and `referenceDate`.
 * We return `null` when either of the dates cannot be parsed to avoid exposing
 * misleading negative infinity type values to the UI.
 *
 * @param {Date|null} targetDate - Date of interest (e.g. last update).
 * @param {Date} referenceDate - Usually `new Date()` so callers can test easily.
 * @returns {number|null} Number of whole days between the two dates.
 */
function differenceInDays(targetDate, referenceDate = new Date()) {
  if (!targetDate || !referenceDate) {
    return null;
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((referenceDate.getTime() - targetDate.getTime()) / millisecondsPerDay);
}

/**
 * Generates an intake summary that we can display immediately after fetching
 * GitHub data. Maintainers get a quick snapshot covering total counts, open vs.
 * closed mix, and recency signals, helping them decide whether to dive deeper
 * or course-correct first.
 *
 * @param {Object} payload - Object containing `prs` and `issues` arrays.
 * @param {Object} options - Optional configuration for recency windows.
 * @param {number} options.recencyWindowDays - Days used to determine "recent" activity.
 * @returns {Object} Summary metrics ready to render in the project page.
 */
export function buildGitHubIntakeSummary(payload = {}, options = {}) {
  const prs = Array.isArray(payload.prs) ? payload.prs : [];
  const issues = Array.isArray(payload.issues) ? payload.issues : [];
  const recencyWindowDays = options.recencyWindowDays ?? 14;
  const referenceDate = options.referenceDate || new Date();

  const interpretState = (item) => {
    const metadata = getMetadata(item);
    return (metadata.state || item.state || '').toLowerCase();
  };

  const isOpen = (item) => interpretState(item) === 'open';

  const openPRs = prs.filter(isOpen);
  const closedPRs = prs.length - openPRs.length;

  const openIssues = issues.filter(isOpen);
  const closedIssues = issues.length - openIssues.length;

  const lastPROpened = openPRs
    .map((pr) => toDate(getMetadata(pr).created_at))
    .filter(Boolean)
    .sort((a, b) => b - a)[0] || null;

  const lastPRUpdated = prs
    .map((pr) => toDate(getMetadata(pr).updated_at))
    .filter(Boolean)
    .sort((a, b) => b - a)[0] || null;

  const lastIssueUpdated = issues
    .map((issue) => toDate(getMetadata(issue).updated_at))
    .filter(Boolean)
    .sort((a, b) => b - a)[0] || null;

  const mostRecentActivity = [lastPRUpdated, lastIssueUpdated]
    .filter(Boolean)
    .sort((a, b) => b - a)[0] || null;

  const repositoryName =
    (prs[0] && getMetadata(prs[0]).repository) ||
    (issues[0] && getMetadata(issues[0]).repository) ||
    null;

  return {
    repository: repositoryName,
    totals: {
      pullRequests: {
        total: prs.length,
        open: openPRs.length,
        closed: closedPRs
      },
      issues: {
        total: issues.length,
        open: openIssues.length,
        closed: closedIssues
      }
    },
    recency: {
      lastOpenPRCreatedAt: lastPROpened ? lastPROpened.toISOString() : null,
      lastPROrIssueActivityAt: mostRecentActivity ? mostRecentActivity.toISOString() : null,
      daysSinceLastActivity: mostRecentActivity ? differenceInDays(mostRecentActivity, referenceDate) : null,
      recentActivityWithinWindow: mostRecentActivity
        ? differenceInDays(mostRecentActivity, referenceDate) <= recencyWindowDays
        : false
    }
  };
}

/**
 * Analyses pull requests to highlight reviewer hotspots: stale reviews that
 * need nudging and contributors who are particularly active. Showing these
 * insights immediately after the import call helps maintainers plan their next
 * triage session before we hammer out a full automation flow.
 *
 * @param {Object[]} prs - Array of pull request Documents.
 * @param {Object} options - Optional thresholds to customise the heuristics.
 * @param {number} options.staleAfterDays - Days without updates before marking stale.
 * @param {number} options.topContributorCount - Number of contributors to highlight.
 * @returns {Object} Pull request insights for the UI.
 */
export function buildPullRequestAttentionInsights(prs = [], options = {}) {
  const staleAfterDays = options.staleAfterDays ?? 7;
  const topContributorCount = options.topContributorCount ?? 3;
  const referenceDate = options.referenceDate || new Date();

  const contributorStats = new Map();
  const stalePRs = [];

  prs.forEach((pr) => {
    const metadata = getMetadata(pr);
    const author = metadata.author || 'unknown';
    const updatedAt = toDate(metadata.updated_at);
    const title = extractTitle(pr);

    const currentCount = contributorStats.get(author) || { author, pullRequestCount: 0 };
    contributorStats.set(author, {
      ...currentCount,
      pullRequestCount: currentCount.pullRequestCount + 1
    });

    const daysSinceUpdate = differenceInDays(updatedAt, referenceDate);
    const isOpen = (metadata.state || '').toLowerCase() === 'open';
    if (isOpen && daysSinceUpdate !== null && daysSinceUpdate >= staleAfterDays) {
      stalePRs.push({
        number: metadata.number,
        title,
        lastUpdatedAt: updatedAt ? updatedAt.toISOString() : null,
        daysSinceUpdate
      });
    }
  });

  const topContributors = Array.from(contributorStats.values())
    .sort((a, b) => b.pullRequestCount - a.pullRequestCount)
    .slice(0, topContributorCount);

  return {
    totals: {
      pullRequests: prs.length,
      stale: stalePRs.length
    },
    stalePullRequests: stalePRs,
    topContributors,
    suggestedAction:
      stalePRs.length > 0
        ? 'Reach out to reviewers on the stale pull requests to unblock merges.'
        : 'No stale pull requests detected. Keep encouraging these contributors!'
  };
}

/**
 * Builds a triage snapshot for GitHub issues by bucketing them into high-impact
 * categories. This allows maintainers to immediately identify blockers,
 * beginner-friendly opportunities, and security-related follow-ups without
 * paging through GitHub manually.
 *
 * @param {Object[]} issues - Array of issue Documents.
 * @param {Object} options - Optional overrides for label matching keywords.
 * @returns {Object} Structured issue buckets ready for display.
 */
export function buildIssueTriageSnapshot(issues = [], options = {}) {
  const labelMatchers = {
    blockers: options.blockerLabels || ['blocker', 'critical', 'p0', 'urgent'],
    onboarding: options.onboardingLabels || ['good first issue', 'starter', 'help wanted'],
    security: options.securityLabels || ['security', 'vulnerability', 'cve'],
    ...options.labelMatchers
  };

  const buckets = {
    blockers: [],
    onboarding: [],
    security: [],
    otherOpen: []
  };

  issues.forEach((issue) => {
    const metadata = getMetadata(issue);
    const labels = Array.isArray(metadata.labels) ? metadata.labels.map((label) => label.toLowerCase()) : [];
    const isOpen = (metadata.state || '').toLowerCase() === 'open';
    const title = extractTitle(issue);

    if (!isOpen) {
      return;
    }

    const issueSummary = {
      number: metadata.number,
      title,
      labels: metadata.labels || [],
      url: metadata.source || null,
      lastUpdatedAt: metadata.updated_at || null
    };

    const matchesLabel = (labelList) => labelList.some((needle) => labels.includes(needle.toLowerCase()));

    if (matchesLabel(labelMatchers.blockers)) {
      buckets.blockers.push(issueSummary);
      return;
    }

    if (matchesLabel(labelMatchers.onboarding)) {
      buckets.onboarding.push(issueSummary);
      return;
    }

    if (matchesLabel(labelMatchers.security)) {
      buckets.security.push(issueSummary);
      return;
    }

    buckets.otherOpen.push(issueSummary);
  });

  return {
    totals: {
      openIssues: buckets.blockers.length + buckets.onboarding.length + buckets.security.length + buckets.otherOpen.length,
      blockers: buckets.blockers.length,
      onboarding: buckets.onboarding.length,
      security: buckets.security.length
    },
    buckets,
    suggestedAction:
      buckets.blockers.length > 0
        ? 'Prioritise the blocker issues first to stabilise the project.'
        : 'No critical blockers detected. Consider pairing newcomers with onboarding-friendly issues.'
  };
}
