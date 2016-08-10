
Ext.override(Rally.ui.popover.PercentDonePopover, {


        constructor: function(config) {
            //percentDoneData: {
            //    PercentDoneByStoryPlanEstimate: 0,
            //    PercentDoneByStoryCount: 0,
            //    ActualEndDate: undefined,
            //    PlannedStartDate: undefined,
            //    PlannedEndDate: undefined,
            //    AcceptedLeafStoryPlanEstimateTotal: 0,
            //    LeafStoryPlanEstimateTotal: 0,
            //    AcceptedLeafStoryCount: 0,
            //    LeafStoryCount: 0,
            //    UnEstimatedLeafStoryCount: 0,
            //    Notes: undefined,
            //    PortfolioItemTypeOrdinal: undefined,
            //    LateChildCount: 0
            //},

            if (config.percentDoneData._type === 'hierarchicalrequirement'){
                var summaryData = config.percentDoneData._summary;

                var plannedEndDate = new Date(),
                    plannedStartDate = new Date();
                if (config.percentDoneData.PortfolioItem){
                    plannedEndDate = summaryData.endDate;
                    plannedStartDate = summaryData.startDate;
                 }

                config.percentDoneData.AcceptedLeafStoryCount = summaryData.totalAcceptedCount;
                config.percentDoneData.AcceptedLeafStoryPlanEstimateTotal = summaryData.totalAcceptedPlanEstimate;
                config.percentDoneData.LeafStoryCount = summaryData.totalCount;
                config.percentDoneData.LeafStoryPlanEstimateTotal = summaryData.totalPlanEstimate;
                config.percentDoneData.ActualEndDate = config.percentDoneData.AcceptedDate;
                config.percentDoneData.PlannedEndDate = plannedEndDate;
                config.percentDoneData.ActualStartDate = config.percentDoneData.InProgressDate;
                config.percentDoneData.PlannedStartDate = plannedStartDate;
                config.percentDoneData.LateChildCount = 0;
                config.percentDoneData.UnEstimatedLeafStoryCount = summaryData.unestimatedLeafStories;
            }

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
        }
});
