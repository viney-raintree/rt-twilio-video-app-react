import React, { useState, useCallback, useEffect } from 'react';
import { makeStyles, createStyles } from '@material-ui/core/styles';
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, Paper } from '@material-ui/core';
import CheckIcon from '@material-ui/icons/Check';
import Alert from '@material-ui/lab/Alert';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';

const useStyles = makeStyles(() =>
  createStyles({
    openButton: {
      margin: 'auto',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: '1em',
    },
    dialogTitle: {
      width: '100%',
      minHeight: '56px',
      background: '#F4F4F6',
      borderBottom: '1px solid #E4E7E9',
      display: 'inline-flex',
      justifyContent: 'space-between',
    },
    text: {
      fontWeight: 'bold',
    },
    closeBackgroundSelection: {
      cursor: 'pointer',
      display: 'flex',
      background: 'transparent',
      border: '0',
      padding: '0.4em',
    },
    dragAndDropWidget: {
      minHeight: '200px',
      // background: '#F4F4F6',
      borderBottom: '1px solid #E4E7E9',
      display: 'flex',
      justifyContent: 'flex-col',
      alignItems: 'center',
      padding: '0 5em',
      margin: '10px',
    },
    custom: {
      background: '#A5F5F5',
      display: 'inline-flex',
      justifyContent: 'space-between',
    },
    thumbsContainer: {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 16,
    },
    thumb: {
      display: 'inline-flex',
      borderRadius: 2,
      border: '1px solid #eaeaea',
      margin: 'auto',
      marginBottom: 16,
      width: 'auto',
      height: 200,
      padding: 4,
      boxSizing: 'border-box',
    },
    thumbInner: {
      display: 'flex',
      minWidth: 0,
      overflow: 'hidden',
    },
    img: {
      display: 'block',
      width: 'auto',
      height: '100%',
    },
  })
);

interface BackgroundUploadDialogProps {
  imageUploaded: boolean;
  setImageUploaded: (imageUploaded: boolean) => void;
  hostName: string;
  setHostName: (hostName: string) => void;
}

interface ImageObj {
  name: string;
  preview: string;
  path: string;
}

export default function BackgoundUploadDialog({
  imageUploaded,
  setImageUploaded,
  hostName,
  setHostName,
}: BackgroundUploadDialogProps) {
  const [image, setImage] = useState('');
  const [files, setFiles] = useState<ImageObj[]>([]);
  const [open, setOpen] = useState(false);
  const [imageUploadSuccess, setImageUploadSuccess] = useState<boolean>(false);
  const classes = useStyles();

  useEffect(() => {
    if (!hostName) {
      // console.log('setting host name');
      const params = new URLSearchParams(window.location.search);
      setHostName(params.get('chost')!);
    }

    if (imageUploadSuccess) {
      setTimeout(() => {
        setImageUploadSuccess(false);
      }, 2500);
    }

    files.forEach(file => URL.revokeObjectURL(file.preview));
  }, [hostName, imageUploadSuccess, files]);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setImage('');
    setFiles([]);
    setOpen(false);
  };

  const handleUpload = async () => {
    const formData = new FormData();
    formData.append('bgImage', image);

    try {
      const { data } = await axios({
        method: 'post',
        data: formData,
        url: 'api/bgUpload',
        headers: {
          'Content-Type': 'multipart/form-data',
          chost: hostName,
        },
      });

      console.dir(data);

      if (data.success) {
        // console.log('Image upload success');
        setImageUploadSuccess(true);
        setImageUploaded(true);
        setTimeout(() => {
          handleClose();
        }, 2000);
      }
    } catch (error) {}
  };

  const onDrop = useCallback(
    acceptedFiles => {
      setImageUploaded(false);
      // console.dir('acceptedFiles' + acceptedFiles);
      // console.dir(acceptedFiles);
      // console.log('Accepted File type is ' + typeof acceptedFiles[0]);
      // console.log('Path ' + acceptedFiles[0].path);
      setImage(acceptedFiles[0]);
      setFiles(
        acceptedFiles.map((file: MediaSource) =>
          Object.assign(file, {
            preview: URL.createObjectURL(file),
          })
        )
      );
    },
    [image]
  );

  const { getRootProps, getInputProps, isDragActive, acceptedFiles, isDragReject, isDragAccept } = useDropzone({
    onDrop,
    multiple: false,
    accept: 'image/jpeg,image/png,image/jpg',
  });

  return (
    <div>
      <Button variant="outlined" color="primary" className={classes.openButton} onClick={handleClickOpen}>
        Add New Background
      </Button>
      <hr />
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle className={classes.dialogTitle}>Add a new virtual background</DialogTitle>
        <DialogContent>
          <Paper elevation={3}>
            <section>
              <div {...getRootProps()} className={classes.dragAndDropWidget}>
                <input {...getInputProps()} />
                {isDragActive ? (
                  <p>Drop the background image here ...</p>
                ) : (
                  <p>Drag 'n' drop background image here, or click to select</p>
                )}
              </div>
            </section>
          </Paper>
          {/* {isDragReject ? (
            <p>Only images are allowed.</p>
          ) :} */}
          {/* <DialogContentText>Enter your name</DialogContentText>
          <TextField autoFocus margin="dense" id="name" label="name" type="text" fullWidth /> */}
          <aside className={classes.thumbsContainer}>
            {files.length > 0 &&
              files.map(file => (
                <div className={classes.thumb} key={file.name}>
                  {/* <div>Background Preview</div> */}
                  <div className={classes.thumbInner}>
                    <img src={file.preview} className={classes.img} />
                  </div>
                </div>
              ))}
          </aside>
          {imageUploadSuccess && (
            <Alert icon={<CheckIcon fontSize="inherit" />} severity="success">
              Background Image has been uploaded successfully.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="primary">
            Cancel
          </Button>
          <Button onClick={handleUpload} color="primary" autoFocus>
            Upload
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
