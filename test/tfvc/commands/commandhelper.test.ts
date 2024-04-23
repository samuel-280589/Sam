/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
"use strict";

import { assert } from "chai";
import * as path from "path";

import { Strings } from "../../../src/helpers/strings";
import { IExecutionResult } from "../../../src/tfvc/interfaces";
import { TfvcError, TfvcErrorCodes } from "../../../src/tfvc/tfvcerror";
import { CommandHelper } from "../../../src/tfvc/commands/commandhelper";

describe("Tfvc-CommandHelper", function() {

    it("should verify RequireArgument - success", function() {
        let arg: any = { prop1: "prop 1" };
        CommandHelper.RequireArgument(arg, "arg");
    });

    it("should verify RequireArgument - failure", function() {
        let arg: any = undefined;
        assert.throws(() => CommandHelper.RequireArgument(arg, "arg"), TfvcError, /Argument is required/);
    });

    it("should verify RequireStringArgument - success", function() {
        let arg: string = "myString";
        CommandHelper.RequireStringArgument(arg, "arg");
    });

    it("should verify RequireStringArgument - failure", function() {
        let arg: string = "";
        assert.throws(() => CommandHelper.RequireStringArgument(arg, "arg"), TfvcError, /Argument is required/);
    });

    it("should verify RequireStringArrayArgument - success", function() {
        let arg: string[] = ["myString"];
        CommandHelper.RequireStringArrayArgument(arg, "arg");
    });

    it("should verify RequireStringArrayArgument - failure - empty array", function() {
        let arg: string[] = [];
        assert.throws(() => CommandHelper.RequireStringArrayArgument(arg, "arg"), TfvcError, /Argument is required/);
    });

    it("should verify RequireStringArrayArgument - failure - undefined", function() {
        let arg: string[] = undefined;
        assert.throws(() => CommandHelper.RequireStringArrayArgument(arg, "arg"), TfvcError, /Argument is required/);
    });

    it("should verify HasError - no errors", function() {
        let result: IExecutionResult = {
            exitCode: 123,
            stdout: undefined,
            stderr: undefined
        };
        assert.equal(CommandHelper.HasError(result, ".*"), false);
        assert.equal(CommandHelper.HasError(result, ""), false);
        assert.equal(CommandHelper.HasError(result, undefined), false);
        // Make sure undefined for result returns false as well
        assert.equal(CommandHelper.HasError(undefined, undefined), false);
    });

    it("should verify HasError - has errors", function() {
        let result: IExecutionResult = {
            exitCode: 123,
            stdout: undefined,
            stderr: "Something bad happened!"
        };
        assert.equal(CommandHelper.HasError(result, "Something bad happened!"), true);
        assert.equal(CommandHelper.HasError(result, "Something bad happened"), true);
        assert.equal(CommandHelper.HasError(result, "bad happened"), true);
        assert.equal(CommandHelper.HasError(result, " bad happened"), true);
        assert.equal(CommandHelper.HasError(result, "happened"), true);
        assert.equal(CommandHelper.HasError(result, "bad"), true);
        assert.equal(CommandHelper.HasError(result, "good"), false);
        assert.equal(CommandHelper.HasError(result, undefined), false);
    });

    it("should verify ProcessErrors - no errors", function() {
        let result: IExecutionResult = {
            exitCode: 0,
            stdout: undefined,
            stderr: undefined
        };
        CommandHelper.ProcessErrors("cmd", result, false);
    });

    it("should verify ProcessErrors - bad exit code only", function() {
        let result: IExecutionResult = {
            exitCode: 100,
            stdout: undefined,
            stderr: undefined
        };
        try {
            CommandHelper.ProcessErrors("cmd", result, false);
        } catch (err) {
            assert.equal(err.exitCode, 100);
            assert.equal(err.tfvcCommand, "cmd");
            assert.equal(err.message.indexOf(Strings.TfExecFailedError), 0);
            assert.equal(err.stdout, undefined);
        }
    });

    it("should verify ProcessErrors - auth failed", function() {
        let result: IExecutionResult = {
            exitCode: 100,
            stdout: undefined,
            stderr: "Authentication failed"
        };
        try {
            CommandHelper.ProcessErrors("cmd", result, false);
        } catch (err) {
            assert.equal(err.exitCode, 100);
            assert.equal(err.tfvcCommand, "cmd");
            assert.equal(err.tfvcErrorCode, TfvcErrorCodes.AuthenticationFailed);
            assert.equal(err.message.indexOf(Strings.TfExecFailedError), 0);
            assert.equal(err.stdout, undefined);
        }
    });

    it("should verify ProcessErrors - auth failed", function() {
        let result: IExecutionResult = {
            exitCode: 100,
            stdout: undefined,
            stderr: "workspace could not be determined"
        };
        try {
            CommandHelper.ProcessErrors("cmd", result, false);
        } catch (err) {
            assert.equal(err.exitCode, 100);
            assert.equal(err.tfvcCommand, "cmd");
            assert.equal(err.tfvcErrorCode, TfvcErrorCodes.NotATfvcRepository);
            assert.equal(err.message.indexOf(Strings.TfExecFailedError), 0);
            assert.equal(err.stdout, undefined);
        }
    });

    it("should verify ProcessErrors - no workspace", function() {
        let result: IExecutionResult = {
            exitCode: 100,
            stdout: undefined,
            stderr: "workspace could not be determined"
        };
        try {
            CommandHelper.ProcessErrors("cmd", result, false);
        } catch (err) {
            assert.equal(err.exitCode, 100);
            assert.equal(err.tfvcCommand, "cmd");
            assert.equal(err.tfvcErrorCode, TfvcErrorCodes.NotATfvcRepository);
            assert.equal(err.message.indexOf(Strings.TfExecFailedError), 0);
            assert.equal(err.stdout, undefined);
        }
    });

    it("should verify ProcessErrors - no repo", function() {
        let result: IExecutionResult = {
            exitCode: 100,
            stdout: undefined,
            stderr: "Repository not found"
        };
        try {
            CommandHelper.ProcessErrors("cmd", result, false);
        } catch (err) {
            assert.equal(err.exitCode, 100);
            assert.equal(err.tfvcCommand, "cmd");
            assert.equal(err.tfvcErrorCode, TfvcErrorCodes.RepositoryNotFound);
            assert.equal(err.message.indexOf(Strings.TfExecFailedError), 0);
            assert.equal(err.stdout, undefined);
        }
    });

    it("should verify ProcessErrors - no collection", function() {
        let result: IExecutionResult = {
            exitCode: 100,
            stdout: undefined,
            stderr: "project collection URL to use could not be determined"
        };
        try {
            CommandHelper.ProcessErrors("cmd", result, false);
        } catch (err) {
            assert.equal(err.exitCode, 100);
            assert.equal(err.tfvcCommand, "cmd");
            assert.equal(err.tfvcErrorCode, TfvcErrorCodes.NotATfvcRepository);
            assert.equal(err.message.indexOf(Strings.NotATfvcRepository), 0);
            assert.equal(err.stdout, undefined);
        }
    });

    it("should verify ProcessErrors - access denied", function() {
        let result: IExecutionResult = {
            exitCode: 100,
            stdout: undefined,
            stderr: "Access denied connecting: some other text: authenticating as OAuth"
        };
        try {
            CommandHelper.ProcessErrors("cmd", result, false);
        } catch (err) {
            assert.equal(err.exitCode, 100);
            assert.equal(err.tfvcCommand, "cmd");
            assert.equal(err.tfvcErrorCode, TfvcErrorCodes.AuthenticationFailed);
            assert.equal(err.message.indexOf(Strings.TokenNotAllScopes), 0);
            assert.equal(err.stdout, undefined);
        }
    });

    it("should verify ProcessErrors - no java", function() {
        let result: IExecutionResult = {
            exitCode: 100,
            stdout: undefined,
            stderr: "'java' is not recognized as an internal or external command"
        };
        try {
            CommandHelper.ProcessErrors("cmd", result, false);
        } catch (err) {
            assert.equal(err.exitCode, 100);
            assert.equal(err.tfvcCommand, "cmd");
            assert.equal(err.tfvcErrorCode, TfvcErrorCodes.TfvcNotFound);
            assert.equal(err.message.indexOf(Strings.TfInitializeFailureError), 0);
            assert.equal(err.stdout, undefined);
        }
    });

    it("should verify ProcessErrors - no mapping", function() {
        let result: IExecutionResult = {
            exitCode: 100,
            stdout: undefined,
            stderr: "There is no working folder mapping"
        };
        try {
            CommandHelper.ProcessErrors("cmd", result, false);
        } catch (err) {
            assert.equal(err.exitCode, 100);
            assert.equal(err.tfvcCommand, "cmd");
            assert.equal(err.tfvcErrorCode, TfvcErrorCodes.FileNotInMappings);
            assert.equal(err.message.indexOf(Strings.TfExecFailedError), 0);
            assert.equal(err.stdout, undefined);
        }
    });

    it("should verify ProcessErrors - not in workspace", function() {
        let result: IExecutionResult = {
            exitCode: 100,
            stdout: undefined,
            stderr: "could not be found in your workspace, or you do not have permission to access it."
        };
        try {
            CommandHelper.ProcessErrors("cmd", result, false);
        } catch (err) {
            assert.equal(err.exitCode, 100);
            assert.equal(err.tfvcCommand, "cmd");
            assert.equal(err.tfvcErrorCode, TfvcErrorCodes.FileNotInWorkspace);
            assert.equal(err.message.indexOf(Strings.TfExecFailedError), 0);
            assert.equal(err.stdout, undefined);
        }
    });

    it("should verify ProcessErrors - showFirstError - stderr", function() {
        let result: IExecutionResult = {
            exitCode: 100,
            stdout: undefined,
            stderr: "something bad"
        };
        try {
            CommandHelper.ProcessErrors("cmd", result, true);
        } catch (err) {
            assert.equal(err.exitCode, 100);
            assert.equal(err.tfvcCommand, "cmd");
            assert.equal(err.tfvcErrorCode, TfvcErrorCodes.UnknownError);
            assert.equal(err.message.indexOf("something bad"), 0);
            assert.equal(err.stdout, undefined);
        }
    });

    it("should verify ProcessErrors - showFirstError - stdout", function() {
        let result: IExecutionResult = {
            exitCode: 100,
            stdout: "something bad",
            stderr: undefined
        };
        try {
            CommandHelper.ProcessErrors("cmd", result, true);
        } catch (err) {
            assert.equal(err.exitCode, 100);
            assert.equal(err.tfvcCommand, "cmd");
            assert.equal(err.tfvcErrorCode, TfvcErrorCodes.UnknownError);
            assert.equal(err.message.indexOf("something bad"), 0);
            assert.equal(err.stdout, "something bad");
        }
    });

    it("should verify SplitIntoLines", function() {
        let text: string = "one\ntwo\r\nthree\r\nfour\nfive\n";
        let lines: string[] = CommandHelper.SplitIntoLines(text);
        assert.equal(lines.length, 6);
        assert.equal(lines[0], "one");
        assert.equal(lines[1], "two");
        assert.equal(lines[2], "three");
        assert.equal(lines[3], "four");
        assert.equal(lines[4], "five");
        assert.equal(lines[5], "");
    });

    it("should verify SplitIntoLines - undefined input", function() {
        let text: string;
        let lines: string[] = CommandHelper.SplitIntoLines(text);
        assert.isDefined(lines);
        assert.equal(lines.length, 0);
    });

    it("should verify SplitIntoLines - empty input", function() {
        let text: string = "";
        let lines: string[] = CommandHelper.SplitIntoLines(text);
        assert.isDefined(lines);
        assert.equal(lines.length, 0);
    });

    it("should verify SplitIntoLines - trim WARNings", function() {
        let text: string = "WARN 1\nWARN 2\nwarning\none\ntwo\r\n\n";
        let lines: string[] = CommandHelper.SplitIntoLines(text);
        assert.equal(lines.length, 5);
        assert.equal(lines[0], "warning");
        assert.equal(lines[1], "one");
        assert.equal(lines[2], "two");
        assert.equal(lines[3], "");
        assert.equal(lines[4], "");
    });

    it("should verify SplitIntoLines - leave WARNings", function() {
        let text: string = "WARN 1\nWARN 2\nwarning\none\ntwo\r\n\n";
        let lines: string[] = CommandHelper.SplitIntoLines(text, false);
        assert.equal(lines.length, 7);
        assert.equal(lines[0], "WARN 1");
        assert.equal(lines[1], "WARN 2");
        assert.equal(lines[2], "warning");
        assert.equal(lines[3], "one");
        assert.equal(lines[4], "two");
        assert.equal(lines[5], "");
        assert.equal(lines[6], "");
    });

    it("should verify SplitIntoLines - filter empty lines", function() {
        let text: string = "zero\n      \none\ntwo\r\n"; //ensure there's a line with just spaces too
        let lines: string[] = CommandHelper.SplitIntoLines(text, false, true);
        assert.equal(lines.length, 3);
        assert.equal(lines[0], "zero");
        assert.equal(lines[1], "one");
        assert.equal(lines[2], "two");
    });

    it("should verify SplitIntoLines - leave empty lines", function() {
        let text: string = "one\ntwo\n\nthree\nfour\n\n";
        let lines: string[] = CommandHelper.SplitIntoLines(text);
        assert.equal(lines.length, 7);
        assert.equal(lines[0], "one");
        assert.equal(lines[1], "two");
        assert.equal(lines[2], "");
        assert.equal(lines[3], "three");
        assert.equal(lines[4], "four");
        assert.equal(lines[5], "");
        assert.equal(lines[6], "");
    });

    it("should verify TrimToXml", async function() {
        let text: string = "WARN 1\nWARN 2\nwarning\n<?xml version=\"1.0\" encoding=\"utf-8\"?>\r\n<status>\r\n</status>\n\n";
        let xml: string = CommandHelper.TrimToXml(text);
        assert.equal(xml, "<?xml version=\"1.0\" encoding=\"utf-8\"?>\r\n<status>\r\n</status>");
    });

    it("should verify TrimToXml - empty values", async function() {
        assert.equal(CommandHelper.TrimToXml(undefined), undefined);
        assert.equal(CommandHelper.TrimToXml(""), "");
    });

    it("should verify ParseXml", async function() {
        let text: string = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\r\n<one attr1=\"35\" attr2=\"two\"><child1 attr1=\"44\" attr2=\"55\" attr3=\"three\"/><child2>child two</child2>\r\n</one>\n\n";
        let xml: any = await CommandHelper.ParseXml(text);
        let expectedJSON = {
            "one": {
                "$": {
                    "attr1": "35",
                    "attr2": "two"
                },
                "child1": [{
                    "$": {
                        "attr1": "44",
                        "attr2": "55",
                        "attr3": "three"
                    }
                }],
                "child2": [
                    "child two"
                    ]
                }
            };
        assert.equal(JSON.stringify(xml), JSON.stringify(expectedJSON));
    });

    it("should verify GetChangesetNumber", async function() {
        let text: string = "/Users/leantk/tfvc-tfs/tfsTest_01/addFold:\n" +
                    "Checking in edit: testHere.txt\n" +
                    "\n" +
                    "/Users/leantk/tfvc-tfs/tfsTest_01:\n" +
                    "Checking in edit: test3.txt\n" +
                    "Checking in edit: TestAdd.txt\n" +
                    "\n" +
                    "Changeset #23 checked in.\n";
        let changeset: string = CommandHelper.GetChangesetNumber(text);
        assert.equal(changeset, "23");
    });

    it("should verify GetChangesetNumber - exact", async function() {
        let text: string = "Changeset #20 checked in.";
        let changeset: string = CommandHelper.GetChangesetNumber(text);
        assert.equal(changeset, "20");
    });

    it("should verify GetChangesetNumber - no match", async function() {
        let text: string = "WARN 1\nWARN 2\ntext\nChangeset # checked in.\n\r\ntext\r\nmore text\n\n";
        let changeset: string = CommandHelper.GetChangesetNumber(text);
        assert.equal(changeset, "");
    });

    it("should verify GetNewLineCharacter", async function() {
        assert.equal(CommandHelper.GetNewLineCharacter(undefined), "\n");
        assert.equal(CommandHelper.GetNewLineCharacter(""), "\n");
        assert.equal(CommandHelper.GetNewLineCharacter("blah blah\nblah blah\n\rblah\nblah"), "\n");
        assert.equal(CommandHelper.GetNewLineCharacter("blah blah\nblah blah\n\rblah\r\nblah"), "\r\n");
        assert.equal(CommandHelper.GetNewLineCharacter("blah /r/nblah blah/n blah\r blah\r blah"), "\n");
    });

    it("should verify GetFilePath", async function() {
        assert.equal(CommandHelper.GetFilePath(undefined, undefined, undefined), undefined);
        assert.equal(CommandHelper.GetFilePath("/path/folder", "file.txt", undefined), path.join("/path/folder", "file.txt"));
        assert.equal(CommandHelper.GetFilePath("/path/folder:", "file.txt", undefined), path.join("/path/folder", "file.txt"));
        assert.equal(CommandHelper.GetFilePath(undefined, "file.txt", undefined), "file.txt");
        assert.equal(CommandHelper.GetFilePath("/path/folder", undefined, undefined), "/path/folder");
        assert.equal(CommandHelper.GetFilePath("/path/folder:", undefined, undefined), "/path/folder");
        assert.equal(CommandHelper.GetFilePath("folder:", "file.txt", undefined), path.join("folder", "file.txt"));
        assert.equal(CommandHelper.GetFilePath("folder:", "file.txt", "/root"), path.join("/root/folder", "file.txt"));
        assert.equal(CommandHelper.GetFilePath(undefined, "file.txt", "/root"), path.join("/root", "file.txt"));
    });
});
