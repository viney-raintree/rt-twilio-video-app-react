import './bootstrap-globals';
import { createExpressHandler } from './createExpressHandler';
import express, { RequestHandler } from 'express';
import path from 'path';
import { ServerlessFunction } from './types';
import https from 'https';
import fs from 'fs';
import multer from 'multer';

const PORT = process.env.PORT ?? 18080;

let customImagesDirPath = './src/images/custom/';

if (!fs.existsSync(customImagesDirPath)) {
  fs.mkdirSync(customImagesDirPath, {
    recursive: true,
  });
}

// const credentials = {
//   key: fs.readFileSync('C:/Git/keys.localhost/key.pem', 'utf8'),
//   cert: fs.readFileSync('C:/Git/keys.localhost/cert.pem', 'utf8'),
// };

const credentials = {
  key: fs.readFileSync('E:/rtw/https/raintreeinc.com.key.pem', 'utf8'),
  cert: fs.readFileSync('E:/rtw/https/raintreeinc.com.cert.pem', 'utf8'),
};

const app = express();
const jwt = require("jsonwebtoken");
const cors = require('cors');
app.use(express.json());
app.use(cors());

// This server reuses the serverless endpoints from the "plugin-rtc" Twilio CLI Plugin, which is used when the "npm run deploy:twilio-cli" command is run.
// The documentation for this endpoint can be found in the README file here: https://github.com/twilio-labs/plugin-rtc
const tokenFunction: ServerlessFunction = require('@twilio-labs/plugin-rtc/src/serverless/functions/token').handler;
const tokenEndpoint = createExpressHandler(tokenFunction);

const recordingRulesFunction: ServerlessFunction = require('@twilio-labs/plugin-rtc/src/serverless/functions/recordingrules')
  .handler;
const recordingRulesEndpoint = createExpressHandler(recordingRulesFunction);

const noopMiddleware: RequestHandler = (_, __, next) => next();
const authMiddleware =
  process.env.REACT_APP_SET_AUTH === 'firebase' ? require('./firebaseAuthMiddleware') : noopMiddleware;

app.all('/token', authMiddleware, tokenEndpoint);
app.all('/recordingrules', authMiddleware, recordingRulesEndpoint);

app.use((req, res, next) => {
  // Here we add Cache-Control headers in accordance with the create-react-app best practices.
  // See: https://create-react-app.dev/docs/production-build/#static-file-caching
  if (req.path === '/' || req.path === 'index.html') {
    res.set('Cache-Control', 'no-cache');
  } else {
    res.set('Cache-Control', 'max-age=31536000');
  }
  next();
});

app.use(express.static(path.join(__dirname, '../build')));

const toPascalCase = function toPascalCase(str) {
  return (' ' + str).toLowerCase().replace(/[^a-zA-Z0-9\.]+(.)/g, function(match, chr) {
    return chr.toUpperCase();
  });
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, customImagesDirPath);
  },
  filename: (req, file, cb) => {
    const pascalCaseFileName = toPascalCase(file.originalname);
    const host = req.headers.chost as string;
    // new format is <host>-<fileName>
    const fileName = host + '-' + pascalCaseFileName.split(' ').join('');
    // cb(null, uuidv4() + '-' + fileName)
    cb(null, fileName);
  },
});

var upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype == 'image/png' || file.mimetype == 'image/jpg' || file.mimetype == 'image/jpeg') {
      cb(null, true);
    } else {
      cb(null, false);
      return cb(new Error('Only .png, .jpg and .jpeg format allowed!'));
    }
  },
});

app.post('/rtconnect/api/bgUpload', upload.single('bgImage'), (req, res, next) => {
  console.log('API Request file name - ' + req.file!.filename);

  const host = req.headers.chost as string;
  const sourceFile = customImagesDirPath + req.file!.filename;
  const destFile = './build/static/media/' + req.file!.filename;

  // destFile will be created or overwritten by default.
  fs.copyFile(sourceFile, destFile, err => {
    if (err) throw err;
    console.log('source file was copied to destination.txt');
  });

  res.status(201).json({
    success: true,
    message: 'Image Uploaded Successfully.',
  });
});

app.get('/rtconnect/api/listCustomBgImages', (req, res) => {
  console.log('listCustomImages get req called');

  const host = req.query.chost as string;
  var customImagesList: string[] = [];

  try {
    const files = fs.readdirSync(customImagesDirPath);

    files.forEach(file => {
      // console.log('File in loop - ' + file);
      // console.log(file.indexOf(host + '-'));

      if (file.indexOf(host + '-') === 0) {
        // console.log('image match found');
        if (path.extname(file) == '.jpg') customImagesList.push(file);
        if (path.extname(file) == '.png') customImagesList.push(file);
        if (path.extname(file) == '.jpeg') customImagesList.push(file);
      }
    });
  } catch (err) {
    // if (err instanceof Error) {
    //   if (err.code === 'ENOENT') {
    console.log('Dir not found!');
    //   } else {
    //     throw err;
    //   }
    // }
  }
  // console.log(customImagesList.toString());

  if (customImagesList.length > 0) {
    res.status(201).json(JSON.stringify(customImagesList));
  } else {
    res.status(404).json({
      success: false,
      message: 'No Custom Backgrounds found.',
    });
  }
});

app.get('/rtconnect/api/getWhiteboardToken', (req, res) => {
  console.log("Hitting whiteboard end point"+req);
  const user = {
      "iss": process.env.CLIENTID_WB
  }
  let accessToken = jwt.sign(user, process.env.CLIENT_SKEY_WB, {algorithm:'HS256', expiresIn: '1h'})
  console.log("Access Token ==> " + accessToken);
  return res.status(201).json({
    accessToken
  });
});

app.get('*', (_, res) => {
  // Don't cache index.html

  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, '../build/index.html'));
});
// app.listen(PORT, () => console.log(`twilio-video-app-react server running on ${PORT}`));.

const server = https.createServer(credentials, app);
server.listen(PORT, () => console.log(`twilio-video-app-react server running on ${PORT}`));

// Logic to get all custom image directories and then copy the files to ../build/static/media
const directories = fs
  .readdirSync('./src/images/', { withFileTypes: true })
  .filter(dirent => dirent.isDirectory() && dirent.name !== 'thumb')
  .map(dirent => dirent.name);

directories.forEach(dir => {
  console.log('dirName - ' + dir);

  fs.readdirSync('./src/images/' + dir).forEach(file => {
    const sourceFile = './src/images/' + dir + '/' + file;
    const destFile = './build/static/media/' + file;

    // destFile will be created or overwritten by default.
    fs.copyFile(sourceFile, destFile, err => {
      if (err) throw err;
      console.log('source file was copied to destination.txt');
    });
  });
});
