
import { createApplicationOperations } from './operations.js';
import * as Cesium from 'cesium';
import {
  createApplicationViewer,
  installFreeLookHeightLimit,
  installTrackpadPinchZoom,
} from '../app/viewer.js';
import { registerDataCredits } from '../data/dataCredits.js';
import { configureCreditKeyboardAccess } from '../creditKeyboard.js';
import { MapStackController } from '../mapStackController.js';
import { loadPhotorealisticTileset } from '../mapStartup.js';
import { initLogoGaze } from '../logoGaze.js';
import {
  uninstallRenderGovernor,
  governorRequestRender,
} from '../renderGovernor.js';
import { describeError } from './errors.js';
import { isEmbeddedInline } from './embed.js';
import { installRenderFailureNotice } from '../ui/renderFailure.js';
import { worldClock, worldTimeFor } from '../time/worldClock.js';
import { followWorldTime } from '../time/viewerClock.js';
import { onLocaleChange, t } from '../i18n/index.js';

// SARATHI default map location: Buguda, Ganjam, Odisha.
// Approximate town-centre coordinates.
const SARATHI_DEFAULT_LOCATION = {
  longitude: 84.79,
  latitude: 19.81,
  height: 18000,
};

/** Construct the application globe using the caller's local configuration. */
export async function createApplicationScene({
  requestServices,
  googleApiKey,
  googleTokens = null,
  cesiumToken,
  credits,
  MapController = MapStackController,
  mapOptions = {},
  loaderStatus,
  signal,
  defer,
}) {
  const operations = createApplicationOperations({
    requests: requestServices,
    signal,
  });

  defer(initLogoGaze());

  const previousKey = window.__GOOGLE_MAPS_API_KEY__;

  if (googleApiKey) {
    window.__GOOGLE_MAPS_API_KEY__ = googleApiKey;

    defer(() => {
      if (window.__GOOGLE_MAPS_API_KEY__ !== googleApiKey) return;

      if (previousKey === undefined) {
        delete window.__GOOGLE_MAPS_API_KEY__;
      } else {
        window.__GOOGLE_MAPS_API_KEY__ = previousKey;
      }
    });
  }

  loaderStatus.textContent = t('Configuring viewer...');

  const creditContainer = document.createElement('div');
  creditContainer.id = 'cesium-credits';
  document.body.appendChild(creditContainer);

  defer(() => creditContainer.remove());

  const viewer = createApplicationViewer({
    container: 'cesiumContainer',
    creditContainer,
    showRenderLoopErrors: false,
  });

  defer(() => {
    uninstallRenderGovernor(viewer);

    if (!viewer.isDestroyed()) {
      viewer.destroy();
    }
  });

  defer(
    installRenderFailureNotice(viewer, {
      allowReload: !isEmbeddedInline(),
    }),
  );

  defer(installTrackpadPinchZoom(viewer));

  defer(
    followWorldTime(viewer, worldTimeFor('sky'), {
      subscribe: worldClock.subscribe,
      requestRender: () => governorRequestRender('world-time'),
    }),
  );

  defer(installFreeLookHeightLimit(viewer));

  registerDataCredits(viewer, credits);
  configureCreditKeyboardAccess(document);

  defer(
    onLocaleChange(() => configureCreditKeyboardAccess(document)),
  );

  loaderStatus.textContent =
    googleApiKey || googleTokens || cesiumToken
      ? t('Loading Google 3D Tiles...')
      : t('Loading the keyless globe...');

  const photoreal = await loadPhotorealisticTileset(Cesium, {
    googleApiKey,
    googleTokens,
    cesiumToken,
  });

  const tileset = photoreal.tileset;

  defer(() => {
    if (tileset && !tileset.isDestroyed()) {
      if (!viewer.scene.primitives.remove(tileset)) {
        tileset.destroy();
      }
    }
  });

  signal.throwIfAborted();

  if (tileset) {
    viewer.scene.primitives.add(tileset);
    viewer.scene.globe.show = false;

    console.info(
      `[Init] Google 3D Tiles loaded via ${photoreal.route}.`,
    );
  } else {
    if (photoreal.errors.length) {
      const tileError = photoreal.errors.at(-1);

      console.warn(
        '[Init] Google 3D Tiles unavailable, using the keyless globe:',
        tileError,
      );

      const tileErrorDetail = describeError(tileError);

      loaderStatus.textContent = t(
        'Google 3D Tiles unavailable ({detail}). Loading the keyless globe...',
        {
          detail: tileErrorDetail,
        },
      );
    }

    viewer.scene.globe.show = true;
  }

  loaderStatus.textContent = t('Initializing systems...');

  const mapStackController = new MapController(viewer, {
    requestRender: governorRequestRender,
    ...mapOptions,
    googleTileset: tileset,
    cesiumToken,
    initialStack: tileset ? 'photoreal' : 'esri-imagery',

    onChange: (state) => {
      window.dispatchEvent(
        new CustomEvent('gev:map-stack-changed', {
          detail: state,
        }),
      );
    },

    onError: (message) => {
      console.warn('[MapStack]', message);
    },
  });

  defer(() => mapStackController.destroy());

  await mapStackController.setStack(
    tileset ? 'photoreal' : 'esri-imagery',
    {
      silent: true,
    },
  );

  signal.throwIfAborted();

  // ========================================
  // SARATHI: DEFAULT CAMERA - BUGUDA, ODISHA
  // ========================================

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      SARATHI_DEFAULT_LOCATION.longitude,
      SARATHI_DEFAULT_LOCATION.latitude,
      SARATHI_DEFAULT_LOCATION.height,
    ),
    duration: 2,
  });

  console.info(
    '[SARATHI] Default map location set to Buguda, Ganjam.',
  );

  return {
    viewer,
    tileset,
    mapStackController,
    operations,
  };
}
