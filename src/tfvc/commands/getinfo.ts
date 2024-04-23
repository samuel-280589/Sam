/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
"use strict";

import { TeamServerContext} from "../../contexts/servercontext";
import { IArgumentProvider, IExecutionResult, IItemInfo, ITfvcCommand } from "../interfaces";
import { ArgumentBuilder } from "./argumentbuilder";
import { CommandHelper } from "./commandhelper";

/**
 * This command calls Info which returns local and server information about an item in the workspace.
 * <p/>
 * info [/recursive] [/version:<value>] <itemSpec>...
 */
export class GetInfo implements ITfvcCommand<IItemInfo[]> {
    private _serverContext: TeamServerContext;
    private _itemPaths: string[];

    public constructor(serverContext: TeamServerContext, itemPaths: string[]) {
        CommandHelper.RequireStringArrayArgument(itemPaths, "itemPaths");
        this._serverContext = serverContext;
        this._itemPaths = itemPaths;
    }

    public GetArguments(): IArgumentProvider {
        return new ArgumentBuilder("info", this._serverContext)
            .AddAll(this._itemPaths);
    }

    public GetOptions(): any {
        return {};
    }

    /**
     * Example of output
     * Local information:
     * Local path:  D:\tmp\TFVC_1\build.xml
     * Server path: $/TFVC_1/build.xml
     * Changeset:   18
     * Change:      none
     * Type:        file
     * Server information:
     * Server path:   $/TFVC_1/build.xml
     * Changeset:     18
     * Deletion ID:   0
     * Lock:          none
     * Lock owner:
     * Last modified: Nov 18, 2016 11:10:20 AM
     * Type:          file
     * File type:     windows-1252
     * Size:          1385
     */
    public async ParseOutput(executionResult: IExecutionResult): Promise<IItemInfo[]> {
        // Throw if any errors are found in stderr or if exitcode is not 0
        CommandHelper.ProcessErrors(this.GetArguments().GetCommand(), executionResult);

        let itemInfos: IItemInfo[] = [];
        if (!executionResult.stdout) {
            return itemInfos;
        }

        const lines: string[] = CommandHelper.SplitIntoLines(executionResult.stdout);
        let curMode: string = ""; // "" is local mode, "server" is server mode
        let curItem: IItemInfo;
        for (let i: number = 0; i < lines.length; i++) {
            const line: string = lines[i];
            if (!line || line.trim().length === 0) {
                continue;
            }
            if (line.toLowerCase().startsWith("local information:")) {
                // We are starting a new Info section for the next item.
                // So, finish off any in progress item and start a new one.
                curMode = "";
                if (curItem !== undefined) {
                    itemInfos.push(curItem);
                }
                curItem = { serverItem: undefined, localItem: undefined };
            } else if (line.toLowerCase().startsWith("server information:")) {
                // We finished with the local properties and are starting the server properties
                curMode = "server ";
            } else {
                // Add the property to the current item
                const colonPos: number = line.indexOf(":");
                if (colonPos > 0) {
                    const propertyName = this.getPropertyName(curMode + line.slice(0, colonPos).trim().toLowerCase());
                    if (propertyName) {
                        const propertyValue = colonPos + 1 < line.length ? line.slice(colonPos + 1).trim() : "";
                        curItem[propertyName] = propertyValue;
                    }
                }
            }
        }
        if (curItem !== undefined) {
            itemInfos.push(curItem);
        }

        return itemInfos;
    }

    private getPropertyName(name: string): string {
        switch (name) {
            case "server path": return "serverItem";
            case "local path": return "localItem";
            case "server changeset": return "serverVersion";
            case "changeset": return "localVersion";
            case "change": return "change";
            case "type": return "type";
            case "server lock": return "lock";
            case "server lock owner": return "lockOwner";
            case "server deletion id": return "deletionId";
            case "server last modified": return "lastModified";
            case "server file type": return "fileType";
            case "server size": return "fileSize";
        }
        return undefined;
    }
}
