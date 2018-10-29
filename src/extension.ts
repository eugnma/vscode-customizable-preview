'use strict';

import * as cp from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('customizablePreview.preview', () => {
        CustomizablePreviewManager.createOrShow(context.extensionPath, vscode.window.activeTextEditor);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('customizablePreview.selectRule', () => {
        CustomizablePreviewManager.selectRule();
    }));
}

class CustomizablePreviewManager {
    private static readonly _previewPanelTitlePrefix = "Preview ";
    private static readonly _reRuleName = /^[a-zA-Z0-9]([a-zA-Z0-9_ .-]*?[a-zA-Z0-9])?$/;
    private static readonly _defaultRules = [
        {
            "name": "HTML",
            "test": "x => x.languageId == 'html'",
            "directFromCommand": true
        }
    ];
    private static readonly _ruleNotFound = {
        "name": "??",
        "description": "No rule is matched"
    };
    private static _current: CustomizablePreviewManager | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _statusBar: vscode.StatusBarItem;
    private readonly _disposables: vscode.Disposable[] = [];
    private _sourceTextEditor: vscode.TextEditor;
    private _sourceLanguageId: string | undefined;
    private _rule: any;
    private _isRuleSpecified: boolean | undefined;
    private get staticRef() { return CustomizablePreviewManager; }

    private constructor(panel: vscode.WebviewPanel, statusBar: vscode.StatusBarItem, initialSourceTextEditor: vscode.TextEditor) {
        this._panel = panel;
        this._statusBar = statusBar;
        this._sourceTextEditor = initialSourceTextEditor;
    }

    public static createOrShow(extensionPath: string, initialSourceTextEditor: vscode.TextEditor | undefined) {
        const self = this;
        if (self._current || !initialSourceTextEditor) { return; }

        const normalizeResult = self._getNormalizedRules();
        if (!normalizeResult.success) {
            self._notifyInvalidRule(normalizeResult.invalidRule);
            return;
        }
        const panel = vscode.window.createWebviewPanel('customizablePreview', '', vscode.ViewColumn.Two);
        panel.iconPath = vscode.Uri.file(path.join(extensionPath, 'images/icon.png'));
        const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        statusBar.command = 'customizablePreview.selectRule';
        self._current = new CustomizablePreviewManager(panel, statusBar, initialSourceTextEditor);
        self._current._livePreview();
    }

    public static selectRule(autoMode: boolean | undefined = true) {
        const self = this;
        if (!self._current) { return; }
        const current = self._current;
        const groupNameFilter = autoMode && current._rule ? current._rule.groupName : undefined;
        const normalizeResult = self._getNormalizedRules(groupNameFilter);
        if (!normalizeResult.success) {
            self._notifyInvalidRule(normalizeResult.invalidRule);
            return;
        }
        const rules = normalizeResult.normalizedRules;
        const autoDetectQuickPickItem = '$(code) Auto Detect';
        const moreQuickPickItem = '$(ellipsis) More';
        const ruleQuickPickItemsPrefix = '$(search) ';
        const followingQuickPickItems = rules.map(x => `${ruleQuickPickItemsPrefix}${x.key}`).sort().concat(groupNameFilter ? [moreQuickPickItem] : []);
        const quickPickItems = [autoDetectQuickPickItem].concat(followingQuickPickItems);
        vscode.window.showQuickPick(quickPickItems).then(x => {
            if (x && current) {
                switch (x) {
                    case autoDetectQuickPickItem:
                        if (current._isRuleSpecified) {
                            current._isRuleSpecified = false;
                            current._preview();
                        }
                        break;
                    case moreQuickPickItem:
                        this.selectRule(false);
                        break;
                    default:
                        current._isRuleSpecified = true;
                        const ruleKey = x.substr(ruleQuickPickItemsPrefix.length);
                        if (current._rule.key !== ruleKey) {
                            current._rule = rules.find(x => x.key === ruleKey);
                            current._preview();
                        }
                        break;
                }
            }
        });
    }

    public dispose() {
        const self = this;
        self.staticRef._current = undefined;
        self._statusBar.dispose();
        self._panel.dispose();
        while (self._disposables.length) {
            const x = self._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _preview(textEditor?: vscode.TextEditor | undefined) {
        const self = this;
        textEditor && (self._sourceTextEditor = textEditor);
        const source = self.staticRef._getPreviewSource(self._sourceTextEditor);
        const normalizeResult = self.staticRef._getNormalizedRules();
        if (!normalizeResult.success) {
            self.staticRef._notifyInvalidRule(normalizeResult.invalidRule);
            return;
        }
        const rules = normalizeResult.normalizedRules;
        let rule = rules.find(x => self._isRuleSpecified ? x.key === self._rule.key : x.test(source));
        let candidate = undefined;
        if (rule) {
            self._rule = rule;
            candidate = rule.command ? cp.execSync(rule.command, { input: source.text }).toString() : source.text;
            self._statusBar.text = `$(chevron-left)$(search)$(chevron-right) ${rule.name}`;
            self._statusBar.tooltip = rule.description;
        } else {
            candidate = self.staticRef._ruleNotFound.description;
            self._statusBar.text = `$(chevron-left)$(search)$(chevron-right) ${self.staticRef._ruleNotFound.name}`;
            self._statusBar.tooltip = self.staticRef._ruleNotFound.description;
        }
        self._statusBar.show();
        self._panel.title = `${self.staticRef._previewPanelTitlePrefix}${source.filename}`;
        self._panel.webview.html = rule && rule.directFromCommand ? candidate : self.staticRef._getHtmlForWebview(candidate);
    }

    private _livePreview() {
        const self = this;
        self._panel.onDidDispose(() => self.dispose(), null, self._disposables);
        vscode.workspace.onDidChangeTextDocument(_e => {
            self._preview();
        }, null, self._disposables);
        vscode.window.onDidChangeActiveTextEditor(e => {
            e && ['file', 'untitled'].includes(e.document.uri.scheme) && self._preview(e);
        }, null, self._disposables);
        vscode.languages.onDidChangeDiagnostics(_e => {
            const source = self.staticRef._getPreviewSource(self._sourceTextEditor);
            if (self._sourceLanguageId !== source.languageId) {
                self._preview();
                self._sourceLanguageId = source.languageId;
            }
        }, null, self._disposables);
        self._preview();
    }

    private static _getPreviewSource(editor: vscode.TextEditor) {
        return {
            languageId: editor.document.languageId,
            filename: path.basename(editor.document.fileName),
            extname: path.extname(editor.document.fileName),
            text: editor.document.getText()
        };
    }

    private static _getNormalizedRules(groupName?: string | undefined) {
        const self = this;
        const settings = vscode.workspace.getConfiguration('customizablePreview');
        const customRules = settings.get<any[]>('rules') || [];
        const sourceRules = [...customRules, ...self._defaultRules];
        let result = [];
        let i,
            rule,
            invalidRule;
        for (i = 0; i < sourceRules.length; i++) {
            rule = sourceRules[i];
            invalidRule = (!rule.groupName || self._reRuleName.test(rule.groupName)) && self._reRuleName.test(rule.name) ? undefined : rule;
            if (invalidRule) { break; }
            try {
                result.push({
                    key: rule.groupName ? `${rule.groupName} (${rule.name})` : rule.name,
                    groupName: rule.groupName ? rule.groupName : undefined,
                    name: rule.name,
                    description: rule.description,
                    test: eval(`(${rule.test})`),
                    command: rule.command,
                    directFromCommand: rule.directFromCommand
                });
            } catch {
                invalidRule = rule;
                break;
            }
        }
        if (groupName) {
            result = result.filter(x => x.groupName === groupName);
        }
        return { success: !invalidRule, normalizedRules: result, invalidRule: invalidRule };
    }

    private static _notifyInvalidRule(rule: any) {
        vscode.window.showErrorMessage(`The rule is invalid: ${JSON.stringify(rule, undefined, 2)}`);
    }

    private static _getHtmlForWebview(htmlBody: string) {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Customizable Preview</title>
            </head>
            <body>
                ${htmlBody}
            </body>
            </html>`;
    }
}
