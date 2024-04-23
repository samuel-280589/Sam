/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
"use strict";

import * as path from "path";

import { parseString } from "xml2js";
import { Logger } from "../../helpers/logger";
import { Strings } from "../../helpers/strings";
import { TfvcError, TfvcErrorCodes } from "../tfvcerror";
import { IExecutionResult } from "../interfaces";

export class CommandHelper {
    public static RequireArgument(argument: any, argumentName: string) {
        if (!argument) {
            throw TfvcError.CreateArgumentMissingError(argumentName);
        }
    }

    public static RequireStringArgument(argument: string, argumentName: string) {
        if (!argument || argument.trim().length === 0) {
            throw TfvcError.CreateArgumentMissingError(argumentName);
        }
    }

    public static RequireStringArrayArgument(argument: string[], argumentName: string) {
        if (!argument || argument.length === 0) {
            throw TfvcError.CreateArgumentMissingError(argumentName);
        }
    }

    public static HasError(result: IExecutionResult, errorPattern: string): boolean {
        if (result && result.stderr && errorPattern) {
            return new RegExp(errorPattern, "i").test(result.stderr);
        }
        return false;
    }

    public static ProcessErrors(command: string, result: IExecutionResult, showFirstError?: boolean): void {
        if (result.exitCode) {
            let tfvcErrorCode: string = TfvcErrorCodes.UnknownError;
            let message: string;

            if (/Authentication failed/.test(result.stderr)) {
                tfvcErrorCode = TfvcErrorCodes.AuthenticationFailed;
            } else if (/workspace could not be determined/.test(result.stderr) ||
                       /The workspace could not be determined from any argument paths or the current working directory/.test(result.stderr) || // CLC error
                       /Unable to determine the source control server/.test(result.stderr)) { // EXE error
                tfvcErrorCode = TfvcErrorCodes.NotATfvcRepository;
                message = Strings.NoWorkspaceMappings;
            } else if (/Repository not found/.test(result.stderr)) {
                tfvcErrorCode = TfvcErrorCodes.RepositoryNotFound;
            } else if (/project collection URL to use could not be determined/i.test(result.stderr)) {
                tfvcErrorCode = TfvcErrorCodes.NotATfvcRepository;
                message = Strings.NotATfvcRepository;
            } else if (/Access denied connecting.*authenticating as OAuth/i.test(result.stderr)) {
                tfvcErrorCode = TfvcErrorCodes.AuthenticationFailed;
                message = Strings.TokenNotAllScopes;
            } else if (/'java' is not recognized as an internal or external command/.test(result.stderr)) {
                tfvcErrorCode = TfvcErrorCodes.TfvcNotFound;
                message = Strings.TfInitializeFailureError;
            } else if (/There is no working folder mapping/i.test(result.stderr)) {
                tfvcErrorCode = TfvcErrorCodes.FileNotInMappings;
            } else if (/could not be found in your workspace, or you do not have permission to access it./i.test(result.stderr)) {
                tfvcErrorCode = TfvcErrorCodes.FileNotInWorkspace;
            } else if (showFirstError) {
                message = result.stderr ? result.stderr : result.stdout;
            }

            Logger.LogDebug(`TFVC errors: ${result.stderr}`);

            throw new TfvcError({
                message: message || Strings.TfExecFailedError,
                stdout: result.stdout,
                stderr: result.stderr,
                exitCode: result.exitCode,
                tfvcErrorCode: tfvcErrorCode,
                tfvcCommand: command
            });
        }
    }

    /**
     * This method is used by Checkin to parse out the changeset number.
     */
    public static GetChangesetNumber(stdout: string): string {
        // parse output for changeset number
        if (stdout) {
            let prefix: string = "Changeset #";
            let start: number = stdout.indexOf(prefix) + prefix.length;
            if (start >= 0) {
                let end: number = stdout.indexOf(" ", start);
                if (end > start) {
                    return stdout.slice(start, end);
                }
            }
        }
        return "";
    }

    public static GetNewLineCharacter(stdout: string): string {
        if (stdout && /\r\n/.test(stdout)) {
            return "\r\n";
        }
        return "\n";
    }

    public static SplitIntoLines(stdout: string, skipWarnings?: boolean, filterEmptyLines?: boolean): string[] {
        if (!stdout) {
            return [];
        }
        let lines: string[] = stdout.replace(/\r\n/g, "\n").split("\n");
        skipWarnings = skipWarnings === undefined ? true : skipWarnings;

        // Ignore WARNings that may be above the desired lines
        if (skipWarnings) {
            let index: number = 0;
            while (index < lines.length && lines[index].startsWith("WARN")) {
                index++;
            }
            lines = lines.splice(index);
        }
        if (filterEmptyLines) {
            lines = lines.filter(e => e.trim() !== "");
        }
        return lines;
    }

    public static async ParseXml(xml: string): Promise<any> {
        if (!xml) {
            return;
        }

        return new Promise<any>((resolve, reject) => {
            parseString(
                xml,
                {
                    tagNameProcessors: [CommandHelper.normalizeName],
                    attrNameProcessors: [CommandHelper.normalizeName]
                },
                (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            });
    }

    public static TrimToXml(xml: string): string {
        if (xml) {
            const start: number = xml.indexOf("<?xml");
            const end: number = xml.lastIndexOf(">");
            if (start >= 0 && end > start) {
                return xml.slice(start, end + 1);
            }
        }
        return xml;
    }

    private static normalizeName(name: string): string {
        if (name) {
            return name.replace(/\-/g, "").toLowerCase();
        }
        return name;
    }

    /**
     * Returns true if the line is of the form...
     * 'folder1:' or 'folder1\folder2:' or 'd:\folder1\folder2:'
     */
    public static IsFilePath(line: string): boolean {
        if (line && line.length > 0 && line.endsWith(":", line.length)) {
            return true;
        }
        return false;
    }

    /**
     * Returns the full path of the file where...
     * filePath could be 'folder1\folder2:'
     * filename is something like 'file.txt'
     * pathRoot is the root of any relative paths
     */
    public static GetFilePath(filePath: string, filename: string, pathRoot?: string): string {
        let folderPath: string = filePath;
        //Remove any ending ':'
        if (filePath && filePath.length > 0 && filePath.endsWith(":", filePath.length)) {
            folderPath = filePath.slice(0, filePath.length - 1);
        }
        //If path isn't rooted, add in the root
        if (folderPath && !path.isAbsolute(folderPath) && pathRoot) {
            folderPath = path.join(pathRoot, folderPath);
        } else if (!folderPath && pathRoot) {
            folderPath = pathRoot;
        }

        if (folderPath && filename) {
            return path.join(folderPath, filename);
        } else if (filename) {
            return filename;
        } else {
            return folderPath;
        }
    }
}
