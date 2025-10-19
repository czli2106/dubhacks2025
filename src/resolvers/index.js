import ResolverPackage from '@forge/resolver';
import { fetchGitHubRepoData } from './github_retrieve.js';

/**
 * Forge's resolver library is packaged as CommonJS which means that importing
 * it from an ES module yields an object that includes both the factory helpers
 * and the actual Resolver class. In some Forge bundling scenarios the default
 * export is wrapped, so we defensively unwrap it here to avoid the
 * "out is not a constructor" error.
 */
const Resolver = typeof ResolverPackage === 'function' ? ResolverPackage : ResolverPackage.default;
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
    const data = await fetchGitHubRepoData(owner, repo, { accessToken });
    
    return {
      success: true,
      prs: data.prs,
      issues: data.issues,
      markdownFiles: data.markdownFiles,
      total: data.all.length
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
