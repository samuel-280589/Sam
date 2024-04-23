/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
"use strict";

import { assert } from "chai";

import { Strings } from "../../../src/helpers/strings";
import { ResourceGroup, ConflictsGroup, ExcludedGroup, IncludedGroup } from "../../../src/tfvc/scm/resourcegroups";

describe("Tfvc-ResourceGroups", function() {
    beforeEach(function() {
        //
    });

    it("should verify ResourceGroup - constructor", function() {
        let group = new ResourceGroup("123", "thelabel", []);
        assert.equal(group.id, "123");
        assert.equal(group.label, "thelabel");
        assert.equal(group.resources.length, 0);
    });

    it("should verify ResourceGroup - with undefined", function() {
        let group = new ResourceGroup(undefined, undefined, undefined);
        assert.equal(group.id, undefined);
        assert.equal(group.label, undefined);
        assert.equal(group.resources, undefined);
    });

    it("should verify ConflictsGroup - constructor", function() {
        let group = new ConflictsGroup([]);
        assert.equal(group.id, "conflicts");
        assert.equal(group.label, Strings.ConflictsGroupName);
        assert.equal(group.resources.length, 0);
    });

    it("should verify ExcludedGroup - constructor", function() {
        let group = new ExcludedGroup([]);
        assert.equal(group.id, "excluded");
        assert.equal(group.label, Strings.ExcludedGroupName);
        assert.equal(group.resources.length, 0);
    });

    it("should verify IncludedGroup - constructor", function() {
        let group = new IncludedGroup([]);
        assert.equal(group.id, "included");
        assert.equal(group.label, Strings.IncludedGroupName);
        assert.equal(group.resources.length, 0);
    });
});
