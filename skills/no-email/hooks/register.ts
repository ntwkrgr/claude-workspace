import type { Register } from 'claude-code';

// From https://github.com/AlexErrant/claude-code-no-email (MIT).
// Claude Code adds a `userEmail` block (from `oauthAccount.emailAddress` in
// ~/.claude.json) whenever you're signed in with claude.ai, and no setting
// turns it off. Filter it out of whatever the rest of the chain returns.
export const register: Register = on => {
  // Runs the rest of the prompt.context chain, then drops the userEmail block from its result
  on('prompt.context', async ($, e, next) => {
    const context = await next(e);
    return {
      ...context,
      blocks: context.blocks.filter(block => block.name !== 'userEmail'),
    };
  });
};
