const vscode = require("vscode");
const OpenAI = require("openai");

module.exports = {
  activate: (ctx) => {
    let api;
    const initAPI = async () => {
      api = new OpenAI({ apiKey: await ctx.secrets.get("openai-key") });
    };
    initAPI();
    ctx.secrets.onDidChange((event) => {
      if (event.key === "openai-key") initAPI();
    });
    vscode.languages.registerInlineCompletionItemProvider(
      { pattern: "**" },
      {
        provideInlineCompletionItems: async (document, position) => {
          if (!api) {
            const res = await vscode.window.showErrorMessage(
              "You must configure an OpenAI API Key!",
              "Set Key"
            );
            if (res)
              await vscode.commands.executeCommand("picopilot.token");
            return;
          }
          const prefix = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
          const suffix = document.getText(new vscode.Range(position, document.positionAt(document.getText().length)));
          const prompt =
            vscode.workspace.getConfiguration("picopilot").get("prompt") || `You provide code completion results given a prefix and suffix.
Respond with a JSON object with the key 'completion' containing a suggestion to place between the prefix and suffix.
Follow existing code styles. Listen to comments at the end of the prefix. The language is "{language}".`;

          const response = await api.chat.completions.create({
            messages: [
              {
                role: "system",
                content: prompt.replace("{language}", document.languageId),
              },
              { role: "user", content: prefix },
              { role: "user", content: suffix },
            ],
            model: "gpt-4o",
            max_tokens: 500,
            response_format: { type: "json_object" },
          });
          const resp = JSON.parse(response.choices[0].message.content);
          return {
            items: [{ insertText: resp.completion.trim() }],
          };
        },
      }
    );
    vscode.commands.registerCommand("picopilot.token", async () => {
      await vscode.env.openExternal(
        vscode.Uri.parse("https://platform.openai.com/api-keys")
      );
      const res = await vscode.window.showInputBox({
        title: "OpenAI API Key",
        prompt: "Generate an API Key and paste it in!",
        ignoreFocusOut: true,
        password: true,
      });
      if (res) {
        await ctx.secrets.store("openai-key", res);
        vscode.window.showInformationMessage("PicoPilot is working!");
        initAPI();
      }
    });
  },
};
