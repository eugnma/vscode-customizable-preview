'use strict';

import * as cp from 'child_process';
import { commandArgv } from './util/command-argv';

export class CommandExecutor {
    private _childProcess: cp.ChildProcess;

    public constructor(options: {
        command: string;
        input?: string;
        cwd?: string;
        callback: (killed: boolean, error: string | undefined, result?: string) => void;
    }) {
        // On Linux, child processes of child processes will not be terminated when attempting to kill their parent.
        // Use parsing the argv of commands instead of passing shell option with true to avoid the problem.
        // (https://nodejs.org/api/child_process.html#child_process_subprocess_kill_signal)
        const argv = commandArgv(options.command);
        const cpOptions: cp.SpawnOptions = {
            cwd: options.cwd
        };

        this._childProcess = cp.spawn(argv[0], argv.slice(1), cpOptions);
        this._invoke(options.input || '', options.callback);
    }

    public kill(): void {
        const self = this;
        // Destroy stdin to prevent SIGPIPE signals.
        self._childProcess.stdin.destroy();
        self._childProcess.kill();
    }

    private _invoke(
        input: string,
        callback: (killed: boolean, error: string | undefined, result?: string) => void
    ): void {
        const self = this,
            childProcess = self._childProcess;
        const result = { stdout: '', errMsg: '' };
        childProcess.stdout.on('data', (data): void => {
            result.stdout += String(data);
        });
        childProcess.stderr.on('data', (data): void => {
            result.stdout = '';
            result.errMsg += String(data);
        });
        const onChildProcessEnd = (success: boolean): void => success ? callback(childProcess.killed, undefined, result.stdout) : callback(childProcess.killed, result.errMsg);
        // The 'exit' event may or may not fire after an error has occurred.
        // (https://nodejs.org/api/child_process.html#child_process_event_error)
        childProcess.on('error', (err): void => {
            result.errMsg = err.message;
            onChildProcessEnd(false);
        });
        childProcess.on('exit', (code, _signal): void => onChildProcessEnd(code === 0));
        // Always check pid before using stdin to prevent SIGPIPE signals.
        // (https://github.com/nodejs/help/issues/1191)
        if (childProcess.pid) {
            childProcess.stdin.write(input);
            childProcess.stdin.end();
        }
    }
}
