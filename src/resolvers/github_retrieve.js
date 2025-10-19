import { Document } from "@langchain/core/documents";
import { AsyncCaller } from "@langchain/core/utils/async_caller";

/**
 * Parses a GitHub URL to extract owner and repository name
 * @param {string} url - GitHub URL (e.g., 'https://github.com/langchain-ai/langchain')
 * @returns {Object} Object containing owner and repo
 */
function parseGitHubUrl(url) {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) {
    throw new Error('Invalid GitHub URL format. Expected: https://github.com/owner/repo');
  }
  return { owner: match[1], repo: match[2] };
}

/**
 * Fetches pull requests from a GitHub repository and converts them to Documents
 * @param {string} ownerOrUrl - Repository owner OR GitHub URL (e.g., 'langchain-ai' or 'https://github.com/langchain-ai/langchain')
 * @param {string} repo - Repository name (ignored if ownerOrUrl is a URL)
 * @param {Object} options - Configuration options
 * @param {string} options.accessToken - GitHub access token
 * @param {string} options.state - PR state: 'open', 'closed', or 'all' (default: 'all')
 * @param {number} options.perPage - Results per page (default: 100, max: 100)
 * @param {number} options.maxPages - Maximum number of pages to fetch (default: unlimited)
 * @param {string} options.apiUrl - GitHub API URL (default: 'https://api.github.com')
 * @returns {Promise<Document[]>} Array of Documents containing PR data
 */
export async function fetchGitHubPRs(ownerOrUrl, repo, options = {}) {
  // Parse URL if provided, otherwise use owner/repo format
  let owner, actualRepo;
  if (ownerOrUrl.includes('github.com')) {
    const parsed = parseGitHubUrl(ownerOrUrl);
    owner = parsed.owner;
    actualRepo = parsed.repo;
  } else {
    owner = ownerOrUrl;
    actualRepo = repo;
  }
  const {
    accessToken,
    state = 'all',
    perPage = 100,
    maxResults = null, // Maximum total results to fetch
    apiUrl = 'https://api.github.com'
  } = options;

  const headers = {
    'User-Agent': 'langchain',
    'Accept': 'application/vnd.github.v3+json'
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const caller = new AsyncCaller({ maxConcurrency: 2, maxRetries: 2 });
  const documents = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${apiUrl}/repos/${owner}/${actualRepo}/pulls?state=${state}&per_page=${perPage}&page=${page}`;
    
    const prs = await caller.call(async () => {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch PRs: ${response.status} ${response.statusText}`);
      }
      return response.json();
    });

    if (prs.length === 0) {
      hasMore = false;
      break;
    }

    for (const pr of prs) {
      // Check if we've reached the maxResults limit
      if (maxResults && documents.length >= maxResults) {
        hasMore = false;
        break;
      }

      const content = `# Pull Request #${pr.number}: ${pr.title}

**Author:** ${pr.user.login}
**State:** ${pr.state}
**Created:** ${pr.created_at}
**Updated:** ${pr.updated_at}
${pr.merged_at ? `**Merged:** ${pr.merged_at}` : ''}

## Description
${pr.body || 'No description provided'}

**URL:** ${pr.html_url}
**Base Branch:** ${pr.base.ref}
**Head Branch:** ${pr.head.ref}
`;

      documents.push(new Document({
        pageContent: content,
        metadata: {
          source: pr.html_url,
          type: 'pull_request',
          number: pr.number,
          state: pr.state,
          author: pr.user.login,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          repository: `${owner}/${actualRepo}`
        }
      }));
    }

    page++;
    if (prs.length < perPage) {
      hasMore = false;
    }
  }

  return documents;
}

/**
 * Fetches issues from a GitHub repository and converts them to Documents
 * @param {string} ownerOrUrl - Repository owner OR GitHub URL (e.g., 'langchain-ai' or 'https://github.com/langchain-ai/langchain')
 * @param {string} repo - Repository name (ignored if ownerOrUrl is a URL)
 * @param {Object} options - Configuration options
 * @param {string} options.accessToken - GitHub access token
 * @param {string} options.state - Issue state: 'open', 'closed', or 'all' (default: 'all')
 * @param {number} options.perPage - Results per page (default: 100, max: 100)
 * @param {number} options.maxResults - Maximum total results to fetch (default: unlimited)
 * @param {string} options.apiUrl - GitHub API URL (default: 'https://api.github.com')
 * @returns {Promise<Document[]>} Array of Documents containing issue data
 */
export async function fetchGitHubIssues(ownerOrUrl, repo, options = {}) {
  // Parse URL if provided, otherwise use owner/repo format
  let owner, actualRepo;
  if (ownerOrUrl.includes('github.com')) {
    const parsed = parseGitHubUrl(ownerOrUrl);
    owner = parsed.owner;
    actualRepo = parsed.repo;
  } else {
    owner = ownerOrUrl;
    actualRepo = repo;
  }
  const {
    accessToken,
    state = 'all',
    perPage = 100,
    maxResults = null, // Maximum total results to fetch
    apiUrl = 'https://api.github.com'
  } = options;

  const headers = {
    'User-Agent': 'langchain',
    'Accept': 'application/vnd.github.v3+json'
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const caller = new AsyncCaller({ maxConcurrency: 2, maxRetries: 2 });
  const documents = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${apiUrl}/repos/${owner}/${actualRepo}/issues?state=${state}&per_page=${perPage}&page=${page}`;
    
    const issues = await caller.call(async () => {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch issues: ${response.status} ${response.statusText}`);
      }
      return response.json();
    });

    if (issues.length === 0) {
      hasMore = false;
      break;
    }

    for (const issue of issues) {
      // Check if we've reached the maxResults limit
      if (maxResults && documents.length >= maxResults) {
        hasMore = false;
        break;
      }

      // Skip pull requests (GitHub API returns PRs in issues endpoint)
      if (issue.pull_request) {
        continue;
      }

      const labels = issue.labels.map(l => l.name).join(', ');
      const content = `# Issue #${issue.number}: ${issue.title}

**Author:** ${issue.user.login}
**State:** ${issue.state}
**Created:** ${issue.created_at}
**Updated:** ${issue.updated_at}
${issue.closed_at ? `**Closed:** ${issue.closed_at}` : ''}
${labels ? `**Labels:** ${labels}` : ''}

## Description
${issue.body || 'No description provided'}

**URL:** ${issue.html_url}
**Comments:** ${issue.comments}
`;

      documents.push(new Document({
        pageContent: content,
        metadata: {
          source: issue.html_url,
          type: 'issue',
          number: issue.number,
          state: issue.state,
          author: issue.user.login,
          labels: issue.labels.map(l => l.name),
          created_at: issue.created_at,
          updated_at: issue.updated_at,
          repository: `${owner}/${repo}`
        }
      }));
    }

    page++;
    if (issues.length < perPage) {
      hasMore = false;
    }
  }

  return documents;
}

/**
 * Fetches only markdown files from a GitHub repository
 * @param {string} ownerOrUrl - Repository owner OR GitHub URL (e.g., 'langchain-ai' or 'https://github.com/langchain-ai/langchain')
 * @param {string} repo - Repository name (ignored if ownerOrUrl is a URL)
 * @param {Object} options - Configuration options
 * @param {string} options.accessToken - GitHub access token
 * @param {string} options.branch - Branch to fetch from (default: 'main')
 * @param {number} options.maxResults - Maximum total results to fetch (default: unlimited)
 * @param {string} options.apiUrl - GitHub API URL (default: 'https://api.github.com')
 * @returns {Promise<Document[]>} Array of Documents containing markdown files
 */
export async function fetchGitHubMarkdownFiles(ownerOrUrl, repo, options = {}) {
  // Parse URL if provided, otherwise use owner/repo format
  let owner, actualRepo;
  if (ownerOrUrl.includes('github.com')) {
    const parsed = parseGitHubUrl(ownerOrUrl);
    owner = parsed.owner;
    actualRepo = parsed.repo;
  } else {
    owner = ownerOrUrl;
    actualRepo = repo;
  }
  const {
    accessToken,
    branch = 'main',
    maxResults = null, // Maximum total results to fetch
    apiUrl = 'https://api.github.com'
  } = options;

  const headers = {
    'User-Agent': 'langchain',
    'Accept': 'application/vnd.github.v3+json'
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const caller = new AsyncCaller({ maxConcurrency: 2, maxRetries: 2 });
  const documents = [];

  // Recursive function to fetch files from directory
  async function fetchDirectoryContents(path = '') {
    const url = `${apiUrl}/repos/${owner}/${actualRepo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
    
    const contents = await caller.call(async () => {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch directory contents: ${response.status} ${response.statusText}`);
      }
      return response.json();
    });

    for (const item of contents) {
      // Check if we've reached the maxResults limit
      if (maxResults && documents.length >= maxResults) {
        return; // Stop processing
      }

      if (item.type === 'file' && item.name.endsWith('.md')) {
        // Fetch the file content
        const fileContent = await caller.call(async () => {
          const response = await fetch(item.download_url, { headers });
          if (!response.ok) {
            throw new Error(`Failed to fetch file content: ${response.status} ${response.statusText}`);
          }
          return response.text();
        });

        const content = `# ${item.name}

**Path:** ${item.path}
**Size:** ${item.size} bytes
**SHA:** ${item.sha}

## Content

${fileContent}
`;

        documents.push(new Document({
          pageContent: content,
          metadata: {
            source: item.html_url,
            type: 'markdown_file',
            path: item.path,
            name: item.name,
            size: item.size,
            sha: item.sha,
            repository: `${owner}/${repo}`,
            branch: branch
          }
        }));
      } else if (item.type === 'dir') {
        // Recursively fetch subdirectory contents
        await fetchDirectoryContents(item.path);
      }
    }
  }

  await fetchDirectoryContents();
  return documents;
}

/**
 * Comprehensive function to fetch PRs, issues, and markdown files
 * @param {string} ownerOrUrl - Repository owner OR GitHub URL (e.g., 'langchain-ai' or 'https://github.com/langchain-ai/langchain')
 * @param {string} repo - Repository name (ignored if ownerOrUrl is a URL)
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Object containing prs, issues, and markdownFiles arrays
 */
export async function fetchGitHubRepoData(ownerOrUrl, repo, options = {}) {
  const [prs, issues, markdownFiles] = await Promise.all([
    fetchGitHubPRs(ownerOrUrl, repo, options),
    fetchGitHubIssues(ownerOrUrl, repo, options),
    fetchGitHubMarkdownFiles(ownerOrUrl, repo, options)
  ]);

  return {
    prs,
    issues,
    markdownFiles,
    all: [...prs, ...issues, ...markdownFiles]
  };
}