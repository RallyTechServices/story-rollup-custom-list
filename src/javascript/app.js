Ext.define("story-rollup-custom-list", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'selector_box'},
        {xtype:'container',itemId:'grid_box'}
    ],

    integrationHeaders : {
        name : "story-rollup-custom-list"
    },

    config: {
        defaultSettings: {
            queryFilter: "",
            featureQueryFilter: "",
            tfsLinkField: "c_TFSLink",
            storyStartDateField: "c_TeamFeatureStartDate",
            storyEndDateField: "c_TeamFeatureEndDate"
        }
    },

    acceptedScheduleStates: ['Accepted'],
    portfolioItemTypes: [],

    launch: function() {
        CArABU.technicalservices.StoryRollupCustomListSettings.storyStartDateField = this.getStartDateField();
        CArABU.technicalservices.StoryRollupCustomListSettings.storyEndDateField = this.getEndDateField();

        this.initializeCompletedScheduleStates("Accepted").then({
            success: this.initializeApp,
            failure: this.showErrorNotification,
            scope: this
        });

    },
    initializeCompletedScheduleStates: function(firstCompletedState){
        var deferred = Ext.create('Deft.Deferred');

        Rally.data.ModelFactory.getModel({
            type: 'UserStory',
            success: function(model) {
                model.getField('ScheduleState').getAllowedValueStore().load({
                    callback: function(records, operation, success) {
                        if (success){
                            var scheduleStates = [];
                            Ext.Array.each(records, function(allowedValue) {
                                //each record is an instance of the AllowedAttributeValue model
                                scheduleStates.push(allowedValue.get('StringValue'));
                            });
                            var completedIndex = _.indexOf(scheduleStates,firstCompletedState);
                            deferred.resolve(Ext.Array.slice(scheduleStates,completedIndex))
                        } else {
                            var msg = "Error fetching Schedule State values:  " + operation && operation.error && operation.error.errors.join(",");
                            deferred.reject(msg);
                        }

                    }
                });
            }
        });

        return deferred;
    },
    initializeApp: function(completedScheduleStates){
        this.acceptedScheduleStates = completedScheduleStates;
        this.logger.log('initializeApp', completedScheduleStates);

        this.getSelectorBox().removeAll();

        var cb = this.getSelectorBox().add({
            xtype: 'rallyportfolioitemtypecombobox',
            fieldLabel: "Type"
        });
        cb.on('ready', this.updatePortfolioItemTypes, this);
        cb.on('select', this.updateView, this);
    },
    updatePortfolioItemTypes: function(cb){
        this.logger.log('updatePortfolioItemTypes', cb.getStore().getRange());
        this.portfolioItemTypes = Ext.Array.map(cb.getStore().getRange(), function(p){ return p.get('TypePath'); });
    },
    getSelectorBox: function(){
        return this.down('#selector_box');
    },
    getGridBox: function() {
        return this.down('#grid_box');
    },
    getTFSTeamPrefix: function(){
        return "TFS: ";
    },
    getEndDateField: function(){
        return this.getSetting('storyEndDateField');
    },
    getStartDateField: function(){
        return this.getSetting('storyStartDateField');
    },
    getInitialFilters: function(){
        var query = this.getSetting('queryFilter'),
            featureFilters = null;

        this.logger.log('getInitialFilters', this.modelNames, this.portfolioItemTypes);

        if (this.isLowestLevel()){
            //This is the lowest level portfolio item type
            featureFilters = this.getFeatureFilters();
        }

        if (query && query.length > 0){
            var filters = Rally.data.wsapi.Filter.fromQueryString(query);
            if (featureFilters){
                filters = filters.and(featureFilters);
            }
            return filters;
        }
        return featureFilters || [];
    },
    getFeatureFilters: function(){
        var query = this.getSetting('featureQueryFilter');

        if (query && query.length > 0){
            var filters = Rally.data.wsapi.Filter.fromQueryString(query);
            return filters;
        }
        return null;
    },
    getTFSLinkField: function(){
        return this.getSetting('tfsLinkField');
    },
    isLowestLevel: function(){
        var idx = _.indexOf(this.portfolioItemTypes, this.modelNames && this.modelNames[0]);
        return  (idx === this.portfolioItemTypes.length - 1)
    },
    getSecondLevelPortfolioItem: function(){
        return this.portfolioItemTypes.slice(-2)[0];
    },
    updateView: function(piSelector){
        var piType = piSelector.getRecord() && piSelector.getRecord().get('TypePath');
        this.logger.log('updateView', piType);

        this.childHash = {};
        this.summaryInfo = {};
        this.getGridBox().removeAll();

        if (!piType){
            return;
        }

        var childFilterHash = null;
        if (!this.isLowestLevel() && this.getFeatureFilters()){
            childFilterHash = {};
            childFilterHash[this.getSecondLevelPortfolioItem().toLowerCase()] = this.getFeatureFilters();
        }

        this.modelNames = [piType];
        var fetch = [this.getFeatureName(),'ScheduleState','PlanEstimate'];
        if (this.getTFSLinkField()){ fetch.push(this.getTFSLinkField());}
        if (this.getStartDateField()){ fetch.push(this.getStartDateField());}
        if (this.getEndDateField()){ fetch.push(this.getEndDateField());}
        Ext.create('Rally.data.wsapi.TreeStoreBuilder').build({
            models: this.modelNames,
            fetch: fetch,
            enableHierarchy: true,
            childFilters: childFilterHash,
            filters: this.getInitialFilters()
        }).then({
            success: this.buildGridBoard,
            scope: this
        });

    },
    getFeatureName: function(){
        return 'Feature';
    },
    updateAssociatedData: function(store, node, records, success){
        this.logger.log('updateAssociatedData', store, node, records, success);
        var updateableRecords = [],
            featureOids = [],
            featureName = this.getFeatureName(),
            subLevelRecords = [];

        Ext.Array.each(records, function(r){
            if (r.get('PortfolioItem')){
                updateableRecords.push(r);
                if (!Ext.Array.contains(featureOids,r.get('PortfolioItem').ObjectID )){
                    featureOids.push(r.get('PortfolioItem').ObjectID);
                }
            } else if (r.get(featureName)){
                subLevelRecords.push(r);
            }
        });
        this.logger.log('updateAssociatedData', subLevelRecords, updateableRecords, featureOids);

        if (updateableRecords.length > 0){
            Ext.create('CArABU.technicalservices.chunk.Store',{
                storeConfig: {
                    model: 'HierarchicalRequirement',
                    context: { project: null },
                    fetch: ['PlanEstimate','ScheduleState','PortfolioItem','Parent','ObjectID','Project','Name',this.getTFSLinkField()],
                },
                chunkProperty: featureName + '.ObjectID',
                chunkValue: featureOids
            }).load().then({
                success: function(children){
                    this.processChildren(updateableRecords, children);
                },
                failure: this.showErrorNotification,
                scope: this
            });
        }

        if (subLevelRecords.length > 0){
           this.updateAdditionalFields(subLevelRecords);
        }

    },
    updateAdditionalFields: function(records){
        this.logger.log('updateAdditionalFields',records, this.summaryInfo);
       // this.down('rallygridboard').getGridOrBoard().getStore().suspendEvents();

        Ext.suspendLayouts();
        for (var i=0; i< records.length; i++){
              var r = records[i],
                  parent = r.get('Parent') && r.get('Parent').ObjectID,
                    totals = this.summaryInfo[r.get('ObjectID')] || {};

            if (parent){
                totals.startDate = this.summaryInfo[parent].startDate;
                totals.endDate = this.summaryInfo[parent].endDate;
            }

            var percentDoneByStoryCount = totals.totalCount > 0 ? totals.totalAcceptedCount/totals.totalCount : 0,
                percentDoneByPlanEstimate = totals.totalPlanEstimate > 0 ? totals.totalAcceptedPlanEstimate/totals.totalPlanEstimate : 0;

            r.set('PercentDoneByStoryCount',percentDoneByStoryCount);
            r.set('PercentDoneByStoryPlanEstimate',percentDoneByPlanEstimate);
            r.set('Teams', totals.projects);
            r.set('_summary', totals);
        }
        Ext.resumeLayouts(true);
       // this.down('rallygridboard').getGridOrBoard().getStore().resumeEvents();
    },
    processChildren: function(topLevelStoryRecords, childRecords){
        this.logger.log('processChildren', childRecords)

        if (!childRecords || childRecords.length == 0){
            this.updateAdditionalFields(topLevelStoryRecords);
            return;
        }

        var childHash = {};

        for (var i=0; i<childRecords.length; i++){
            var child = childRecords[i].getData(),
                parent = (child.PortfolioItem && child.PortfolioItem.ObjectID) ||
                            (child.Parent && child.Parent.ObjectID) || null;

            if (parent){
                if (!childHash[parent]){
                    childHash[parent] = [];
                }
                childHash[parent].push(child);
            }
        }

        this.logger.log('processChildren', childHash, topLevelStoryRecords);
        var startDateField = this.getStartDateField(),
            endDateField = this.getEndDateField();

        for (var i=0; i< topLevelStoryRecords.length; i++) {
            var r = topLevelStoryRecords[i],
                oid = r.get('ObjectID'),
                startDate = r.get(startDateField),
                endDate = r.get(endDateField);

            this.summaryInfo[oid] = this.getChildTotals(r, childHash);
            this.summaryInfo[oid].startDate = startDate;
            this.summaryInfo[oid].endDate = endDate;

        }
        this.updateAdditionalFields(topLevelStoryRecords);

    },
    getChildTotals: function(record, childHash){
        this.logger.log('getChildTotals', record, childHash);
        var oid = record.ObjectID || record.get('ObjectID');
        var acceptedScheduleStates = this.acceptedScheduleStates;
        var children = childHash[oid] || [],
            totalPlanEstimate = 0,
            totalAcceptedPlanEstimate = 0,
            totalCount = 0,
            totalAcceptedCount = 0,
            projects = [],
            tfsLinkField = this.getTFSLinkField(),
            tfsPrefix = this.getTFSTeamPrefix(),
            unestimatedLeafStories = 0;

        if (children.length > 0) {
            Ext.Array.each(children, function (c) {
                var totals = {};
                if (!c.ObjectID){
                    c = c.getData();
                }

                if (childHash[c.ObjectID]) {
                    totals = this.getChildTotals(c, childHash, acceptedScheduleStates);
                    this.summaryInfo[c.ObjectID] = totals;
                } else {
                    var isAccepted = Ext.Array.contains(acceptedScheduleStates, c.ScheduleState),
                        acceptedPlanEstimate = isAccepted && c.PlanEstimate || 0,
                        acceptedTotal = isAccepted && 1 || 0,
                        isTFS = c[tfsLinkField],
                        projectName = c.Project && c.Project.Name,
                        unestimated = !c.PlanEstimate && (c.PlanEstimate !== 0);

                    if (isTFS){
                        projectName = tfsPrefix + projectName;
                    }

                    totals = {
                        unestimatedLeafStories: unestimated && 1 || 0,
                        totalPlanEstimate: c.PlanEstimate || 0,
                        totalAcceptedPlanEstimate: acceptedPlanEstimate,
                        totalCount: 1,
                        totalAcceptedCount: acceptedTotal,
                        projects: [projectName]
                    };
                    this.summaryInfo[c.ObjectID] = totals;
                }
                unestimatedLeafStories += totals.unestimatedLeafStories;
                totalPlanEstimate += totals.totalPlanEstimate;
                totalAcceptedPlanEstimate += totals.totalAcceptedPlanEstimate;
                totalCount += totals.totalCount;
                totalAcceptedCount += totals.totalAcceptedCount;
                projects = projects.concat(totals.projects);

            }, this);
        } else {
            var recordData = record.ObjectID ? record : record.getData(),
                isAccepted = Ext.Array.contains(acceptedScheduleStates, recordData.ScheduleState),
                acceptedPlanEstimate = isAccepted && recordData.PlanEstimate || 0,
                acceptedTotal = isAccepted && 1 || 0,
                unestimatedCount = (!recordData.PlanEstimate && (recordData.PlanEstimate !== 0) && 1) || 0;

            unestimatedLeafStories = unestimatedCount;
            totalPlanEstimate = recordData.PlanEstimate || 0;
            totalAcceptedPlanEstimate = acceptedPlanEstimate;
            totalCount = 1;
            totalAcceptedCount = acceptedTotal;
            projects = [recordData.Project && recordData.Project.Name]

            this.summaryInfo[recordData.ObjectID] = {
                unestimatedLeafStories: unestimatedCount,
                totalPlanEstimate: recordData.PlanEstimate || 0,
                totalAcceptedPlanEstimate: acceptedPlanEstimate,
                totalCount: 1,
                totalAcceptedCount: acceptedTotal,
                projects: [recordData.Project && recordData.Project.Name]
            }
        }


        return {
            totalPlanEstimate: totalPlanEstimate,
            totalAcceptedPlanEstimate: totalAcceptedPlanEstimate,
            totalCount: totalCount,
            totalAcceptedCount: totalAcceptedCount,
            projects: projects,
            unestimatedLeafStories: unestimatedLeafStories
        };
    },
    showErrorNotification: function(msg){
        Rally.ui.notify.Notifier.showError({message: msg});
    },
    buildGridBoard: function(store){
        var modelNames = this.modelNames,
            context = this.getContext();

        this.getGridBox().removeAll();
        store.on('load', this.updateAssociatedData, this);
        this.getGridBox().add({
            xtype: 'rallygridboard',
            context: context,
            modelNames: modelNames,
            toggleState: 'grid',
            stateful: false,
            stateId: 'fred2',
            plugins: [
                'rallygridboardaddnew',
                {
                    ptype: 'rallygridboardfieldpicker',
                    headerPosition: 'left',
                    modelNames: modelNames,
                    stateful: true,
                    stateId: context.getScopedStateId('columns4')
                },{
                    ptype: 'rallygridboardinlinefiltercontrol',
                    inlineFilterButtonConfig: {
                        stateful: true,
                        stateId: context.getScopedStateId('filters'),
                        modelNames: modelNames,
                        inlineFilterPanelConfig: {
                            quickFilterPanelConfig: {
                                defaultFields: [
                                    'ArtifactSearch',
                                    'Owner',
                                    'ModelType'
                                ]
                            }
                        }
                    }
                }, {
                    ptype: 'rallygridboardactionsmenu',
                    menuItems: [
                        {
                            text: 'Export...',
                            handler: function() {
                                window.location = Rally.ui.gridboard.Export.buildCsvExportUrl(
                                    this.down('rallygridboard').getGridOrBoard());
                            },
                            scope: this
                        }
                    ],
                    buttonConfig: {
                        iconCls: 'icon-export'
                    }
                }
            ],
            gridConfig: {
                store: store,
                storeConfig: {
                    filters: this.getInitialFilters()
                },
                columnCfgs: this.getDefaultColumns(),
                derivedColumns: this.getAdditionalColumns()
            },
            height: this.getHeight()
        });
    },
    getDefaultColumns: function(){
        var cols = [
            'Name',
            'PercentDoneByStoryPlanEstimate',
            'PercentDoneByStoryCount',
            'State',
            'Owner'
        ].concat(this.getAdditionalColumns());
        this.logger.log('getDefaultColumns', cols);
        return cols;
    },
    getAdditionalColumns: function(){
        return [{
            xtype: 'teamstemplatecolumn',
            text: 'Teams'
        }];
    },
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        // Ext.apply(this, settings);
        this.launch();
    },
    getSettingsFields: function(){
        return [{
            xtype: 'container',
            padding: 25,
            html: '<div class="settings-message">The settings below affect the behavior of the report.  The <b>TFS Link field</b> is the field that the report checks to determine if the story is linked to a TFS story.  The <b>Story Start Date</b> and <b>Story End Date</b> fields determine the coloring of the progress bar for the story rollups.  Changing these fields will affect the behavior of the app.</div>'
        },{
            xtype: 'rallyfieldcombobox',
            model: 'hierarchicalrequirement',
            name: 'tfsLinkField',
            fieldLabel: "TFS Link Field",
            labelAlign: 'right',
            labelWidth: 100,
            _isNotHidden: function(field){

                if (!field.readOnly && field.attributeDefinition && (field.attributeDefinition.AttributeType === 'STRING' ||
                        field.attributeDefinition.AttributeType === 'TEXT')){
                    return true;
                }
                return false;
            }
        },{
            xtype: 'rallyfieldcombobox',
            model: 'hierarchicalrequirement',
            name: 'storyStartDateField',
            fieldLabel: 'Story StartDate Field',
            labelAlign: 'right',
            labelWidth: 100,
            _isNotHidden: function(field){
                return (!field.readOnly && field.attributeDefinition && field.attributeDefinition.AttributeType === 'DATE');
            }

        },{
            xtype: 'rallyfieldcombobox',
            model: 'hierarchicalrequirement',
            name: 'storyEndDateField',
            fieldLabel: 'Story EndDate Field',
            labelAlign: 'right',
            labelWidth: 100,
            _isNotHidden: function(field){
                return (!field.readOnly && field.attributeDefinition && field.attributeDefinition.AttributeType === 'DATE');
            }

        },{
            xtype: 'textarea',
            fieldLabel: 'Top Level Query Filter',
            name: 'queryFilter',
            anchor: '100%',
            cls: 'query-field',
            margin: '0 70 0 0',
            labelAlign: 'right',
            labelWidth: 100,
            plugins: [
                {
                    ptype: 'rallyhelpfield',
                    helpId: 194
                },
                'rallyfieldvalidationui'
            ],
            validateOnBlur: false,
            validateOnChange: false,
            validator: function(value) {
                try {
                    if (value) {
                        Rally.data.wsapi.Filter.fromQueryString(value);
                    }
                    return true;
                } catch (e) {
                    return e.message;
                }
            }
        },{
            xtype: 'textarea',
            fieldLabel: 'Program Feature Query Filter',
            name: 'featureQueryFilter',
            anchor: '100%',
            cls: 'query-field',
            margin: '0 70 0 0',
            labelAlign: 'right',
            labelWidth: 100,
            plugins: [
                {
                    ptype: 'rallyhelpfield',
                    helpId: 194
                },
                'rallyfieldvalidationui'
            ],
            validateOnBlur: false,
            validateOnChange: false,
            validator: function(value) {
                try {
                    if (value) {
                        Rally.data.wsapi.Filter.fromQueryString(value);
                    }
                    return true;
                } catch (e) {
                    return e.message;
                }
            }
        }];
    }
});
