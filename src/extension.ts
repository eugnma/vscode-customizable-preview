'use strict';

import * as path from 'path';
import * as vscode from 'vscode';
import { CommandExecutor } from './commandExecutor';

interface PreviewSource {
    languageId: string;
    filename: string;
    extname: string;
    dirname?: string;
    isUntitled: boolean;
    text: string;
}

interface Rule {
    key: string;
    groupName?: string;
    name: string;
    description?: string;
    test: TestFunc;
    command?: StandardCommand;
    directFromCommand?: boolean;
}

interface RuleConfig {
    groupName?: string;
    name: string;
    description?: string;
    test: string;
    command: CommandConfig;
    directFromCommand?: boolean;
}

interface SingleCommandFunc {
    (source: PreviewSource): string;
}

interface StandardCommand {
    saved: SingleCommand;
    unsaved: SingleCommand;
}

interface TestFunc {
    (source: PreviewSource): boolean;
}

type SingleCommand = string | SingleCommandFunc;
type CommandConfig = string | { saved: string; unsaved: string };

class CustomizablePreviewManager {
    private static readonly _defaultRules: RuleConfig[] = [
        {
            "name": "HTML",
            "test": "x => x.languageId == 'html'",
            "command": "",
            "directFromCommand": true
        }
    ];
    private static readonly _ruleNotFound = {
        "name": "??",
        "description": "No rule is matched"
    };
    private static readonly _previewPanelTitlePrefix = "Preview ";
    private static readonly _statusBarIcon = "$(chevron-left)$(search)$(chevron-right)";
    private static readonly _reRuleName = /^[a-zA-Z0-9]([a-zA-Z0-9_ .-]*?[a-zA-Z0-9])?$/;
    private static readonly _reCommandFunction = /[a-z_$][a-z_$0-9]*?(?: )+?=>(?: )+?[^ ]+?/i;
    private static _current?: CustomizablePreviewManager;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _statusBar: vscode.StatusBarItem;
    private readonly _disposables: vscode.Disposable[] = [];
    private _sourceTextEditor: vscode.TextEditor;
    private _sourceLanguageId?: string;
    private _rule?: Rule;
    private _isRuleSpecified?: boolean;
    private _executingCommand?: CommandExecutor;
    private get staticRef(): typeof CustomizablePreviewManager { return CustomizablePreviewManager; }

    private constructor(panel: vscode.WebviewPanel, statusBar: vscode.StatusBarItem, initialSourceTextEditor: vscode.TextEditor) {
        this._panel = panel;
        this._statusBar = statusBar;
        this._sourceTextEditor = initialSourceTextEditor;
    }

    public static createOrShow(extensionPath: string, initialSourceTextEditor?: vscode.TextEditor): void {
        const self = this;
        if (self._current || !initialSourceTextEditor) { return; }

        const normalizeResult = self._getNormalizedRules();
        if (!normalizeResult.success) {
            self._notifyInvalidRule(normalizeResult.invalidRule as RuleConfig);
            return;
        }
        const panel = vscode.window.createWebviewPanel('customizablePreview', '', vscode.ViewColumn.Two);
        panel.iconPath = vscode.Uri.file(path.join(extensionPath, 'images/icon.png'));
        const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        statusBar.command = 'customizablePreview.selectRule';
        statusBar.show();
        self._current = new CustomizablePreviewManager(panel, statusBar, initialSourceTextEditor);
        self._current._livePreview();
    }

    public static selectRule(autoMode: boolean | undefined = true): void {
        const self = this;
        if (!self._current) { return; }
        const current = self._current;
        const groupNameFilter = autoMode && current._rule ? current._rule.groupName : undefined;
        const normalizeResult = self._getNormalizedRules(groupNameFilter);
        if (!normalizeResult.success) {
            self._notifyInvalidRule(normalizeResult.invalidRule as RuleConfig);
            return;
        }
        const rules = normalizeResult.normalizedRules;
        const autoDetectQuickPickItem = '$(code) Auto Detect';
        const moreQuickPickItem = '$(ellipsis) More';
        const ruleQuickPickItemsPrefix = '$(search) ';
        const followingQuickPickItems = rules.map((x): string => `${ruleQuickPickItemsPrefix}${x.key}`).sort().concat(groupNameFilter ? [moreQuickPickItem] : []);
        const quickPickItems = [autoDetectQuickPickItem].concat(followingQuickPickItems);
        vscode.window.showQuickPick(quickPickItems).then((x): void => {
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
                        if (!current._rule || current._rule.key !== ruleKey) {
                            current._rule = rules.find((x): boolean => x.key === ruleKey);
                            current._preview();
                        }
                        break;
                }
            }
        });
    }

    public dispose(): void {
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

    private _preview(textEditor?: vscode.TextEditor): void {
        const self = this;
        if (self._executingCommand) {
            self._executingCommand.kill();
        }
        textEditor && (self._sourceTextEditor = textEditor);
        const source = self.staticRef._getPreviewSource(self._sourceTextEditor);
        const normalizeResult = self.staticRef._getNormalizedRules();
        if (!normalizeResult.success) {
            self.staticRef._notifyInvalidRule(normalizeResult.invalidRule as RuleConfig);
            return;
        }
        const rules = normalizeResult.normalizedRules;
        const rule = rules.find((x): boolean => self._isRuleSpecified ? x.key === (self._rule as Rule).key : x.test(source));
        self._panel.title = `${self.staticRef._previewPanelTitlePrefix}${source.filename}`;
        if (!rule) {
            self._statusBar.text = `${self.staticRef._statusBarIcon} ${self.staticRef._ruleNotFound.name}`;
            self._statusBar.tooltip = self.staticRef._ruleNotFound.description;
            self._panel.webview.html = self.staticRef._getHtmlForWebview(self.staticRef._ruleNotFound.description);
            return;
        }
        self._rule = rule;
        self._statusBar.text = `${self.staticRef._statusBarIcon} ${rule.name}`;
        self._statusBar.tooltip = rule.description;
        if (!rule.command) {
            self._statusBar.color = undefined;
            self._panel.webview.html = rule.directFromCommand ? source.text : self.staticRef._getHtmlForWebview(source.text);
            return;
        }
        const candidateCommand = !source.isUntitled ? rule.command.saved : rule.command.unsaved;
        const actualCommand = this.staticRef._getCommandString(candidateCommand, source);
        self._executingCommand = new CommandExecutor({
            command: actualCommand,
            input: source.text,
            cwd: source.dirname,
            callback: (killed, error, result): void => {
                self._executingCommand = undefined;
                if (error === undefined) {
                    self._statusBar.color = undefined;
                    const candidate = result || '';
                    self._panel.webview.html = rule.directFromCommand ? candidate : self.staticRef._getHtmlForWebview(candidate);
                } else if (!killed) {
                    self._statusBar.color = 'red';
                    self._panel.webview.html = self.staticRef._getHtmlForWebview(error || '');
                }
            }
        });
    }

    private _livePreview(): void {
        const self = this;
        self._panel.onDidDispose((): void => self.dispose(), null, self._disposables);
        vscode.workspace.onDidChangeTextDocument((_e): void => {
            self._preview();
        }, null, self._disposables);
        vscode.window.onDidChangeActiveTextEditor((e): void => {
            self._rule = undefined;
            e && ['file', 'untitled'].includes(e.document.uri.scheme) && self._preview(e);
        }, null, self._disposables);
        vscode.languages.onDidChangeDiagnostics((_e): void => {
            const source = self.staticRef._getPreviewSource(self._sourceTextEditor);
            if (self._sourceLanguageId !== source.languageId) {
                self._preview();
                self._sourceLanguageId = source.languageId;
            }
        }, null, self._disposables);
        self._preview();
    }

    private static _getPreviewSource(editor: vscode.TextEditor): PreviewSource {
        return {
            languageId: editor.document.languageId,
            filename: path.basename(editor.document.fileName),
            extname: path.extname(editor.document.fileName),
            dirname: !editor.document.isUntitled ? path.dirname(editor.document.fileName) : undefined,
            isUntitled: editor.document.isUntitled,
            text: editor.document.getText()
        };
    }

    private static _getNormalizedRules(groupName?: string): {
        success: boolean;
        normalizedRules: Rule[];
        invalidRule?: RuleConfig;
    } {
        const self = this;
        const settings = vscode.workspace.getConfiguration('customizablePreview');
        const customRules = settings.get<RuleConfig[]>('rules') || [];
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
                    test: eval(`(${rule.test})`) as TestFunc,
                    command: this._normalizeCommand(rule.command),
                    directFromCommand: rule.directFromCommand
                });
            } catch {
                invalidRule = rule;
                break;
            }
        }
        if (groupName) {
            result = result.filter((x): boolean => x.groupName === groupName);
        }
        return { success: !invalidRule, normalizedRules: result, invalidRule: invalidRule };
    }

    private static _normalizeCommand(command: CommandConfig): StandardCommand | undefined {
        return command ? {
            saved: this._normalizeSingleCommand(typeof (command) !== 'string' ? command.saved : command),
            unsaved: this._normalizeSingleCommand(typeof (command) !== 'string' ? command.unsaved : command)
        } : undefined;
    }

    private static _normalizeSingleCommand(command: string): SingleCommand {
        return this._reCommandFunction.test(command) ? eval(`(${command})`) as SingleCommandFunc : command;
    }

    private static _getCommandString(command: SingleCommand, source: PreviewSource): string {
        return typeof (command) === 'string' ? command : command(source);
    }

    private static _notifyInvalidRule(rule: RuleConfig): void {
        vscode.window.showErrorMessage(`The rule is invalid: ${JSON.stringify(rule, undefined, 2)}`);
    }

    private static _getHtmlForWebview(htmlBody: string): string {
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

export function activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(vscode.commands.registerCommand('customizablePreview.preview', (): void => {
        CustomizablePreviewManager.createOrShow(context.extensionPath, vscode.window.activeTextEditor);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('customizablePreview.selectRule', (): void => {
        CustomizablePreviewManager.selectRule();
    }));
}
