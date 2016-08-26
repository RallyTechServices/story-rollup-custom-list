Ext.define('CArABU.technicalservices.TeamPopover', {
    alias: 'widget.teampopover',
    extend: 'Rally.ui.popover.Popover',

    mixins: [
        'Rally.Messageable'
    ],

    cls: 'blocked-reason-popover',
    width: 400,

    offsetFromTarget:[{x:0, y:-10}, {x:15, y:0}, {x:0, y:10}, {x:0, y:0}],
    header: false,
    closable: true,

    config: {
        record: null
    },

    constructor: function(config) {
        Ext.apply(this.config, config);

        this.callParent(arguments);

        var teams = [];
        var values = config.record && config.record.getData();
        if (values && values.Teams && Ext.isArray(values.Teams)){
            var hash = {};
            Ext.Array.each(values.Teams, function(t){
                if (!hash[t]){
                    hash[t] = 0;
                }
                hash[t]++;
            });

            Ext.Object.each(hash, function(team, num){
                teams.push({team: team, leafStories: num});
            });

            var data = {
                teams: teams,
                formattedID: values.FormattedID,
                name: values.Name
            };
            var tpl = Ext.create('Ext.XTemplate',
                '<div class="story-title">{formattedID}: {name}</div><br/>',
                '<table><thead><th class="teams">Teams</th><th class="leafStories"># Leaf Stories</th></thead>',
                '<tpl for="teams">',
                '<tr><td class="teams">{team}</td><td class="leafStories">{leafStories}</td></tr>',
                '</tpl></table>'
            );


            this.add({
                xtype: 'container',
                html: tpl.apply(data)
            });
        }




    }
});
