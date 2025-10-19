import Resolver from '@forge/resolver';
import { retrieveGitHubRepoData } from './github_retrieve.js';

const resolver = new Resolver();

resolver.define('getPieChartData', (req) => {
  console.log(req);

  return [
    {
      type: 'bug',
      label: 'Bugs',
      value: 25
    },
    {
      type: 'story',
      label: 'Stories',
      value: 40
    }
  ];
});

/**
 * Resolver function to retrieve GitHub PRs, issues, and markdown files
 * Usage: Call with { owner: "langchain-ai", repo: "langchain", accessToken: "your_token" }
 */
resolver.define('getGitHubRepoData', async (req) => {
  try {
    const { owner, repo, accessToken } = req.payload;
    
    if (!owner || !repo || !accessToken) {
      throw new Error('Missing required parameters: owner, repo, accessToken');
    }

    console.log(`Loading GitHub data for ${owner}/${repo}`);
    const data = await retrieveGitHubRepoData(owner, repo, accessToken);
    
    return {
      success: true,
      issuesAndPRs: data.issuesAndPRs,
      markdownFiles: data.markdownFiles
    };
  } catch (error) {
    console.error('Error in getGitHubRepoData resolver:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

export const handler = resolver.getDefinitions();
