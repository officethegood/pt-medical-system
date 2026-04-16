/**
 * Map Config — Phase 2
 *
 * Provides conditional map tile layer based on Admin setting:
 *   - MAP_PROVIDER: 'leaflet' (default) | 'google'
 *   - GOOGLE_MAPS_API_KEY: API key for Google Maps Platform
 *   - GOOGLE_MAPS_TYPE: roadmap | satellite | hybrid | terrain
 *
 * Uses Leaflet.GridLayer.GoogleMutant plugin to render Google tiles
 * inside a Leaflet map — so all existing Leaflet markers / popups /
 * clusters continue to work unchanged.
 *
 * If Google Maps JS fails to load (bad key / quota / network), falls
 * back to default Leaflet tiles automatically so pages never break.
 *
 * Usage (from a map page):
 *   // 1. Load config ONCE after Supabase is ready
 *   await MapConfig.load(_supabase);
 *
 *   // 2. Create map (unchanged)
 *   var map = L.map('map').setView([15.87, 100.99], 6);
 *
 *   // 3. Attach tile layer (was L.tileLayer(...).addTo(map))
 *   MapConfig.createTileLayer(map);
 */
(function(global) {
  'use strict';

  var DEFAULT_TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  var DEFAULT_TILE_ATTR = '&copy; CartoDB';
  var DEFAULT_MAX_ZOOM = 19;
  var GOOGLE_MUTANT_URL = 'https://unpkg.com/leaflet.gridlayer.googlemutant@0.14.1/dist/Leaflet.GoogleMutant.js';
  var SDK_TIMEOUT_MS = 15000;

  var MapConfig = {
    _config: null,
    _loaded: false,
    _loadCallbacks: [],
    _sdkPromise: null,
    _mutantPromise: null,

    /** Returns true once load() has resolved successfully. */
    isLoaded: function() { return this._loaded; },

    /** Register a callback to run when config finishes loading. Fires immediately if already loaded. */
    onLoad: function(cb) {
      if (this._loaded) { try { cb(this._config); } catch(e){} return; }
      this._loadCallbacks.push(cb);
    },

    /** Load settings from Supabase settings table. Call once per page. */
    async load(supabase) {
      try {
        var res = await supabase.from('settings').select('key, value')
          .in('key', ['MAP_PROVIDER', 'GOOGLE_MAPS_API_KEY', 'GOOGLE_MAPS_TYPE']);
        var map = {};
        (res.data || []).forEach(function(s) { map[s.key] = s.value; });
        this._config = {
          provider: map.MAP_PROVIDER || 'leaflet',
          apiKey: map.GOOGLE_MAPS_API_KEY || '',
          mapType: map.GOOGLE_MAPS_TYPE || 'roadmap'
        };
      } catch (e) {
        console.warn('[MapConfig] Failed to load settings, using Leaflet defaults:', e);
        this._config = { provider: 'leaflet', apiKey: '', mapType: 'roadmap' };
      }
      this._loaded = true;
      var cbs = this._loadCallbacks.slice();
      this._loadCallbacks = [];
      var cfg = this._config;
      cbs.forEach(function(cb) { try { cb(cfg); } catch(e){} });
      return this._config;
    },

    /** Current config (or safe defaults if not loaded yet). */
    getConfig: function() {
      return this._config || { provider: 'leaflet', apiKey: '', mapType: 'roadmap' };
    },

    /** Should we try to use Google Maps? */
    useGoogle: function() {
      var c = this.getConfig();
      return c.provider === 'google' && !!c.apiKey;
    },

    /** Dynamically load Google Maps JS SDK (cached). */
    loadGoogleSDK: function() {
      if (this._sdkPromise) return this._sdkPromise;
      var config = this.getConfig();
      if (!config.apiKey) {
        return Promise.reject(new Error('No Google Maps API key configured'));
      }

      this._sdkPromise = new Promise(function(resolve, reject) {
        if (window.google && window.google.maps) {
          resolve(window.google);
          return;
        }

        var cbName = '__gmapsCallback_' + Math.floor(Math.random() * 1e9);
        var timeoutId = setTimeout(function() {
          if (window[cbName]) {
            delete window[cbName];
            reject(new Error('Google Maps SDK load timeout'));
          }
        }, SDK_TIMEOUT_MS);

        window[cbName] = function() {
          clearTimeout(timeoutId);
          delete window[cbName];
          resolve(window.google);
        };

        var script = document.createElement('script');
        script.src = 'https://maps.googleapis.com/maps/api/js'
                   + '?key=' + encodeURIComponent(config.apiKey)
                   + '&libraries=places'
                   + '&callback=' + cbName
                   + '&loading=async'
                   + '&v=weekly';
        script.async = true;
        script.defer = true;
        script.onerror = function() {
          clearTimeout(timeoutId);
          delete window[cbName];
          reject(new Error('Failed to load Google Maps SDK'));
        };
        document.head.appendChild(script);
      });

      return this._sdkPromise;
    },

    /** Load Leaflet.GridLayer.GoogleMutant plugin (cached). */
    loadGoogleMutantPlugin: function() {
      if (this._mutantPromise) return this._mutantPromise;
      this._mutantPromise = new Promise(function(resolve, reject) {
        if (window.L && window.L.gridLayer && window.L.gridLayer.googleMutant) {
          resolve();
          return;
        }
        var script = document.createElement('script');
        script.src = GOOGLE_MUTANT_URL;
        script.async = true;
        script.onload = function() { resolve(); };
        script.onerror = function() { reject(new Error('Failed to load GoogleMutant plugin')); };
        document.head.appendChild(script);
      });
      return this._mutantPromise;
    },

    /**
     * Create a tile layer on the given Leaflet map.
     * Returns a promise that resolves to the tile layer.
     * Always succeeds — falls back to default Leaflet tiles on any error.
     */
    createTileLayer: function(map, options) {
      options = options || {};
      var tileUrl = options.fallbackUrl || DEFAULT_TILE_URL;
      var tileAttr = options.fallbackAttribution || DEFAULT_TILE_ATTR;
      var tileMaxZoom = options.maxZoom || DEFAULT_MAX_ZOOM;

      var self = this;
      var fallback = function() {
        return L.tileLayer(tileUrl, { attribution: tileAttr, maxZoom: tileMaxZoom }).addTo(map);
      };

      if (!this.useGoogle()) {
        return Promise.resolve(fallback());
      }

      return Promise.all([this.loadGoogleSDK(), this.loadGoogleMutantPlugin()])
        .then(function() {
          var type = self.getConfig().mapType || 'roadmap';
          return L.gridLayer.googleMutant({ type: type, maxZoom: tileMaxZoom }).addTo(map);
        })
        .catch(function(err) {
          console.warn('[MapConfig] Google Maps unavailable, using Leaflet fallback:', err);
          return fallback();
        });
    }
  };

  global.MapConfig = MapConfig;
})(window);
