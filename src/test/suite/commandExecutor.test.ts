import * as assert from 'assert';
import * as os from 'os';
import { CommandExecutor } from '../../commandExecutor';

suite("CommandInvoker", function (): void {
    test("Execute existing commands without killing", function (done): void {
        new CommandExecutor({
            command: 'node -',
            input: 'console.log(1)',
            callback: (killed, error, result): void => {
                assert.strictEqual(killed, false);
                assert.strictEqual(error, undefined);
                assert.strictEqual(result, `1${os.EOL}`);
                done();
            }
        });
    });

    test("Execute non-existing commands without killing", function (done): void {
        new CommandExecutor({
            command: 'this_is_a_nonexisting_command --version',
            callback: (killed, error, result): void => {
                assert.strictEqual(killed, false);
                assert.ok(error !== undefined);
                assert.strictEqual(result, undefined);
                done();
            }
        });
    });

    test("Execute existing commands with killing", function (done): void {
        this.timeout(5000);
        new CommandExecutor({
            command: 'node -',
            input: 'setTimeout(function() {}, 10000)',
            callback: (killed, error, result): void => {
                assert.strictEqual(killed, true);
                assert.ok(error !== undefined);
                assert.strictEqual(result, undefined);
                done();
            }
        }).kill();
    });

    test("Execute non-existing commands with killing", function (done): void {
        new CommandExecutor({
            command: 'this_is_a_nonexisting_command --version',
            callback: (killed, error, result): void => {
                assert.strictEqual(killed, false);
                assert.ok(error !== undefined);
                assert.strictEqual(result, undefined);
                done();
            }
        });
    });
});