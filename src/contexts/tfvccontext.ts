/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
"use strict";

import { IRepositoryContext, RepositoryType } from "./repositorycontext";
import { Tfvc } from "../tfvc/tfvc";
import { Repository } from "../tfvc/repository";
import { IWorkspace } from "../tfvc/interfaces";
import { RepoUtils } from "../helpers/repoutils";
import { Logger } from "../helpers/logger";
import { ISettings } from "../helpers/settings";

export class TfvcContext implements IRepositoryContext {
    private _tfvcFolder: string;
    private _gitParentFolder: string;
    private _tfvcRemoteUrl: string;
    private _isSsh: boolean = false;
    private _isTeamServicesUrl: boolean = false;
    private _isTeamFoundationServer: boolean = false;
    private _teamProjectName: string;
    private _tfvc: Tfvc;
    private _repo: Repository;
    private _tfvcWorkspace: IWorkspace;

    constructor(rootPath: string) {
        this._tfvcFolder = rootPath;
    }

    //Need to call tf.cmd to get TFVC information (and constructors can't be async)
    public async Initialize(settings: ISettings): Promise<boolean> {
        Logger.LogDebug(`Looking for TFVC repository at ${this._tfvcFolder}`);
        this._tfvc = new Tfvc();
        this._repo = this._tfvc.Open(undefined, this._tfvcFolder);
        this._tfvcWorkspace = await this._repo.FindWorkspace(this._tfvcFolder);
        this._tfvcRemoteUrl = this._tfvcWorkspace.server;
        this._isTeamServicesUrl = RepoUtils.IsTeamFoundationServicesRepo(this._tfvcRemoteUrl);
        this._isTeamFoundationServer = RepoUtils.IsTeamFoundationServerRepo(this._tfvcRemoteUrl);
        this._teamProjectName = this._tfvcWorkspace.defaultTeamProject;
        Logger.LogDebug(`Found a TFVC repository for url: '${this._tfvcRemoteUrl}' and team project: '${this._teamProjectName}'.`);
        return true;
    }

    // Tfvc implementation
    public get TeamProjectName(): string {
        return this._teamProjectName;
    }

    public get Tfvc(): Tfvc {
        return this._tfvc;
    }

    public get TfvcRepository(): Repository {
        return this._repo;
    }

    public set TfvcRepository(newRepository: Repository) {
        // Don't let the repository be undefined
        if (newRepository) {
            this._repo = newRepository;
        }
    }

    public get TfvcWorkspace(): IWorkspace {
        return this._tfvcWorkspace;
    }

    // Git implementation
    public get CurrentBranch(): string {
        return undefined;
    }
    public get CurrentRef(): string {
        return undefined;
    }

    // IRepositoryContext implementation
    public get RepoFolder(): string {
        return this._tfvcFolder;
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
        return this._tfvcRemoteUrl;
    }
    public get RepositoryParentFolder(): string {
        return this._gitParentFolder;
    }
    public get Type(): RepositoryType {
        return RepositoryType.TFVC;
    }
}
