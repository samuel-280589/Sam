/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
"use strict";

var Q = require("q");
var fs = require("fs");
var path = require("path");

/*
    Provides storage of credentials in a file on the local file system.
    Does not support any kind of 'prefix' of the credential (since this
    storage mechanism is not shared with either Windows or OSX).  The
    file is secured as RW for the owner of the process.
 */
export class FileTokenStorage {
    private _filename: string;

    constructor(filename: string) {
        this._filename = filename;
    }

    public AddEntries(newEntries: Array<any>, existingEntries: Array<any>) : Q.Promise<void> {
        let entries: Array<any> = existingEntries.concat(newEntries);
        return this.saveEntries(entries);
    }

    public Clear() : Q.Promise<void> {
        return this.saveEntries([]);
    }

    public LoadEntries() : Q.Promise<any> {
        let deferred: Q.Deferred<any> = Q.defer();
        let entries: Array<any> = [];
        let err: any;

        try {
            let content: string = fs.readFileSync(this._filename);
            entries = JSON.parse(content);
            deferred.resolve(entries);
        } catch (ex) {
            if (ex.code !== "ENOENT") {
                err = ex;
                deferred.reject(err);
            } else {
                // If it is ENOENT (the file doesn't exist or can't be found)
                // Return an empty array (no items yet)
                deferred.resolve([]);
            }
        }
        return deferred.promise;
    }

    public RemoveEntries(entriesToRemove: Array<any>, entriesToKeep: Array<any>) : Q.Promise<void> {
        return this.saveEntries(entriesToKeep);
    }

    private saveEntries(entries: Array<any>) : Q.Promise<void> {
        let defer: Q.Deferred<void> = Q.defer();

        let writeOptions = {
            encoding: "utf8",
            mode: 384, // Permission 0600 - owner read/write, nobody else has access
            flag: "w"
        };

        // If the path we want to store in doesn't exist, create it
        let folder: string = path.dirname(this._filename);
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder);
        }
        fs.writeFile(this._filename, JSON.stringify(entries), writeOptions, (err) => {
            if (err) {
                defer.reject(err);
            } else {
                defer.resolve(undefined);
            }
        });
        return defer.promise;
    }
}
