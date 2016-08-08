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
            queryFilter: ""
        }
    },

    acceptedScheduleStates: ['Accepted'],

    launch: function() {
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
        cb.on('select', this.updateView, this);
    },
    getSelectorBox: function(){
        return this.down('#selector_box');
    },
    getGridBox: function() {
        return this.down('#grid_box');
    },
    getInitialFilters: function(){
        var query = this.getSetting('queryFilter');
        if (query && query.length > 0){
            var filters = Rally.data.wsapi.Filter.fromQueryString(query);
            return filters;
        }
        return [];
    },
    updateView: function(piSelector){
        var piType = piSelector.getRecord() && piSelector.getRecord().get('TypePath');
        this.logger.log('updateView', piType);

        this.childHash = {};
        this.getGridBox().removeAll();

        if (!piType){
            return;
        }

        this.modelNames = [piType];
        Ext.create('Rally.data.wsapi.TreeStoreBuilder').build({
            models: this.modelNames,
            fetch: [this.getFeatureName(),'ScheduleState','PlanEstimate'],
            enableHierarchy: true,
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
                    fetch: ['PlanEstimate','ScheduleState','PortfolioItem','Parent','ObjectID','Project','Name'],
                    filters: {
                        property: 'Parent.ObjectID',
                        operator: '>',
                        value: 0
                    }
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
           this.updateAdditionalFields(subLevelRecords, this.childHash || {});
        }

    },
    updateAdditionalFields: function(records, childHash){
        this.logger.log('updateAdditionalFields',records, childHash);
        for (var i=0; i< records.length; i++){
            var r = records[i],
                totals = this.getChildTotals(r, childHash);

            var percentDoneByStoryCount = totals.totalCount > 0 ? totals.totalAcceptedCount/totals.totalCount : 0,
                percentDoneByPlanEstimate = totals.totalPlanEstimate > 0 ? totals.totalAcceptedPlanEstimate/totals.totalPlanEstimate : 0;

            this.logger.log('updateAdditionalFields results', percentDoneByPlanEstimate,percentDoneByStoryCount,totals.projects);

            r.set('PercentDoneByStoryCount',percentDoneByStoryCount);
            r.set('PercentDoneByStoryPlanEstimate',percentDoneByPlanEstimate);
            r.set('Teams', totals.projects);
        }

    },
    processChildren: function(topLevelStoryRecords, childRecords){
        this.logger.log('processChildren', childRecords)
        if (!childRecords || childRecords.length == 0){
            return;
        }

        var childHash = this.childHash || {};
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
        this.childHash = childHash;

        this.logger.log('processChildren', childHash, topLevelStoryRecords);

        this.updateAdditionalFields(topLevelStoryRecords,childHash);

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
            projects = [];

        if (children.length > 0) {
            Ext.Array.each(children, function (c) {
                var totals = {};
                if (!c.ObjectID){
                    c = c.getData();
                }

                if (childHash[c.ObjectID]) {
                    totals = this.getChildTotals(c, childHash, acceptedScheduleStates);
                } else {
                    var isAccepted = Ext.Array.contains(acceptedScheduleStates, c.ScheduleState),
                        acceptedPlanEstimate = isAccepted && c.PlanEstimate || 0,
                        acceptedTotal = isAccepted && 1 || 0;
                    totals = {
                        totalPlanEstimate: c.PlanEstimate || 0,
                        totalAcceptedPlanEstimate: acceptedPlanEstimate,
                        totalCount: 1,
                        totalAcceptedCount: acceptedTotal,
                        projects: [c.Project && c.Project.Name]
                    };
                }
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
                acceptedTotal = isAccepted && 1 || 0;

            totalPlanEstimate = recordData.PlanEstimate || 0;
            totalAcceptedPlanEstimate = acceptedPlanEstimate;
                totalCount = 1;
            totalAcceptedCount = acceptedTotal;
            projects = [recordData.Project && recordData.Project.Name]
        }


        return {
            totalPlanEstimate: totalPlanEstimate,
            totalAcceptedPlanEstimate: totalAcceptedPlanEstimate,
            totalCount: totalCount,
            totalAcceptedCount: totalAcceptedCount,
            projects: projects
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
            xtype: 'textarea',
            fieldLabel: 'Query',
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
        }];
    }
});
