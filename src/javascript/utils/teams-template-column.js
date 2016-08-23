Ext.define('CArABU.technicalservices.TeamsTemplateColumn', {
    extend: 'Ext.grid.column.Template',
    alias: ['widget.teamstemplatecolumn'],

    align: 'right',

    initComponent: function(){
        var me = this;

        me.tpl = new Ext.XTemplate('<tpl><div class="team-cell">{[this.getTeamsText(values)]}</div></tpl>',{
            getTeamsText: function(values){
                if (values && values.Teams){
                    if (Ext.isArray(values.Teams)){
                        var teams = Ext.Array.unique(values.Teams);
                        return teams.length;
                    }
                }
                return '--';
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
