/** Demonstration-only facade. This is NOT an MCP endpoint or a secure remote integration. */
export function createWriteOnlyGateway(workspace) {
  return Object.freeze({
    acceptContribution: ({ requestId, title, body }) => workspace.submitContribution({ requestId, title, body }),
  });
}
