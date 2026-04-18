// PT Medical System — Realtime Helper
// Requires: _supabase client from auth.js

var RT = {
    channels: {},
    debounceTimers: {},
    statusEl: null,

    // Subscribe to a table's changes with debounce
    subscribe: function(channelName, table, callback, debounceMs) {
        debounceMs = debounceMs || 1500;
        // Unsubscribe existing channel with same name
        RT.unsubscribe(channelName);

        var channel = _supabase.channel(channelName)
            .on('postgres_changes', { event: '*', schema: 'public', table: table }, function(payload) {
                // Debounce rapid events
                if (RT.debounceTimers[channelName]) clearTimeout(RT.debounceTimers[channelName]);
                RT.debounceTimers[channelName] = setTimeout(function() {
                    callback(payload);
                }, debounceMs);
            })
            .subscribe(function(status, err) {
                try { console.log('[RT]', channelName, '→', status, err ? ('err=' + (err.message || err)) : ''); } catch(_){}
                RT.updateStatus(status, err);
            });

        RT.channels[channelName] = channel;
        return channel;
    },

    // Subscribe to multiple tables on one channel
    subscribeMulti: function(channelName, tables, callback, debounceMs) {
        debounceMs = debounceMs || 1500;
        RT.unsubscribe(channelName);

        var channel = _supabase.channel(channelName);
        tables.forEach(function(table) {
            channel.on('postgres_changes', { event: '*', schema: 'public', table: table }, function(payload) {
                if (RT.debounceTimers[channelName]) clearTimeout(RT.debounceTimers[channelName]);
                RT.debounceTimers[channelName] = setTimeout(function() {
                    callback(payload);
                }, debounceMs);
            });
        });
        channel.subscribe(function(status, err) {
            try { console.log('[RT]', channelName, '→', status, err ? ('err=' + (err.message || err)) : ''); } catch(_){}
            RT.updateStatus(status, err);
        });

        RT.channels[channelName] = channel;
        return channel;
    },

    // Unsubscribe a specific channel
    unsubscribe: function(channelName) {
        if (RT.channels[channelName]) {
            _supabase.removeChannel(RT.channels[channelName]);
            delete RT.channels[channelName];
        }
        if (RT.debounceTimers[channelName]) {
            clearTimeout(RT.debounceTimers[channelName]);
            delete RT.debounceTimers[channelName];
        }
    },

    // Unsubscribe all channels
    unsubscribeAll: function() {
        Object.keys(RT.channels).forEach(function(name) {
            RT.unsubscribe(name);
        });
    },

    // Update connection status indicator in navbar.
    // Once any channel reaches SUBSCRIBED we consider the overall connection
    // healthy (green). A later CHANNEL_ERROR/TIMED_OUT on another channel
    // won't downgrade us — Supabase realtime can keep working on other
    // channels even if one times out (e.g., publication missing on one table).
    _anyConnected: false,
    updateStatus: function(status, err) {
        if (!RT.statusEl) {
            RT.statusEl = document.getElementById('rt-status');
        }
        if (!RT.statusEl) return;

        if (status === 'SUBSCRIBED') {
            RT._anyConnected = true;
            RT.statusEl.style.background = '#22c55e';
            RT.statusEl.title = 'Realtime connected';
        } else if (status === 'CHANNEL_ERROR') {
            if (!RT._anyConnected) {
                RT.statusEl.style.background = '#ef4444';
                RT.statusEl.title = 'Realtime error' + (err ? ' — ' + (err.message || err) : '');
            }
        } else if (status === 'TIMED_OUT') {
            if (!RT._anyConnected) {
                RT.statusEl.style.background = '#f59e0b';
                RT.statusEl.title = 'Realtime timed out — retrying...';
            }
        } else if (status === 'CLOSED') {
            if (!RT._anyConnected) {
                RT.statusEl.style.background = '#ef4444';
                RT.statusEl.title = 'Realtime closed';
            }
        } else {
            RT.statusEl.style.background = '#f59e0b';
            RT.statusEl.title = 'Connecting... (' + (status || 'no status') + ')';
        }
    },

    // Inject status dot into navbar (call once on page load)
    initStatusDot: function() {
        var navbar = document.querySelector('.navbar .container-fluid') || document.querySelector('.navbar');
        if (!navbar || document.getElementById('rt-status')) return;
        var dot = document.createElement('span');
        dot.id = 'rt-status';
        dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#f59e0b;display:inline-block;margin-left:6px;vertical-align:middle;';
        dot.title = 'Connecting...';
        // Insert after brand or at end of navbar
        var brand = navbar.querySelector('.navbar-brand');
        if (brand) {
            brand.appendChild(dot);
        } else {
            navbar.appendChild(dot);
        }
        RT.statusEl = dot;
    }
};

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    RT.unsubscribeAll();
});
