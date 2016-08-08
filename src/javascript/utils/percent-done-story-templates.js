Ext.define('Rally.ui.renderer.template.progressbar.StoryPercentDoneTemplate', {
    requires: [
        'Rally.util.HealthColorCalculator'
    ],
    extend: 'Rally.ui.renderer.template.progressbar.ProgressBarTemplate',

    config: {
        calculateColorFn: function(recordData) {
            var colorObject = Rally.util.HealthColorCalculator.calculateHealthColorForPortfolioItemData(recordData, this.percentDoneName);
            return colorObject.hex;
        },
        isClickable: true
    },

    constructor: function(config) {
        this.initConfig(config);
        return this.callParent(arguments);
    }
});

/**
 * The Ext.XTemplate used to render the percent done component and column in the grid.
 */
Ext.define('Rally.ui.renderer.template.progressbar.StoryPercentDoneByStoryPlanEstimateTemplate', {
    requires: [],
    extend: 'Rally.ui.renderer.template.progressbar.StoryPercentDoneTemplate',

    config: {
        /**
         * @cfg {String}
         * define a height if necessary to fit where it's being used
         */
        height:'15px',
        /**
         * @cfg {String}
         * sometimes it's necessary to name the variable used as the percent done replacement in the template,
         * like in a grid when a record is used to render the template.
         */
        percentDoneName: 'PercentDoneByStoryPlanEstimate',
        /**
         * @cfg {Function}
         * A function that should return true to show a triangle in the top right to denote something is missing.
         * Defaults to:
         *      function(){ return false; }
         */
        showDangerNotificationFn:function (recordData) {
            return !recordData.PlanEstimate;  //(!recordData.PlannedEndDate && !recordData.ActualEndDate) || recordData.UnEstimatedLeafStoryCount > 0;
        },

        /**
         * @cfg {Boolean}
         * If the percent done is 0%, do not show the bar at all
         */
        showOnlyIfInProgress: false
    },

    constructor: function(config) {
        this.initConfig(config);
        return this.callParent(arguments);
    }
});

Ext.define('Rally.ui.renderer.template.progressbar.StoryPercentDoneByStoryCountTemplate', {
    requires: [],
    extend: 'Rally.ui.renderer.template.progressbar.StoryPercentDoneTemplate',

    config: {
        /**
         * @cfg {String}
         * define a height if necessary to fit where it's being used
         */
        height:'15px',
        /**
         * @cfg {String}
         * sometimes it's necessary to name the variable used as the percent done replacement in the template,
         * like in a grid when a record is used to render the template.
         */
        percentDoneName: 'PercentDoneByStoryCount',
        /**
         * @cfg {Function}
         * A function that should return true to show a triangle in the top right to denote something is missing.
         * Defaults to:
         *      function(){ return false; }
         */
        showDangerNotificationFn: function (recordData) {
            return false;  //!recordData.PlannedEndDate && !recordData.ActualEndDate;
        },

        /**
         * @cfg {Boolean}
         * If the percent done is 0%, do not show the bar at all
         */
        showOnlyIfInProgress: false
    },

    constructor: function(config) {
        this.initConfig(config);
        return this.callParent(arguments);
    }
});