import { GitHubIssuesLoader } from '@langchain/community/document_loaders/github';
import { GithubFileLoader } from '@langchain/community/document_loaders/github';

/**
 * Helper function to load GitHub issues and PRs combined
 */
export async function loadIssuesAndPRs(owner, repo, accessToken) {
  const loader = new GitHubIssuesLoader({
    repo: `${owner}/${repo}`,
    access_token: accessToken,
    include_prs: true,
    state: "all"
  });
  
  return await loader.load();
}

/**
 * Helper function to load GitHub markdown files
 */
export async function loadMarkdownFiles(owner, repo, accessToken) {
  const loader = new GithubFileLoader({
    repo: `${owner}/${repo}`,
    branch: "master",
    access_token: accessToken,
    github_api_url: "https://api.github.com",
    file_filter: (file_path) => file_path.endsWith('.md')
  });
  
  return await loader.load();
}

/**
 * Main function that retrieves issues/PRs and markdown files
 */
export async function retrieveGitHubRepoData(owner, repo, accessToken) {
  const [issuesAndPRs, markdownFiles] = await Promise.all([
    loadIssuesAndPRs(owner, repo, accessToken),
    loadMarkdownFiles(owner, repo, accessToken)
  ]);
  
  return {
    issuesAndPRs,
    markdownFiles
  };
}
