Ext.define('CArABU.technicalservices.TeamsTemplateColumn', {
    extend: 'Ext.grid.column.Template',
    alias: ['widget.teamstemplatecolumn'],

    align: 'right',

    initComponent: function(){
        var me = this;

        Ext.QuickTips.init(true, { hideDelay: 10000});

        me.tpl = new Ext.XTemplate('<tpl><div data-qtip="{[this.getTooltip(values)]}" style="cursor:pointer;text-align:right;">{[this.getTeamsText(values)]}</div></tpl>',{
            getTeamsText: function(values){
                if (values && values.Teams){
                    if (Ext.isArray(values.Teams)){
                        var teams = Ext.Array.unique(values.Teams);
                        return teams.length;
                    }
                }
                return '--';
            },
            getTooltip: function(values){

                if (values && values.Teams && Ext.isArray(values.Teams)){
                    var hash = {};
                    Ext.Array.each(values.Teams, function(t){
                        if (!hash[t]){
                            hash[t] = 0;
                        }
                        hash[t]++;
                    });
                    var tooltip = "";
                    Ext.Object.each(hash, function(team, num){
                        tooltip += Ext.String.format("{0} ({1} leaf stories)<br/>", team, num);
                    });
                    return tooltip;

                }
                return "";

            }

        });
        me.hasCustomRenderer = true;
        me.callParent(arguments);
    },
    defaultRenderer: function(value, meta, record) {
        var data = Ext.apply({}, record.getData()); //, record.getAssociatedData());
        return this.tpl.apply(data);
    }
});
