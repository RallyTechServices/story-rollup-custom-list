Ext.override(Rally.data.wsapi.TreeStore,{
    _decorateModels: function() {
        var models = this.model;

        if (_.isFunction(models.getArtifactComponentModels)) {
            models = models.getArtifactComponentModels();
        }

        Ext.Array.each(models, function(m){
            if (m.typePath === "hierarchicalrequirement"){
                m.addField({name: 'PercentDoneByStoryCount', type: 'auto', defaultValue: null, modelType: 'hierarchicalrequirement'});
                m.addField({name: 'PercentDoneByStoryPlanEstimate', type: 'auto', defaultValue: null, modelType: 'hierarchicalrequirement'});
            }
            m.addField({name: 'Teams', type: 'auto', defaultValue: null});
        });

        _.each(Ext.Array.from(models), Rally.ui.grid.data.NodeInterface.decorate, Rally.ui.grid.data.NodeInterface);
    }
});

Ext.override(Rally.ui.grid.TreeGrid, {
    _mergeColumnConfigs: function(newColumns, oldColumns) {

        var mergedColumns= _.map(newColumns, function(newColumn) {
            var oldColumn = _.find(oldColumns, {dataIndex: this._getColumnName(newColumn)});
            if (oldColumn) {
                return this._getColumnConfigFromColumn(oldColumn);
            }

            return newColumn;
        }, this);
        mergedColumns = mergedColumns.concat(this.config.derivedColumns);
        return mergedColumns;
    },
    _getColumnConfigsBasedOnCurrentOrder: function(columnConfigs) {
        var cols = _(this.headerCt.items.getRange()).map(function(column) {
            //override:  Added additional search for column.text
            return _.contains(columnConfigs, column.dataIndex) ? column.dataIndex : _.find(columnConfigs, {xtype: column.xtype, text: column.text });
        }).compact().value();

        return cols;
    },
    _restoreColumnOrder: function(columnConfigs) {

        var currentColumns = this._getColumnConfigsBasedOnCurrentOrder(columnConfigs);
        var addedColumns = _.filter(columnConfigs, function(config) {
            return !_.find(currentColumns, {dataIndex: config.dataIndex}) || Ext.isString(config);
        });
        return currentColumns.concat(addedColumns);
    },
    _applyStatefulColumns: function(columns) {
        if (this.alwaysShowDefaultColumns) {
            _.each(this.columnCfgs, function(columnCfg) {
                if (!_.any(columns, {dataIndex: this._getColumnName(columnCfg)})) {
                    columns.push(columnCfg);
                }
            }, this);
        }

        if (this.config && this.config.derivedColumns){
            this.columnCfgs = columns.concat(this.config.derivedColumns);
        } else {
            this.columnCfgs = columns;
        }

    }
});

Ext.override(Rally.ui.renderer.RendererFactory, {

    typeFieldTemplates: {
        defectsuite: {
            state: function(field) {
                return Ext.create('Rally.ui.renderer.template.DefectSuiteStateTemplate', {
                    field: field
                });
            }
        },
        milestone: {
            formattedid: function(field) {
                return Ext.create('Rally.ui.renderer.template.FormattedIDTemplate');
            }
        },
        task: {
            state: function(field) {
                return Ext.create('Rally.ui.renderer.template.ScheduleStateTemplate', {
                    field: field,
                    showTrigger: true
                });
            }
        },
        testcase: {
            lastbuild: function(field) {
                return Ext.create('Rally.ui.renderer.template.LastBuildTemplate');
            }
        },
        recyclebinentry: {
            type: function(field) {
                return Ext.create('Rally.ui.renderer.template.TypeDefNameTemplate', {
                    fieldName: field.name
                });
            }
        },
        hierarchicalrequirement: {
            percentdonebystorycount: function(field){
                return Ext.create('Rally.ui.renderer.template.progressbar.StoryPercentDoneByStoryCountTemplate',{
                    startDateField: CArABU.technicalservices.StoryRollupCustomListSettings.storyStartDateField,
                    endDateField: CArABU.technicalservices.StoryRollupCustomListSettings.storyEndDateField
                });
            },
            percentdonebystoryplanestimate: function(field){
                return Ext.create('Rally.ui.renderer.template.progressbar.StoryPercentDoneByStoryPlanEstimateTemplate',{
                    startDateField: CArABU.technicalservices.StoryRollupCustomListSettings.storyStartDateField,
                    endDateField: CArABU.technicalservices.StoryRollupCustomListSettings.storyEndDateField
                });
            }
        }
    }

});