import { LocalVideoTrack, Room } from 'twilio-video';
import { useState, useEffect, useCallback } from 'react';
import { SELECTED_BACKGROUND_SETTINGS_KEY } from '../../../constants';
import {
  GaussianBlurBackgroundProcessor,
  VirtualBackgroundProcessor,
  ImageFit,
  isSupported,
} from '@twilio/video-processors';
import Abstract from '../../../images/Abstract.jpg';
import AbstractThumb from '../../../images/thumb/Abstract.jpg';
import BohoHome from '../../../images/BohoHome.jpg';
import BohoHomeThumb from '../../../images/thumb/BohoHome.jpg';
import Bookshelf from '../../../images/Bookshelf.jpg';
import BookshelfThumb from '../../../images/thumb/Bookshelf.jpg';
import CoffeeShop from '../../../images/CoffeeShop.jpg';
import CoffeeShopThumb from '../../../images/thumb/CoffeeShop.jpg';
import Contemporary from '../../../images/Contemporary.jpg';
import ContemporaryThumb from '../../../images/thumb/Contemporary.jpg';
import CozyHome from '../../../images/CozyHome.jpg';
import CozyHomeThumb from '../../../images/thumb/CozyHome.jpg';
import Desert from '../../../images/Desert.jpg';
import DesertThumb from '../../../images/thumb/Desert.jpg';
import Fishing from '../../../images/Fishing.jpg';
import FishingThumb from '../../../images/thumb/Fishing.jpg';
import Flower from '../../../images/Flower.jpg';
import FlowerThumb from '../../../images/thumb/Flower.jpg';
import Kitchen from '../../../images/Kitchen.jpg';
import KitchenThumb from '../../../images/thumb/Kitchen.jpg';
import ModernHome from '../../../images/ModernHome.jpg';
import ModernHomeThumb from '../../../images/thumb/ModernHome.jpg';
import Nature from '../../../images/Nature.jpg';
import NatureThumb from '../../../images/thumb/Nature.jpg';
import Ocean from '../../../images/Ocean.jpg';
import OceanThumb from '../../../images/thumb/Ocean.jpg';
import Patio from '../../../images/Patio.jpg';
import PatioThumb from '../../../images/thumb/Patio.jpg';
import Plant from '../../../images/Plant.jpg';
import PlantThumb from '../../../images/thumb/Plant.jpg';
import SanFrancisco from '../../../images/SanFrancisco.jpg';
import SanFranciscoThumb from '../../../images/thumb/SanFrancisco.jpg';
import { Thumbnail } from '../../BackgroundSelectionDialog/BackgroundThumbnail/BackgroundThumbnail';
// import axios from 'axios';
export interface BackgroundSettings {
  type: Thumbnail;
  index?: number;
}

var imageNames: string[] = [
  'Abstract',
  'Boho Home',
  'Bookshelf',
  'Coffee Shop',
  'Contemporary',
  'Cozy Home',
  'Desert',
  'Fishing',
  'Flower',
  'Kitchen',
  'Modern Home',
  'Nature',
  'Ocean',
  'Patio',
  'Plant',
  'San Francisco',
];

var images = [
  AbstractThumb,
  BohoHomeThumb,
  BookshelfThumb,
  CoffeeShopThumb,
  ContemporaryThumb,
  CozyHomeThumb,
  DesertThumb,
  FishingThumb,
  FlowerThumb,
  KitchenThumb,
  ModernHomeThumb,
  NatureThumb,
  OceanThumb,
  PatioThumb,
  PlantThumb,
  SanFranciscoThumb,
];

var rawImagePaths = [
  Abstract,
  BohoHome,
  Bookshelf,
  CoffeeShop,
  Contemporary,
  CozyHome,
  Desert,
  Fishing,
  Flower,
  Kitchen,
  ModernHome,
  Nature,
  Ocean,
  Patio,
  Plant,
  SanFrancisco,
];

const params = new URLSearchParams(window.location.search);
const chost = params.get('chost');

function uniqueArray4(a: string[]) {
  return [...new Set(a)];
}

async function importCustomImages() {
  // console.log('importCustomImags() called.');

  await importAll(require.context('../../../images/custom/', false, /.*\.(png|jpe?g)$/));

  // images = uniqueArray4(images);
  // rawImagePaths = uniqueArray4(rawImagePaths);
  // imageNames = uniqueArray4(imageNames);
}

async function importAll(r: __WebpackModuleApi.RequireContext) {
  setTimeout(function() {
    r.keys().forEach(image => {
      if (image) {
        var imageName = image.replace('./', '');

        // only accept files with the hostName prefix match.
        if (imageName.indexOf(chost + '-') === 0) {
          image = image.replace('./', '/static/media/');

          // console.log('Image Key - ' + image);

          const result = imageName
            .replace(chost + '-', '')
            .replace(/\.[^/.]+$/, '')
            .replace(/([A-Z])/g, ' $1');
          imageName = result.charAt(0).toUpperCase() + result.slice(1);

          images.push(image);
          rawImagePaths.push(image);
          imageNames.push(imageName);
        }
      }
    });
  }, 500);

  images = uniqueArray4(images);
  rawImagePaths = uniqueArray4(rawImagePaths);
  imageNames = uniqueArray4(imageNames);
}

importCustomImages();

function updateRawImagePaths(customImagePaths: string[], customImageNames: string[]) {
  customImagePaths.forEach(image => {
    rawImagePaths.push(image);
  });

  customImageNames.forEach(imageName => {
    imageNames.push(imageName);
  });

  rawImagePaths = uniqueArray4(rawImagePaths);
  imageNames = uniqueArray4(imageNames);

  // console.log('raw paths after uniqueArray4 ');
  // console.dir(imageNames);
}

let imageElements = new Map();

const getImage = (index: number): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    if (imageElements.has(index)) {
      return resolve(imageElements.get(index));
    }
    const img = new Image();
    img.onload = () => {
      imageElements.set(index, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = rawImagePaths[index];
  });
};

export const backgroundConfig = {
  imageNames,
  images,
  updateRawImagePaths,
};

const virtualBackgroundAssets = '/virtualbackground';
let blurProcessor: GaussianBlurBackgroundProcessor;
let virtualBackgroundProcessor: VirtualBackgroundProcessor;

export default function useBackgroundSettings(videoTrack: LocalVideoTrack | undefined, room?: Room | null) {
  const [backgroundSettings, setBackgroundSettings] = useState<BackgroundSettings>(() => {
    const localStorageSettings = window.localStorage.getItem(SELECTED_BACKGROUND_SETTINGS_KEY);
    return localStorageSettings ? JSON.parse(localStorageSettings) : { type: 'none', index: 0 };
  });

  const removeProcessor = useCallback(() => {
    if (videoTrack && videoTrack.processor) {
      videoTrack.removeProcessor(videoTrack.processor);
    }
  }, [videoTrack]);

  const addProcessor = useCallback(
    (processor: GaussianBlurBackgroundProcessor | VirtualBackgroundProcessor) => {
      if (!videoTrack || videoTrack.processor === processor) {
        return;
      }
      removeProcessor();
      videoTrack.addProcessor(processor);
    },
    [videoTrack, removeProcessor]
  );

  useEffect(() => {
    if (!isSupported) {
      return;
    }
    // make sure localParticipant has joined room before applying video processors
    // this ensures that the video processors are not applied on the LocalVideoPreview
    const handleProcessorChange = async () => {
      if (!blurProcessor) {
        blurProcessor = new GaussianBlurBackgroundProcessor({
          assetsPath: virtualBackgroundAssets,
        });
        await blurProcessor.loadModel();
      }
      if (!virtualBackgroundProcessor) {
        virtualBackgroundProcessor = new VirtualBackgroundProcessor({
          assetsPath: virtualBackgroundAssets,
          backgroundImage: await getImage(0),
          fitType: ImageFit.Cover,
        });
        await virtualBackgroundProcessor.loadModel();
      }
      if (!room?.localParticipant) {
        return;
      }

      if (backgroundSettings.type === 'blur') {
        addProcessor(blurProcessor);
      } else if (backgroundSettings.type === 'image' && typeof backgroundSettings.index === 'number') {
        virtualBackgroundProcessor.backgroundImage = await getImage(backgroundSettings.index);
        addProcessor(virtualBackgroundProcessor);
      } else {
        removeProcessor();
      }
    };
    handleProcessorChange();
    window.localStorage.setItem(SELECTED_BACKGROUND_SETTINGS_KEY, JSON.stringify(backgroundSettings));
  }, [backgroundSettings, videoTrack, room, addProcessor, removeProcessor]);

  return [backgroundSettings, setBackgroundSettings] as const;
}
