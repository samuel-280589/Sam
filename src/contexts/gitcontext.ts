/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
"use strict";

import url = require("url");
import { Utils } from "../helpers/utils";
import { RepoUtils } from "../helpers/repoutils";
import { IRepositoryContext, RepositoryType } from "./repositorycontext";
import { ISettings } from "../helpers/settings";

var pgc = require("parse-git-config");
var gri = require("git-repo-info");
var path = require("path");

//Gets as much information as it can regarding the Git repository without calling the server (vsts/info)
export class GitContext implements IRepositoryContext {
    private _gitConfig: any;
    private _gitRepoInfo: any;
    private _gitFolder: string;
    private _gitParentFolder: string;
    private _gitOriginalRemoteUrl: string;
    private _gitRemoteUrl: string;
    private _gitCurrentBranch: string;
    private _gitCurrentRef: string;
    private _isSsh: boolean = false;
    private _isTeamServicesUrl: boolean = false;
    private _isTeamFoundationServer: boolean = false;

    //When gitDir is provided, rootPath is the path to the Git repo
    constructor(rootPath: string, gitDir?: string) {
        if (rootPath) {
            //If gitDir, use rootPath as the .git folder
            if (gitDir) {
                this._gitFolder = rootPath;
                gri._changeGitDir(gitDir);
            } else {
                this._gitFolder = Utils.FindGitFolder(rootPath);
            }

            if (this._gitFolder !== undefined) {
                // With parse-git-config, cwd is the directory containing the path, .git/config, you want to sync
                this._gitParentFolder = path.dirname(this._gitFolder);
                let syncObj: any = { cwd: this._gitParentFolder };
                //If gitDir, send pgc the exact path to the config file to use
                if (gitDir) {
                    syncObj = { path: path.join(this._gitFolder, "config") };
                }
                this._gitConfig = pgc.sync(syncObj);

                /* tslint:disable:quotemark */
                let remote: any = this._gitConfig['remote "origin"'];
                /* tslint:enable:quotemark */
                if (remote === undefined) {
                    return;
                }
                this._gitOriginalRemoteUrl = remote.url;

                if (gitDir) {
                    this._gitRepoInfo = gri(this._gitParentFolder);
                } else {
                    this._gitRepoInfo = gri(this._gitFolder);
                }

                this._gitCurrentBranch = this._gitRepoInfo.branch;
                this._gitCurrentRef = "refs/heads/" + this._gitCurrentBranch;

                //All Team Services and TFS Git remote urls contain /_git/
                if (RepoUtils.IsTeamFoundationGitRepo(this._gitOriginalRemoteUrl)) {
                    let purl = url.parse(this._gitOriginalRemoteUrl);
                    if (purl != null) {
                        if (RepoUtils.IsTeamFoundationServicesRepo(this._gitOriginalRemoteUrl)) {
                            this._isTeamServicesUrl = true;
                            let splitHref = purl.href.split("@");
                            if (splitHref.length === 2) {  //RemoteUrl is SSH
                                //For Team Services, default to https:// as the protocol
                                this._gitRemoteUrl = "https://" + purl.hostname + purl.pathname;
                                this._isSsh = true;
                            } else {
                                this._gitRemoteUrl = this._gitOriginalRemoteUrl;
                            }
                        } else if (RepoUtils.IsTeamFoundationServerRepo(this._gitOriginalRemoteUrl)) {
                            this._isTeamFoundationServer = true;
                            this._gitRemoteUrl = this._gitOriginalRemoteUrl;
                            if (purl.protocol.toLowerCase() === "ssh:") {
                                this._isSsh = true;
                                // TODO: No support yet for SSH on-premises (no-op the extension)
                                this._isTeamFoundationServer = false;
                            }
                        }
                    }
                }
            }
        }
    }

    //constructor already initializes the GitContext
    public async Initialize(settings: ISettings): Promise<boolean> {
        return true;
    }

    //Git implementation
    public get CurrentBranch(): string {
        return this._gitCurrentBranch;
    }
    public get CurrentRef(): string {
        return this._gitCurrentRef;
    }

    //TFVC implementation
    //For Git, TeamProjectName is set after the call to vsts/info
    public get TeamProjectName(): string {
        return undefined;
    }

    //IRepositoryContext implementation
    public get RepoFolder(): string {
        return this._gitFolder;
    }
    public get IsSsh(): boolean {
        return this._isSsh;
    }
    public get IsTeamFoundation(): boolean {
        return this._isTeamServicesUrl || this._isTeamFoundationServer;
    }
    public get IsTeamServices(): boolean {
        return this._isTeamServicesUrl;
    }
    public get RemoteUrl(): string {
        return this._gitRemoteUrl;
    }
    public get RepositoryParentFolder(): string {
        return this._gitParentFolder;
    }
    public get Type(): RepositoryType {
        return RepositoryType.GIT;
    }
}
