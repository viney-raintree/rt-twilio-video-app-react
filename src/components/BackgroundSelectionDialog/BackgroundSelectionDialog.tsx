import React, { useEffect, useState } from 'react';
import BackgroundSelectionHeader from './BackgroundSelectionHeader/BackgroundSelectionHeader';
import BackgroundThumbnail from './BackgroundThumbnail/BackgroundThumbnail';
import Drawer from '@material-ui/core/Drawer';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { backgroundConfig } from '../VideoProvider/useBackgroundSettings/useBackgroundSettings';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import BackgroundUploadDialog from './../BackgoundUploadDialog/BackgoundUploadDialog';
import { useLocation } from "react-router-dom";

import axios from 'axios';

const useStyles = makeStyles((theme: Theme) => ({
  drawer: {
    display: 'flex',
    width: theme.rightDrawerWidth,
    height: `calc(100% - ${theme.footerHeight}px)`,
  },
  thumbnailContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    padding: '5px',
    overflowY: 'auto',
  },
}));

function BackgroundSelectionDialog() {
  const classes = useStyles();
  const { isBackgroundSelectionOpen, setIsBackgroundSelectionOpen } = useVideoContext();
  const [imageUploaded, setImageUploaded] = useState(false);
  const [hostName, setHostName] = useState<string>('');

  var imageNames = backgroundConfig.imageNames;
  var images = backgroundConfig.images;

  const [bgImages, setBgImages] = useState<string[]>(uniqueArray4(images));
  const [bgImageNames, setBgImageNames] = useState<string[]>(uniqueArray4(imageNames));
  const [customImagesExists, setcustomImagesExists] = useState<boolean>(true);

  // var rawImages = backgroundConfig.rawImagePaths;
  const params = new URLSearchParams(window.location.search);
  const chost: string = params.get('chost')!;

  function uniqueArray4(a: string[]) {
    return [...new Set(a)];
  }

  function importCustomImages() {
    console.log('importCustomImages() called hostName - ' + chost);
    importAll(require.context('../../images/custom/', false, /\.(png|jpe?g)$/));

    // console.log('images that were fetched');
    // console.dir(images);

    // console.log('images that were already loaded');
    // console.dir(bgImages);

      console.log('IMAGES',images)
    setBgImages(images);
    setBgImageNames(imageNames);
  }

  function importAll(r: __WebpackModuleApi.RequireContext) {
    r.keys().forEach(image => {
      var imageName = image.replace('./', '');

      // only accept files with the hostName prefix match.
      if (imageName.indexOf(chost + '-') === 0) {
        image = image.replace('./', '/static/media/');

        // console.log('BackgroundSelectionDialog.tsx - Image key - ' + image);

        const result = imageName
          .replace(chost + '-', '')
          .replace(/\.[^/.]+$/, '')
          .replace(/([A-Z])/g, ' $1');
        imageName = result.charAt(0).toUpperCase() + result.slice(1);

        images.push(image);
        imageNames.push(imageName);
      }
    });
    console.log('IMAGES',images)

    images = uniqueArray4(images);
    imageNames = uniqueArray4(imageNames);
  }

  useEffect(() => {

    if (imageUploaded || customImagesExists) {
      setcustomImagesExists(false);
      let config = {
        headers: { 'Cache-Control': 'no-cache' },
        params: {
          chost: chost,
        },
      };
      axios
        .get('api/listCustomBgImages', config)
        .then(res => {
          // console.log('Axios call inside useEffect to load custom images');
          // console.log('Images in the API call to get list' + res.data);
          // console.dir(res);
          const customImages = JSON.parse(res.data);
          const customImagesPaths: string[] = [];
          const customImagesNames: string[] = [];

          customImages.forEach((image: string) => {
            var imageName = image;
            image = '/static/media/' + image;

            const result = imageName
              .replace(chost + '-', '')
              .replace(/\.[^/.]+$/, '')
              .replace(/([A-Z])/g, ' $1');
            imageName = result.charAt(0).toUpperCase() + result.slice(1);

            // console.log('BackgroundSelectionDialog.tsx - Image key - ' + image);

            images.push(image);
            imageNames.push(imageName);
            customImagesPaths.push(image);
            customImagesNames.push(imageName);
          });

          images = uniqueArray4(images);
          imageNames = uniqueArray4(imageNames);
          setBgImages(images);
          setBgImageNames(imageNames);
          backgroundConfig.updateRawImagePaths(customImagesPaths, customImagesNames);

          // console.log('List of Custom Images is below');
          // console.dir(imageNames);
        })
        .catch(error => {
          console.log('error ' + error);
        });
      setImageUploaded(false);
    }
  }, [imageUploaded, customImagesExists]);

  return (
    <Drawer
      variant="persistent"
      anchor="right"
      open={isBackgroundSelectionOpen}
      transitionDuration={0}
      classes={{
        paper: classes.drawer,
      }}
    >
      <BackgroundSelectionHeader onClose={() => setIsBackgroundSelectionOpen(false)} />
      <BackgroundUploadDialog
        imageUploaded={imageUploaded}
        setImageUploaded={setImageUploaded}
        hostName={hostName}
        setHostName={setHostName}
      />
      <div className={classes.thumbnailContainer}>
        <BackgroundThumbnail thumbnail={'none'} name={'None'} />
        <BackgroundThumbnail thumbnail={'blur'} name={'Blur'} />
        {bgImages.map((image, index) => (
          <BackgroundThumbnail
            thumbnail={'image'}
            name={bgImageNames[index]}
            index={index}
            imagePath={image}
            key={image}
          />
        ))}
      </div>
    </Drawer>
  );
}

export default BackgroundSelectionDialog;
