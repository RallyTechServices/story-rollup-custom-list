(function() {
    var Ext = window.Ext4 || window.Ext;

    var getDate = function(dateString){
        return Ext.Date.parse(dateString,'c') || new Date(Date.parse(dateString));
    };

    var formatDate = function(dateString) {
        var date = getDate(dateString);
        return Rally.util.DateTime.formatWithDefault(date);
    };

    var getAcceptedTpl = _.memoize(function() {
        return Ext.create('Ext.XTemplate',
            '<h3>% DONE</h3>',
            '<div class="percentDoneLine">',
            '{[this.renderPercentDoneByStoryPlanEstimate(values)]}',
            '<div class="percentDoneText">{AcceptedLeafStoryPlanEstimateTotal} of {LeafStoryPlanEstimateTotal} Points Accepted</div>',
            '</div>',
            '<div class="percentDoneLine">',
            '{[this.renderPercentDoneByStoryCount(values)]}',
            '<div class="percentDoneText">{AcceptedLeafStoryCount} of {LeafStoryCount} User Stories Accepted</div>',
            '</div>',
            '<tpl if="UnEstimatedLeafStoryCount &gt; 0">',
            '<div class="dangerNotification percentDoneLine">',
            'Missing Estimates: ',
            '<div><b>{UnEstimatedLeafStoryCount} User Stor{[values.UnEstimatedLeafStoryCount == 1? "y" : "ies"]}</b></div>',
            '</div>',
            '</tpl>',
            '<tpl if="!PlannedEndDate && !ActualEndDate">',
            '<div class="dangerNotification percentDoneLine">Missing Planned End Date</div>',
            '</tpl>', {
                renderPercentDoneByStoryPlanEstimate: function(recordData) {
                    return Ext.create('Rally.ui.renderer.template.progressbar.PortfolioItemPercentDoneTemplate', {
                        percentDoneName: 'PercentDoneByStoryPlanEstimate',
                        height: '15px',
                        width: '50px',
                        isClickable: false
                    }).apply(recordData);
                },
                renderPercentDoneByStoryCount: function(recordData) {
                    return Ext.create('Rally.ui.renderer.template.progressbar.PortfolioItemPercentDoneTemplate', {
                        percentDoneName: 'PercentDoneByStoryCount',
                        height: '15px',
                        width: '50px',
                        isClickable: false
                    }).apply(recordData);
                }
            });
    });

    var getActualEndDateTpl = _.memoize(function() {
        return Ext.create('Ext.XTemplate',
            '<hr/>',
            '<h3>ACTUAL END DATE</h3>',
            '<div class="actualEndDateInfo percentDoneLine">',
            '{[this.formatDate(values.ActualEndDate)]}',
            '<tpl if="PlannedEndDate">',
            ' ({[this.getEstimateMessage(values)]})',
            '</tpl></div>', {
                getEstimateMessage: _.bind(function(values) {
                    var message;

                    var actualEnd = getDate(values.ActualEndDate);
                    var plannedEnd = getDate(values.PlannedEndDate);

                    var diff = Rally.util.DateTime.getDifference(plannedEnd, actualEnd, 'day');
                    if (diff === 0) {
                        message = 'on time';
                    } else if (diff > 0) {
                        message = diff + ' day' + (diff === 1 ? '' : 's') + ' early';
                    } else {
                        diff = Math.abs(diff);
                        message = diff + ' day' + (diff === 1 ? '' : 's') + ' late';
                    }

                    return message;
                }, this),
                formatDate: formatDate
            });
    });

    var getNotesTpl = _.memoize(function() {
        return Ext.create('Ext.XTemplate',
            '<hr/>',
            '<h3>NOTES</h3>',
            '<div class="percentDoneLine">{Notes}</div>');
    });

    var getReleaseTpl = _.memoize(function() {
        return Ext.create('Ext.XTemplate',
            '<hr/>',
            '<h3>{Release.Name} ({[this.formatDate(values.Release.ReleaseStartDate)]} - {[this.formatDate(values.Release.ReleaseDate)]})</h3>',
            '<tpl if="this.shouldShowPlannedEndDateAlert(values)">',
            '<tpl if="this.showUpdateText(values)">',
            '<div class="dangerNotification percentDoneLine">{PortfolioItemTypeName} Planned End Date:',
            '<div>',
            '<b>{[this.formatDate(values.PlannedEndDate)]}</b> ',
            '<tpl if="values.canUpdate">',
            '<a class="update-link">Update to {[this.formatDate(values.Release.ReleaseDate)]}</a>',
            '</tpl>',
            '</div>',
            '</div>',
            '</tpl>',
            '<tpl if="this.showViewText(values)">',
            '<div class="dangerNotification percentDoneLine">' +
            '{PortfolioItemTypeName} Planned Start &amp; End Dates ',
            '({[this.formatDate(values.PlannedStartDate)]} - {[this.formatDate(values.PlannedEndDate)]}) exist',
            ' outside of the Release End Date.',
            '<tpl if="values.canUpdate">',
            '<a class="detail-link">View</a>',
            '</tpl>',
            '</div>',
            '</tpl>',
            '</tpl>',
            {
                formatDate: formatDate,
                showUpdateText: function(percentDoneData) {
                    var start = percentDoneData.PlannedStartDate;
                    return !start || getDate(start) <= getDate(percentDoneData.Release.ReleaseDate);
                },
                showViewText: function(percentDoneData) {
                    return !this.showUpdateText(percentDoneData);
                },
                shouldShowPlannedEndDateAlert: function(percentDoneData) {
                    return percentDoneData.instance._shouldShowReleaseSection(percentDoneData);
                }
            }
        );
    });

    var getLateChildTpl = _.memoize(function() {
        return Ext.create('Ext.XTemplate',
            '<tpl if="this.shouldShowLateChildAlert(values)">',
            '<div class="dangerNotification percentDoneLine">' +
            'Assigned to later releases or iterations:',
            '<div>',
            '<b>{LateChildCount} {[this.getUserStoriesText(values.LateChildCount)]}</b> ',
            '<a class="late-story-view-link">View</a>',
            '</div>',
            '</div>',
            '</tpl>',
            {
                getUserStoriesText: function(lateChildCount){
                    return lateChildCount > 1 ? 'User Stories' : 'User Story';
                },
                shouldShowLateChildAlert: function(percentDoneData) {
                    return percentDoneData.instance._shouldShowLateChildAlert(percentDoneData);
                }
            });
    });

    /**
     * A Rally.ui.popover.Popover extended to show data about a Portfolio Item's percent done.
     * It's expected to be used in 2 ways, by passing in the data at initialization time, or at show time so the Popover can be reused.
     *
     * The first way:
     *
     *      Ext.create('Rally.ui.popover.PercentDonePopover', {
     *          target: targetEl, //the element, or id, that the popover displays for when it's clicked
     *          percentDoneData: {
     *              ActualEndDate: 'Thu Nov 10 00:00:00 MST 2011',
     *              PlannedEndDate: 'Thu Nov 12 00:00:00 MST 2011',
     *              //... other data
     *          }
     *      });
     *
     *
     * The second way:
     *
     *      var pop = Ext.create('Rally.ui.popover.PercentDonePopover', {
     *          target: Ext.getBody(),
     *          delegate: '.mySelectorForAllTargets'
     *      }
     *
     *      //attach to 'beforeshow' to update at some later time
     *      pop.on('beforeshow', function(){
     *
     *          pop.updateContent({
     *              ActualEndDate: 'Thu Nov 10 00:00:00 MST 2011',
     *              PlannedEndDate: 'Thu Nov 12 00:00:00 MST 2011',
     *              //... other data
     *          });
     *
     *          //or just give it a record's data:
     *          pop.updateContent(record.data);
     *      });
     *
     *  It can also be created via Rally.ui.popover.PopoverFactory#bake:
     *
     *     Rally.ui.popover.PopoverFactory.bake({
     *         field: 'PercentDoneByStoryCount' //or 'PercentDoneByPlanEstimate'
     *     });
     */
    Ext.define('Rally.ui.popover.PercentDonePopover', {
        extend: 'Rally.ui.popover.Popover',

        mixins: [
            'Rally.Messageable'
        ],

        clientMetrics: [
            {
                method: '_onClickUpdatePlannedEndDate',
                description: 'clicked to update planned end date from ' + window.location.href
            },
            {
                beginMethod: '_onClickUpdatePlannedEndDate',
                endMethod: '_onPlannedEndDateUpdated',
                description: 'updated planned end date'
            }
        ],

        config: {
            /**
             * @cfg {Object} percentDoneData (optional) data to use for the Popover.
             * Optional to define it when created, can be passed to updateContent directly if you need to handle it later.
             * @cfg {Number} percentDoneData.PercentDoneByStoryPlanEstimate
             * @cfg {Number} percentDoneData.PercentDoneByStoryCount
             * @cfg {String/Date} percentDoneData.ActualEndDate
             * @cfg {String/Date} percentDoneData.PlannedStartDate
             * @cfg {String/Date} percentDoneData.PlannedEndDate
             * @cfg {Number} percentDoneData.AcceptedLeafStoryPlanEstimateTotal
             * @cfg {Number} percentDoneData.LeafStoryPlanEstimateTotal
             * @cfg {Number} percentDoneData.AcceptedLeafStoryCount
             * @cfg {Number} percentDoneData.LeafStoryCount
             * @cfg {Number} percentDoneData.UnEstimatedLeafStoryCount
             * @cfg {String} percentDoneData.Notes
             */
            percentDoneData: {
                PercentDoneByStoryPlanEstimate: 0,
                PercentDoneByStoryCount: 0,
                ActualEndDate: undefined,
                PlannedStartDate: undefined,
                PlannedEndDate: undefined,
                AcceptedLeafStoryPlanEstimateTotal: 0,
                LeafStoryPlanEstimateTotal: 0,
                AcceptedLeafStoryCount: 0,
                LeafStoryCount: 0,
                UnEstimatedLeafStoryCount: 0,
                Notes: undefined,
                PortfolioItemTypeOrdinal: undefined,
                LateChildCount: 0
            },

            /**
             * @cfg {Boolean} canUpdate (optional)
             * Indicates if the user can update the portfolio item
             */
            canUpdate: false,

            /**
             * @cfg {Boolean} legacyPage (optional)
             * Indicates if the request is originating from a legacy page
             */
            legacyPage: false,

            /**
             * @cfg {Number} oid (optional)
             * Object ID of the portfolio item
             */
            oid:null,

            /**
             * @cfg {String} piRef (optional)
             * _ref url of the portfolio item
             */
            piRef:null,

            /**
             * @cfg {String} percentDoneName (required)
             * The name of the field to use to show the status for.
             * Necessary because the PI might be "On Track" when considering stories completed,
             * but "Late" if considering the plan estimates of stories completed and not completed.
             */
            percentDoneName: 'PercentDoneByStoryCount',

            width:320,
            manageHeight:false
        },

        id: 'percentDonePopover',
        cls: 'percentDonePopover',

        constructor: function(config) {
            this.id += Ext.Date.now().toString();
            if (!Ext.getElementById(this.id)) {
                this.initConfig(config);
                config.items = {
                    itemId: 'percentDonePopoverContent',
                    xtype: 'component',
                    html: this._buildContent(this.config.percentDoneData),
                    listeners: {
                        afterrender: function() {
                            if (!this._hasReleaseData(this.config.percentDoneData)){
                                this._retrievePortfolioItemType();
                            } else {
                                this._setTitle();
                                this._attachActions();
                                if (Rally.BrowserTest) {
                                    Rally.BrowserTest.publishComponentReady(this);
                                }
                            }
                        },
                        scope: this
                    }
                };

                this.callParent(arguments);
            }
        },

        /**
         * Update the Popover with new data.
         * Takes the same options that the percentDoneData config option accepts. Matches the Names of fields on Portfolio Item records
         * so you can just pass in record.data to update.
         * @param {Object} percentDoneData (optional)
         * @param {String/Date} percentDoneData.ActualEndDate
         * @param {String/Date} percentDoneData.PlannedEndDate
         * @param {Number} percentDoneData.AcceptedLeafStoryPlanEstimateTotal
         * @param {Number} percentDoneData.LeafStoryPlanEstimateTotal
         * @param {Number} percentDoneData.AcceptedLeafStoryCount
         * @param {Number} percentDoneData.LeafStoryCount
         * @param {Number} percentDoneData.UnEstimatedLeafStoryCount
         * @param {String} percentDoneData.Notes
         * @param {Object} percentDoneData.Release
         * @param {Number} percentDoneData.PortfolioItemTypeOrdinal
         */
        updateContent: function(percentDoneData) {
            var popoverContent = this.down('#percentDonePopoverContent');

            if (popoverContent) {
                this.config.percentDoneData = Ext.applyIf(percentDoneData || {}, this.config.percentDoneData);
                var content = this._buildContent(this.config.percentDoneData);
                popoverContent.update(content);
                this._setTitle();
                this._attachActions();
            }
        },

        _setTitle: function() {
            this.setTitle(Rally.util.HealthColorCalculator.calculateHealthColorForPortfolioItemData(this.config.percentDoneData,
                this.getPercentDoneName()).label);
        },

        _buildContent: function(percentDoneData) {
            var html = '';
            percentDoneData.instance = this;
            percentDoneData.canUpdate = this.config.canUpdate;

            html += '<div class="percentDoneContainer">';

            html += getAcceptedTpl().apply(percentDoneData);

            if (!Ext.isEmpty(percentDoneData.ActualEndDate)) {
                html += getActualEndDateTpl().apply(percentDoneData);
            }

            //ajax request
            if(this._shouldShowReleaseSection(percentDoneData)) {
                html += getReleaseTpl().apply(percentDoneData);

                if(this._shouldShowLateChildAlert(percentDoneData)) {
                    html += getLateChildTpl().apply(percentDoneData);
                }
            }

            if (this._shouldShowNotes(percentDoneData)) {
                html += getNotesTpl().apply(percentDoneData);
            }

            html += '</div>';

            return html;
        },

        _releaseQueried:false,

        _retrievePortfolioItemType: function(){
            Ext.create("Rally.data.wsapi.Store",{
                autoLoad: true,
                model: Ext.identityFn('TypeDefinition'),
                filters: [
                    {
                        property: 'Parent.Name',
                        operator: '=',
                        value: 'Portfolio Item'
                    },
                    {
                        property: 'Ordinal',
                        operator: '=',
                        value: '0'
                    }
                ],
                listeners:{
                    load: this._onPortfolioItemTypeRetrieved,
                    scope:this
                }
            });
        },

        _onPortfolioItemTypeRetrieved: function(typeDefStore){
            var record = typeDefStore.getAt(0).data;
            this.config.percentDoneData.PortfolioItemTypeOrdinal = record.Ordinal;
            this.config.percentDoneData.PortfolioItemTypeName = record.Name;
            this._retrieveReleaseData(record.TypePath);
        },

        _retrieveReleaseData: function(typePath){
            var fetchFields = ["Release", "ReleaseDate", "ReleaseStartDate", "Name", "PlannedStartDate", "PlannedEndDate", "LateChildCount"];
            if (!Ext.isString(this.config.percentDoneData.Notes)) {
                fetchFields.push('Notes');
            }
            this.store = Ext.create("Rally.data.wsapi.Store", {
                model: typePath,
                fetch: fetchFields,
                filters: [
                    {
                        property: "ObjectID",
                        operator: "=",
                        value: this.config.oid || Rally.util.Ref.getOidFromRef(this.config.piRef)
                    }
                ],
                autoLoad: true,
                listeners: {
                    load: this._onReleaseDataRetrieved,
                    scope: this
                }
            });
        },

        _onReleaseDataRetrieved: function(store){
            var record = store.getAt(0);
            this._releaseQueried = true;
            if (record){
                this.config.percentDoneData.Release = record.data.Release;
                this.config.percentDoneData.PlannedStartDate = record.data.PlannedStartDate;
                this.config.percentDoneData.PlannedEndDate = record.data.PlannedEndDate;
                this.config.percentDoneData.LateChildCount = record.data.LateChildCount;
                this.config.canUpdate = record.self.getPermissionLevels(record.data._p).updatable;
                if (!Ext.isString(this.config.percentDoneData.Notes)) {
                    this.config.percentDoneData.Notes = record.data.Notes;
                }
                this.updateContent({
                    Release: record.data.Release
                });
            }else{
                this.updateContent();
            }

            if (Rally.BrowserTest) {
                Rally.BrowserTest.publishComponentReady(this);
            }
        },

        _attachActions: function(){
            this.getEl().select('a.update-link').on('click', this._onClickUpdatePlannedEndDate, this);
            this.getEl().select('a.detail-link').on('click', this._onClickViewDetail, this);
            this.getEl().select('a.late-story-view-link').on('click', this._onClickLateStories, this);
        },

        _onClickUpdatePlannedEndDate: function(evt, el){
            Ext.get(el)
                .removeAllListeners()
                .setStyle({
                    color:'gray',
                    cursor:'default'
                })
                .update(el.innerHTML.replace('Update','Updating') + '...');

            var record = this.store.getAt(0);
            record.set('PlannedEndDate',record.data.Release.ReleaseDate);
            record.save({
                success: this._onPlannedEndDateUpdated,
                scope: this
            });
        },

        _onClickViewDetail: function(){
            var data = this.store.getAt(0);
            this.destroy();
            window.location = Rally.nav.Manager.getDetailUrl(data);
        },

        _onClickLateStories: function() {
            var record = this.store.getAt(0),
                filters = this._filterPopover(record.data),
                target = this.target,
                targetSelector = this.targetSelector;

            //  Close the % done popover
            this.destroy();

            //  Open the new popover
            var reloadStoreCallback;
            Rally.ui.popover.PopoverFactory.bake({
                target: target,
                targetSelector: targetSelector,
                record: record,
                field: 'UserStory',
                autoShow: false,
                title: 'User Stories Assigned to Later Releases or Iteration',
                items: [{
                    gridConfig: {
                        storeConfig: {
                            filters: filters
                        },
                        listeners: {
                            viewready: function(grid) {
                                reloadStoreCallback = _.bind(this._reloadStore, this, grid);
                                this.subscribe(Rally.Message.recordUpdateSuccess, reloadStoreCallback);
                            },
                            destroy: function(grid) {
                                this.unsubscribe(Rally.Message.recordUpdateSuccess, reloadStoreCallback);
                            },
                            scope: this
                        }
                    }
                }]
            }).show();
        },

        _filterPopover: function(record) {
            return [
                {
                    property: 'Feature',
                    operator: '=',
                    value: record._ref
                },
                {
                    property: 'DirectChildrenCount',
                    operator: '=',
                    value: 0
                },
                Rally.data.wsapi.Filter.or([
                    {
                        property: 'Iteration.EndDate',
                        operator: '>',
                        value: record.Release.ReleaseDate
                    },
                    {
                        property: 'Release.ReleaseDate',
                        operator: '>',
                        value: record.Release.ReleaseDate
                    }
                ])
            ];
        },

        _onPlannedEndDateUpdated: function(record) {
            if (this.config.legacyPage) {
                this.publish(Rally.app.Message.legacyPageRefreshRequest);
            }
            this.publish(Rally.Message.objectUpdate, record, ['PlannedEndDate'], this);
            this.publish(Rally.Message.recordUpdateSuccess, record);
            this.updateContent({PlannedEndDate:record.data.PlannedEndDate});
        },

        _hasReleaseData: function(data){
            return this._releaseQueried ||
                (Ext.isObject(data.Release) && Ext.isNumber(data.PortfolioItemTypeOrdinal) && Ext.isString(data.Notes));
        },

        _shouldShowNotes: function(data){
            return this._hasReleaseData(data) && !Ext.isEmpty(data.Notes);
        },

        _shouldShowReleaseSection: function(data){
            return this._hasReleaseData(data) &&
                Ext.isObject(data.Release) &&
                data.Release.ReleaseDate &&
                data.PortfolioItemTypeOrdinal === 0 && //is feature
                data.PlannedEndDate && //has planned end date
                getDate(data.Release.ReleaseDate.toString()) < getDate(data.PlannedEndDate.toString()); // release end date < planned end date
        },

        _shouldShowLateChildAlert: function (data){
            return data.LateChildCount > 0;
        },

        // We manually adjust the editing plugin to the correct position if a grid item is removed after an edit
        _reloadStore: function(grid, record) {
            var scope = this._createEditorScope(grid);
            if (scope.activeRecordPosition !== -1) {
                grid.editingPlugin.cancelEdit();
            }
            grid.store.reload({
                callback: function() {
                    if (scope.activeRecordPosition !== -1) {
                        var newPosition = grid.store.find('_ref', scope.activeRecord.data._ref);
                        if (newPosition === -1) {
                            newPosition = scope.activeRecordPosition;
                        }
                        if (newPosition < grid.store.getCount()) {
                            grid.editingPlugin.startEdit(grid.store.data.items[newPosition], scope.activeColumn);
                        }
                    }
                }
            });
        },

        _createEditorScope: function(grid) {
            var scope = {};
            scope.editor = grid.editingPlugin;
            scope.activeColumn = scope.editor.getActiveColumn();
            scope.activeRecord = scope.editor.getActiveRecord();
            scope.activeRecordPosition = (scope.activeRecord && scope.activeRecord.data) ? grid.store.find('_ref', scope.activeRecord.data._ref) : -1;

            return scope;
        }
    });
})();