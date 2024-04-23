/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
"use strict";

import { Credential } from "../credential";
import { ICredentialStore } from "../interfaces/icredentialstore";

var Q = require("q");
var wincredstore = require("./win-credstore");

/*
    Provides the ICredentialStore API on top of Windows Credential Store-based storage.

    User can provide a custom prefix for the credential.
 */
export class WindowsCredentialStoreApi implements ICredentialStore {
    private static separator: string = "|";

    constructor(credentialPrefix: string) {
        if (credentialPrefix !== undefined) {
            wincredstore.setPrefix(credentialPrefix);
        }
    }

    public GetCredential(service: string) : Q.Promise<Credential> {
        let deferred: Q.Deferred<Credential> = Q.defer();
        let credential: Credential;

        //TODO: Why not just have listCredentials send back the ones I want based on (optional) service?
        this.listCredentials().then((credentials) => {
            //Spin through the returned credentials to ensure I got the one I want based on passed in 'service'
            for (let index = 0; index < credentials.length; index++) {
                credential = this.createCredential(credentials[index]);
                if (credential.Service === service) {
                    break;
                } else {
                    // The current credential isn't the one we're looking for
                    credential = undefined;
                }
            }
            deferred.resolve(credential);
        }).fail((reason) => {
            deferred.reject(reason);
        });
        return deferred.promise;
    }

    public SetCredential(service: string, username: string, password: any) : Q.Promise<void> {
        let deferred: Q.Deferred<void> = Q.defer();
        let targetName: string = this.createTargetName(service, username);

        // Here, `password` is either the password or pat
        wincredstore.set(targetName, password, function(err) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(undefined);
            }
        });
        return deferred.promise;
    }

    public RemoveCredential(service: string) : Q.Promise<void> {
        let deferred: Q.Deferred<void> = Q.defer();
        let targetName: string = this.createTargetName(service, "*");

        wincredstore.remove(targetName, function(err) {
            if (err) {
                if (err.code !== undefined && err.code === 1168) {
                    //code 1168: not found
                    // If credential isn't found, don't fail.
                    deferred.resolve(undefined);
                } else {
                    deferred.reject(err);
                }
            } else {
                deferred.resolve(undefined);
            }
        });
        return deferred.promise;
    }

    // Adding for test purposes (to ensure a particular credential doesn't exist)
    public getCredentialByName(service: string, username: string) : Q.Promise<Credential> {
        let deferred: Q.Deferred<Credential> = Q.defer();
        let credential: Credential;

        this.listCredentials().then((credentials) => {
            //Spin through the returned credentials to ensure I got the one I want based on passed in 'service'
            for (let index = 0; index < credentials.length; index++) {
                credential = this.createCredential(credentials[index]);
                if (credential.Service === service && credential.Username === username) {
                    break;
                } else {
                    // The current credential isn't the one we're looking for
                    credential = undefined;
                }
            }
            deferred.resolve(credential);
        }).fail((reason) => {
            deferred.reject(reason);
        });
        return deferred.promise;
    }

    public removeCredentialByName(service: string, username: string) : Q.Promise<void> {
        let deferred: Q.Deferred<void> = Q.defer();
        let targetName: string = this.createTargetName(service, username);

        wincredstore.remove(targetName, function(err) {
            if (err) {
                if (err.code !== undefined && err.code === 1168) {
                    //code 1168: not found
                    // If credential isn't found, don't fail.
                    deferred.resolve(undefined);
                } else {
                    deferred.reject(err);
                }
            } else {
                deferred.resolve(undefined);
            }
        });
        return deferred.promise;
    }

    private createCredential(cred: any) : Credential {
        let password: string = new Buffer(cred.credential, "hex").toString("utf8");
        // http://servername:port|\\domain\username
        let segments: Array<string> = cred.targetName.split(WindowsCredentialStoreApi.separator);
        let username: string = segments[segments.length - 1];
        let service: string = segments[0];
        return new Credential(service, username, password);
    }

    private createTargetName(service: string, username: string) : string {
        return service + WindowsCredentialStoreApi.separator + username;
    }

    private listCredentials() : Q.Promise<Array<any>> {
        let deferred: Q.Deferred<Array<any>> = Q.defer();
        let credentials: Array<any> = [];

        let stream = wincredstore.list();
        stream.on("data", (cred) => {
            credentials.push(cred);
        });
        stream.on("end", () => {
            deferred.resolve(credentials);
        });
        stream.on("error", (error) => {
            console.log(error);
            deferred.reject(error);
        });
        return deferred.promise;
    }
}
