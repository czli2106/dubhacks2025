import React, { useState } from 'react';
import ForgeReconciler, { 
  Text, 
  Box, 
  Button, 
  Textfield, 
  Form, 
  FormSection, 
  FormHeader,
  Heading,
  Spinner,
  SectionMessage,
  Stack,
  Checkbox,
  Strong
} from '@forge/react';
import { invoke } from '@forge/bridge';

export const View = () => {
  const [githubUrl, setGithubUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [createJiraIssues, setCreateJiraIssues] = useState(true);
  const [createConfluencePages, setCreateConfluencePages] = useState(true);

  const handleSubmit = async (e) => {
    if (!githubUrl.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Extract owner/repo from GitHub URL
      const urlMatch = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!urlMatch) {
        throw new Error('Please enter a valid GitHub repository URL (e.g., https://github.com/owner/repo)');
      }

      const [, owner, repo] = urlMatch;
      
      if (!githubToken.trim()) {
        throw new Error('Please enter your GitHub personal access token');
      }

      console.log(`Starting analysis for ${owner}/${repo}`);

      // Call the GitHub data retrieval function
      const data = await invoke('getGitHubRepoData', {
        owner,
        repo,
        accessToken: githubToken
      });

      if (data.success) {
        setResult(data);
        
        // If user wants to create Jira issues and Confluence pages
        if (createJiraIssues || createConfluencePages) {
          console.log('Creating Jira issues and Confluence pages...');
          // TODO: Call AI analysis and create Jira/Confluence content
          // This will be implemented in the next step
        }
      } else {
        setError(data.error);
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box padding="large">
      <Stack space="large">
        {/* Header Section */}
        <Box>
          <Stack space="medium">
            <Heading size="large">GitHub Project Manager</Heading>
            
            <Box padding="medium">
              <Text>
                Transform any open source GitHub repository into a structured Jira project with 
                automatically generated issues, documentation, and roadmaps. Perfect for teams 
                adopting or contributing to open source projects.
              </Text>
            </Box>
          </Stack>
        </Box>

        {/* Main Form Section */}
        <Box padding="large">
          <Stack space="large">
            <Heading size="medium">Repository Configuration</Heading>

            <Form onSubmit={handleSubmit}>
              <Stack space="large">
                {/* GitHub URL Input */}
                <Box>
                  <Stack space="small">
                    <Text weight="semibold">GitHub Repository URL *</Text>
                    <Textfield
                      placeholder="https://github.com/owner/repository"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      isRequired
                    />
                    <Text size="small">
                      Enter the full GitHub repository URL you want to analyze and import
                    </Text>
                  </Stack>
                </Box>
                
                {/* GitHub Token Input */}
                <Box>
                  <Stack space="small">
                    <Text weight="semibold">GitHub Personal Access Token *</Text>
                    <Textfield
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      isRequired
                      type="password"
                    />
                    <Text size="small">
                      Your GitHub personal access token with repository read access
                    </Text>
                  </Stack>
                </Box>

                {/* Options Section */}
                <Box>
                  <Stack space="medium">
                    <Text weight="semibold">Import Options</Text>
                    
                    <Box padding="medium">
                      <Stack space="medium">
                        <Checkbox
                          isChecked={createJiraIssues}
                          onChange={(e) => setCreateJiraIssues(e.target.checked)}
                        >
                          <Stack space="small">
                            <Text weight="medium">Create Jira Issues</Text>
                            <Text size="small">
                              Convert GitHub issues and pull requests into Jira issues with proper categorization
                            </Text>
                          </Stack>
                        </Checkbox>
                        
                        <Checkbox
                          isChecked={createConfluencePages}
                          onChange={(e) => setCreateConfluencePages(e.target.checked)}
                        >
                          <Stack space="small">
                            <Text weight="medium">Create Confluence Pages</Text>
                            <Text size="small">
                              Generate documentation pages and project roadmaps from repository content
                            </Text>
                          </Stack>
                        </Checkbox>
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
                
                {/* Submit Button */}
                <Box>
                  <Button 
                    type="submit" 
                    appearance="primary"
                    isDisabled={isLoading || !githubUrl.trim() || !githubToken.trim()}
                  >
                    {isLoading ? 'Analyzing Repository...' : 'Import Project'}
                  </Button>
                </Box>
              </Stack>
            </Form>
          </Stack>
        </Box>

        {/* Loading State */}
        {isLoading && (
          <Box padding="large">
            <Stack space="medium">
              <Spinner />
              <Stack space="small">
                <Text weight="semibold">Analyzing Repository</Text>
                <Text size="small">
                  Fetching repository data, analyzing issues, and generating project insights...
                </Text>
              </Stack>
            </Stack>
          </Box>
        )}

        {/* Error State */}
        {error && (
          <SectionMessage appearance="error" title="Import Failed">
            <Text>{error}</Text>
          </SectionMessage>
        )}

        {/* Success State */}
        {result && (
          <SectionMessage appearance="success" title="Repository Analysis Complete">
            <Stack space="small">
              <Text>
                <Strong>Repository:</Strong> {githubUrl}
              </Text>
              <Text>
                <Strong>Issues/PRs found:</Strong> {result.issuesAndPRs?.length || 0}
              </Text>
              <Text>
                <Strong>Markdown files found:</Strong> {result.markdownFiles?.length || 0}
              </Text>
              <Text size="small">
                Next step: AI analysis and Jira/Confluence content creation will be implemented.
              </Text>
            </Stack>
          </SectionMessage>
        )}
      </Stack>
    </Box>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <View />
  </React.StrictMode>
);
