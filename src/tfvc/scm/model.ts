/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
"use strict";

import { Uri, EventEmitter, Event, SCMResourceGroup, Disposable, window } from "vscode";
import { Telemetry } from "../../services/telemetry";
import { TfvcTelemetryEvents } from "../../helpers/constants";
import { TfvcRepository } from "../tfvcrepository";
import { filterEvent } from "../util";
import { Resource } from "./resource";
import { ResourceGroup, IncludedGroup, ExcludedGroup, ConflictsGroup } from "./resourcegroups";
import { IConflict, IPendingChange } from "../interfaces";
import { ConflictType, GetStatuses, Status } from "./status";

import * as _ from "underscore";
import * as path from "path";

export class Model implements Disposable {
    private _disposables: Disposable[] = [];
    private _repositoryRoot: string;
    private _repository: TfvcRepository;
    private _statusAlreadyInProgress: boolean;
    private _explicitlyExcluded: string[] = [];

    private _onDidChange = new EventEmitter<SCMResourceGroup[]>();
    public get onDidChange(): Event<SCMResourceGroup[]> {
        return this._onDidChange.event;
    }

    private _conflictsGroup = new ConflictsGroup([]);
    private _includedGroup = new IncludedGroup([]);
    private _excludedGroup = new ExcludedGroup([]);

    public constructor(repositoryRoot: string, repository: TfvcRepository, onWorkspaceChange: Event<Uri>) {
        this._repositoryRoot = repositoryRoot;
        this._repository = repository;
        // Ignore workspace changes that take place in the .tf or $tf folder (where path contains /.tf/ or \$tf\)
        const onNonGitChange = filterEvent(onWorkspaceChange, uri => !/\/\.tf\//.test(uri.fsPath) && !/\\\$tf\\/.test(uri.fsPath));
        onNonGitChange(this.onFileSystemChange, this, this._disposables);
    }

    public dispose() {
        if (this._disposables) {
            this._disposables.forEach(d => d.dispose());
            this._disposables = [];
        }
    }

    public get ConflictsGroup(): ConflictsGroup { return this._conflictsGroup; }
    public get IncludedGroup(): IncludedGroup { return this._includedGroup; }
    public get ExcludedGroup(): ExcludedGroup { return this._excludedGroup; }

    public get Resources(): ResourceGroup[] {
        const result: ResourceGroup[] = [];
        if (this._conflictsGroup.resources.length > 0) {
            result.push(this._conflictsGroup);
        }
        if (this._includedGroup.resources.length > 0) {
            result.push(this._includedGroup);
        }
        result.push(this._excludedGroup);
        return result;
    }

    private async status(): Promise<void> {
        if (this._statusAlreadyInProgress) {
            return;
        }
        this._statusAlreadyInProgress = true;
        try {
            await this.run(undefined);
        } finally {
            this._statusAlreadyInProgress = false;
        }
    }

    private onFileSystemChange(uri: Uri): void {
        this.status();
    }

    private async run(fn: () => Promise<void>): Promise<void> {
        return window.withScmProgress(async () => {
            if (fn) {
                await fn();
            } else {
                Promise.resolve();
            }
            await this.update();
        });
    }

    //Add the item to the explicitly excluded list.
    public async Exclude(path: string): Promise<void> {
        if (path) {
            let normalizedPath: string = path.toLowerCase();
            if (!_.contains(this._explicitlyExcluded, normalizedPath)) {
                this._explicitlyExcluded.push(normalizedPath);
                await this.update();
            }
        }
    }

    //Unexclude doesn't explicitly INclude.  It defers to the status of the individual item.
    public async Unexclude(path: string): Promise<void>  {
        if (path) {
            let normalizedPath: string = path.toLowerCase();
            if (_.contains(this._explicitlyExcluded, normalizedPath)) {
                this._explicitlyExcluded = _.without(this._explicitlyExcluded, normalizedPath);
                await this.update();
            }
        }
    }

    public async Refresh(): Promise<void>  {
        await this.update();
    }

    private async update(): Promise<void> {
        const changes: IPendingChange[] = await this._repository.GetStatus();
        let foundConflicts: IConflict[] = [];

        // Without any server context we can't run delete or resolve commands
        if (this._repository.HasContext) {
            // Check for any pending deletes and run 'tf delete' on each
            await this.processDeletes(changes);

            // Get the list of conflicts
            //TODO: Optimize out this call unless it is needed. This call takes over 4 times longer than the status call and is unecessary most of the time.
            foundConflicts = await this._repository.FindConflicts();
        }

        const conflict: IConflict = foundConflicts.find(c => c.type === ConflictType.NAME_AND_CONTENT || c.type === ConflictType.RENAME);
        if (conflict) {
            if (conflict.type === ConflictType.RENAME) {
                Telemetry.SendEvent(TfvcTelemetryEvents.RenameConflict);
            } else {
                Telemetry.SendEvent(TfvcTelemetryEvents.NameAndContentConflict);
            }
        }

        const included: Resource[] = [];
        const excluded: Resource[] = [];
        const conflicts: Resource[] = [];

        changes.forEach(raw => {
            const conflict: IConflict = foundConflicts.find(c => this.conflictMatchesPendingChange(raw, c));
            const resource: Resource = new Resource(raw, conflict);

            if (resource.HasStatus(Status.CONFLICT)) {
                return conflicts.push(resource);
            } else {
                //If explicitly excluded, that has highest priority
                if (_.contains(this._explicitlyExcluded, resource.uri.fsPath.toLowerCase())) {
                    return excluded.push(resource);
                }
                //Versioned changes should always be included
                if (resource.IsVersioned) {
                    return included.push(resource);
                }
                //Pending changes should be included
                if (!resource.PendingChange.isCandidate) {
                    return included.push(resource);
                }
                //Others:
                //Candidate changes should be excluded
                return excluded.push(resource);
            }
        });

        this._conflictsGroup = new ConflictsGroup(conflicts);
        this._includedGroup = new IncludedGroup(included);
        this._excludedGroup = new ExcludedGroup(excluded);

        this._onDidChange.fire(this.Resources);
    }

    private conflictMatchesPendingChange(change: IPendingChange, conflict: IConflict): boolean {
        let result: boolean = false;
        if (change && change.localItem && conflict && conflict.localPath) {
            // TODO: If resource or conflict are renames we have a lot more work to do
            //       We are postponing this work for now until we have evidence that it happens a lot
            let path2: string = conflict.localPath;
            // If path2 is relative then assume it is relative to the repo root
            if (!path.isAbsolute(path2)) {
                path2 = path.join(this._repositoryRoot, path2);
            }
            // First compare the source item
            result = change.localItem.toLowerCase() === path2.toLowerCase();
        }
        return result;
    }

    //When files are deleted in the VS Code Explorer, they are marked as Deleted but as candidate changes
    //So we are looking for those and then running the Delete command on each.
    private async processDeletes(changes: IPendingChange[]): Promise<void> {
        let deleteCandidatePaths: string[] = [];
        for (let index: number = 0; index < changes.length; index++) {
            let change: IPendingChange = changes[index];
            if (change.isCandidate && GetStatuses(change.changeType).find((e) => e === Status.DELETE)) {
                deleteCandidatePaths.push(change.localItem);
            }
        }
        if (deleteCandidatePaths && deleteCandidatePaths.length > 0) {
            //We decided not to send telemetry on file operations
            await this._repository.Delete(deleteCandidatePaths);
        }
    }
}
